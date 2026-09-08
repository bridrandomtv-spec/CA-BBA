#!/usr/bin/env bash
# deploy/verify-audit.sh — vérification BOÎTE NOIRE des correctifs d'audit
# contre une instance DÉPLOYÉE. Complément de verify-release.sh : vérifie que
# les correctifs sont actifs sur l'URL publique, y compris après rollback.
#
# Usage :
#   bash deploy/verify-audit.sh https://cabba.example.com
#   (ou ./deploy/verify-audit.sh après : git update-index --chmod=+x deploy/verify-audit.sh)
#   WORKER_URL=http://… bash deploy/verify-audit.sh https://cabba.example.com
#
# Sortie : 0 = aucun FAIL (des WARN possibles), 1 = au moins un FAIL.
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-}}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage : $0 <BASE_URL>   (ex. https://cabba.example.com)" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

FAILED=0
WARNED=0
pass() { printf '  PASS  %s\n' "$1"; }
warn() { printf '  WARN  %s\n' "$1"; WARNED=$((WARNED + 1)); }
fail() { printf '  FAIL  %s\n' "$1"; FAILED=$((FAILED + 1)); }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$@"; }

echo "== verify-audit : $BASE_URL =="

# 1. Sondes ------------------------------------------------------------------
[[ "$(code "$BASE_URL/api/health")" == "200" ]] && pass "/api/health → 200" || fail "/api/health ≠ 200"
ready="$(code "$BASE_URL/api/ready")"
[[ "$ready" == "200" ]] && pass "/api/ready → 200 (PostgreSQL OK)" || fail "/api/ready → $ready"

# 2. En-têtes de sécurité + CSP ----------------------------------------------
headers="$(curl -sI --max-time 8 "$BASE_URL/api/health")"
for h in 'x-content-type-options: nosniff' 'x-frame-options: DENY' 'cross-origin-opener-policy: same-origin'; do
  grep -qi "^$h" <<<"$headers" && pass "en-tête ${h%%:*}" || fail "en-tête manquant ${h%%:*}"
done
grep -qi '^x-ratelimit-limit:' <<<"$headers" && pass "X-RateLimit-* présents" || fail "X-RateLimit-* absents"
csp="$(grep -i '^content-security-policy:' <<<"$headers" || true)"
if [[ -z "$csp" ]]; then
  warn "aucune CSP (NODE_ENV=production attendu sur l'instance)"
else
  if grep -q "script-src 'self' 'unsafe-inline'" <<<"$csp"; then fail "CSP : script-src contient 'unsafe-inline'"
  elif grep -q "script-src 'self'" <<<"$csp"; then pass "CSP : script-src 'self'"
  else fail "CSP : script-src introuvable"; fi
  if grep -q "connect-src 'self' https: wss:" <<<"$csp"; then fail "CSP : connect-src ouvert à tout https:"
  elif grep -q "connect-src 'self'" <<<"$csp"; then pass "CSP : connect-src borné"
  else fail "CSP : connect-src introuvable"; fi
  grep -q "frame-src 'self' https://www.youtube.com" <<<"$csp" && pass "CSP : frame-src YouTube" || fail "CSP : frame-src absent"
  grep -qi 'strict-transport-security' <<<"$headers" && pass "HSTS présent" || fail "HSTS absent"
fi

# 3. Assistant IA protégé ------------------------------------------------------
chat_status="$(code -X POST "$BASE_URL/api/chat" -H 'Content-Type: application/json' -d '{"message":"sonde"}')"
[[ "$chat_status" == "401" ]] && pass "/api/chat anonyme → 401" || fail "/api/chat → $chat_status (attendu 401)"

# 4. Service worker versionné au build ------------------------------------------
sw="$(curl -s --max-time 8 "$BASE_URL/sw.js" || true)"
if grep -q "'__BUILD_ID__'" <<<"$sw"; then
  fail "sw.js : placeholder __BUILD_ID__ non remplacé"
elif grep -q 'CACHE_VERSION' <<<"$sw"; then
  pass "sw.js : CACHE_VERSION = $(sed -n "s/.*CACHE_VERSION = '\([^']*\)'.*/\1/p" <<<"$sw" | head -n1)"
else
  fail "sw.js introuvable ou sans CACHE_VERSION"
fi
grep -q 'fonts.googleapis.com' <<<"$sw" && fail "sw.js référence encore Google Fonts" || pass "sw.js sans Google Fonts"

# 5. HIBP (sonde sûre : nom de 101 caractères → 400 garanti AVANT tout INSERT) ----
long_name="$(printf 'a%.0s' $(seq 1 101))"
register_resp="$(curl -s --max-time 12 -X POST "$BASE_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"verify-audit-$(date +%s)@example.invalid\",\"password\":\"password\",\"displayName\":\"$long_name\"}" || true)"
if grep -q 'تسريبات' <<<"$register_resp"; then
  pass "register : mot de passe compromis rejeté (HIBP actif)"
elif grep -q 'طويل' <<<"$register_resp"; then
  warn "register : HIBP injoignable (fail-open) — refus via le nom trop long"
else
  fail "register : réponse inattendue : ${register_resp:0:120}"
fi

# 6. Fallback SPA + 404 JSON ------------------------------------------------------
[[ "$(code "$BASE_URL/profile")" == "200" ]] && pass "fallback SPA (/profile → 200)" || fail "fallback SPA cassé"
api404="$(curl -s --max-time 8 -w '\n%{http_code}' "$BASE_URL/api/definitely-not-a-route")"
if [[ "$(tail -n1 <<<"$api404")" == "404" ]] && grep -q 'API route not found' <<<"$api404"; then
  pass "/api/inconnu → 404 JSON"
else
  fail "/api/inconnu : réponse inattendue"
fi

# 7. Agrégats CABBA ------------------------------------------------------------------
summary="$(curl -s --max-time 8 -w '\n%{http_code}' "$BASE_URL/api/football/team-summary")"
if [[ "$(tail -n1 <<<"$summary")" == "200" ]] && grep -q '"configured"' <<<"$summary"; then
  pass "/api/football/team-summary → 200"
else
  fail "/api/football/team-summary → $(tail -n1 <<<"$summary")"
fi
[[ "$(code "$BASE_URL/api/football/goals-by-minute")" == "200" ]] && pass "goals-by-minute → 200" || fail "goals-by-minute ≠ 200"

# 8. SSE + validation UUID ---------------------------------------------------------------
[[ "$(code "$BASE_URL/api/matches/00000000-0000-4000-8000-000000000000/stream")" == "404" ]] \
  && pass "SSE : UUID inconnu → 404" || fail "SSE : UUID inconnu ≠ 404"
[[ "$(code "$BASE_URL/api/matches/pas-un-uuid/stream")" == "400" ]] \
  && pass "UUID malformé → 400 (app.param)" || fail "UUID malformé ≠ 400"

# 9. Worker football (ingress interne — optionnel) ------------------------------------------
if [[ -n "${WORKER_URL:-}" ]]; then
  [[ "$(code "$WORKER_URL/api/health")" == "200" ]] && pass "worker /api/health → 200" || fail "worker health ≠ 200"
  [[ "$(code "$WORKER_URL/api/matches")" == "404" ]] && pass "worker : aucune route métier" || fail "worker sert des routes métier"
else
  warn "WORKER_URL non défini : vérification du worker ignorée"
fi

# 10. Droits RGPD protégés ---------------------------------------------------------------------
[[ "$(code "$BASE_URL/api/auth/export")" == "401" ]] && pass "GET /api/auth/export anonyme → 401" || fail "export ≠ 401"
[[ "$(code -X DELETE "$BASE_URL/api/auth/account")" == "401" ]] && pass "DELETE /api/auth/account anonyme → 401" || fail "account ≠ 401"

# 11. Contenus publics vs protégés -------------------------------------------------------------------
for route in "/api/chants" "/api/videos" "/api/news" "/api/matches"; do
  [[ "$(code "$BASE_URL$route")" == "200" ]] && pass "$route → 200 anonyme" || fail "$route ≠ 200"
done
for route in "/api/community/posts" "/api/gallery/posts" "/api/predictions" "/api/polls"; do
  [[ "$(code "$BASE_URL$route")" == "401" ]] && pass "$route → 401 anonyme" || fail "$route ≠ 401"
done

# 12. Écritures admin -----------------------------------------------------------------------------------
for route in "/api/news" "/api/videos" "/api/chants" "/api/memberships" "/api/polls"; do
  [[ "$(code -X POST "$BASE_URL$route" -H 'Content-Type: application/json' -d '{}')" == "401" ]] \
    && pass "POST $route anonyme → 401" || fail "POST $route ≠ 401"
done
[[ "$(code -X DELETE "$BASE_URL/api/media/admin/pending")" == "401" ]] \
  && pass "purge média anonyme → 401" || fail "purge média ≠ 401"

# 13. MVP ------------------------------------------------------------------------------------------------------
[[ "$(code "$BASE_URL/api/matches/00000000-0000-4000-8000-000000000000/mvp")" == "401" ]] \
  && pass "GET /:id/mvp anonyme → 401" || fail "mvp ≠ 401"

# 14. Proxy météo ----------------------------------------------------------------------------------------------------
weather="$(code "$BASE_URL/api/weather")"
case "$weather" in
  200) pass "/api/weather → 200 (proxy + cache)" ;;
  502) warn "/api/weather → 502 (open-meteo injoignable, aucun cache)" ;;
  *)   fail "/api/weather → $weather (route non montée ?)" ;;
esac

# 15. Assets PWA ----------------------------------------------------------------------------------------------------------
for asset in "/icon-192.png" "/icon-512.png" "/manifest.json" "/fonts/cairo-arabic-400.woff2" "/onboarding/fan-card.jpg"; do
  [[ "$(code "$BASE_URL$asset")" == "200" ]] && pass "$asset → 200" || fail "$asset ≠ 200"
done

# 16. Bilan ----------------------------------------------------------------------------------------------------------------------
echo
if (( FAILED > 0 )); then
  echo "VERIFY-AUDIT : ÉCHEC — $FAILED FAIL, $WARNED WARN" >&2
  exit 1
fi
echo "VERIFY-AUDIT : OK — 0 FAIL, $WARNED WARN"
