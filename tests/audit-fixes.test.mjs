// Verrouille les correctifs de l'audit de production contre les régressions.
// Chaque cas correspond à un finding corrigé sur cette branche ; les items
// différés (lockfile : tw-animate-css, Playwright, sharp, retrait d3, bascule
// noUnusedLocals) sont documentés dans deploy/PRODUCTION_CHECKLIST.md §D et
// volontairement NON assertés ici.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const migrations = () => fs.readdirSync(path.join(root, 'server/db/migrations'));

/* ============================ SÉCURITÉ ============================ */

test('sécurité — CSP : script-src self, connect-src borné, frame-src YouTube, font-src self', () => {
  const sec = read('server/security.ts');
  assert.match(sec, /"script-src 'self'"/);
  assert.doesNotMatch(sec, /script-src 'self' 'unsafe-inline'/);
  assert.match(sec, /connect-src 'self'/);
  assert.doesNotMatch(sec, /connect-src 'self' https: wss:/);
  assert.match(sec, /frame-src 'self' https:\/\/www\.youtube\.com/);
  assert.match(sec, /frame-ancestors 'none'/);
  assert.match(sec, /"font-src 'self' data:"/);
  assert.match(sec, /keyFn\?: \(req: Parameters<RequestHandler>\[0\]\) => string/);
  assert.match(sec, /keyFn \? keyFn\(req\)/);
});

test('sécurité — /api/chat : session d’abord, quota par compte, message borné, UUID v7', () => {
  const server = read('server.ts');
  assert.match(server, /app\.post\("\/api\/chat",\s*requireAuth,\s*chatRateLimit/);
  assert.match(server, /MAX_MESSAGE_LENGTH/);
  assert.match(server, /keyFn: \(req\) => req\.user\?\.id/);
  assert.match(server, /\[1-7\]/);
  assert.match(server, /from "\.\/server\/rateLimit\.js"/);
  assert.match(server, /app\.use\("\/api\/weather", weatherRouter\)/);
  assert.match(server, /app\.use\("\/api\/gallery", galleryRouter\)/);
  assert.match(server, /app\.use\("\/api\/predictions", predictionsRouter\)/);
  assert.match(server, /app\.use\("\/api\/polls", pollsRouter\)/);
  const assistant = read('src/components/AiAssistant.tsx');
  assert.match(assistant, /credentials: 'same-origin'/);
  assert.match(assistant, /maxLength=\{MAX_MESSAGE_LENGTH\}/);
});

test('sécurité — rate limiter Redis optionnel avec repli mémoire', () => {
  const rl = read('server/rateLimit.ts');
  assert.match(rl, /REDIS_URL/);
  assert.match(rl, /memoryFallback/);
});

test('sécurité — mots de passe compromis : HIBP k-anonymity fail-open', () => {
  const pw = read('server/passwords.ts');
  assert.match(pw, /api\.pwnedpasswords\.com\/range\//);
  assert.match(pw, /slice\(0, 5\)/);
  assert.match(pw, /Add-Padding/);
  assert.match(read('server/auth.ts'), /isPasswordCompromised/);
});

/* ======================= SESSIONS & RGPD ======================= */

test('sessions — révocation token_version de bout en bout', () => {
  const auth = read('server/auth.ts');
  assert.match(auth, /token_version/);
  assert.match(auth, /tv: tokenVersion/);
  assert.match(auth, /Session revoked/);
  assert.match(auth, /authRouter\.get\('\/export', requireAuth/);
  assert.match(auth, /authRouter\.delete\('\/account', requireAuth/);
  assert.match(auth, /@deleted\.invalid/);
  assert.match(auth, /deleted_at = NOW\(\)/);
  assert.match(auth, /withTransaction/);
  assert.doesNotMatch(auth, /DELETE FROM orders/, 'les commandes sont des pièces comptables');
  assert.ok(migrations().some((f) => f.includes('token_version')));
  assert.ok(migrations().some((f) => f.includes('anonymization')));
  const profile = read('src/components/Profile.tsx');
  assert.match(profile, /\/api\/auth\/export/);
  assert.match(profile, /method: 'DELETE'/);
  assert.match(profile, /confirmDelete/);
  assert.match(profile, /await logout\(\)/);
});

test('RGPD — consentement analytics : bandeau, gating avant envoi, clés centralisées', () => {
  const analytics = read('src/lib/analytics.ts');
  const gate = analytics.indexOf('hasAnalyticsConsent()');
  const send = analytics.indexOf("fetch('/api/analytics/event'");
  assert.ok(gate > -1 && send > -1 && gate < send, 'le contrôle doit précéder l’envoi');
  const storage = read('src/lib/storage.ts');
  assert.match(storage, /analyticsConsent: 'cabba-consent-analytics'/);
  assert.match(storage, /assistantHistory: 'cabba-assistant-history'/);
  const consent = read('src/lib/consent.ts');
  assert.match(consent, /STORAGE_KEYS\.analyticsConsent/);
  assert.match(consent, /removeKey\(STORAGE_KEYS\.analyticsConsent\)/);
  const banner = read('src/components/ConsentBanner.tsx');
  assert.match(banner, /موافق/);
  assert.match(banner, /لا، شكراً/);
  const app = read('src/App.tsx');
  assert.match(app, /\{!showOnboarding && <ConsentBanner \/>\}/);
});

test('RGPD — analytics serveur : optionalAuth respecte token_version et deleted_at', () => {
  const router = read('server/api/analytics.ts');
  assert.match(router, /token_version/);
  assert.match(router, /deleted_at IS NULL/);
  assert.match(router, /expectedVersion/);
});

test('RGPD — rétention 90 jours bornée, par lots, avec job dédié', () => {
  const retention = read('scripts/analytics-retention.mts');
  assert.match(retention, /analytics_events/);
  assert.match(retention, /push_notification_log/);
  assert.match(retention, /ANALYTICS_RETENTION_DAYS/);
  assert.match(retention, /BATCH_SIZE/);
  assert.match(retention, /LIMIT \$2/);
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /dist\/retention\.cjs/);
  assert.ok(pkg.scripts.retention);
  assert.ok(exists('deploy/cloudrun-retention-job.yaml'));
});

/* ====================== AUTH UI & RÉSILIENCE ====================== */

test('auth UI — Login durci, AuthContext logout toujours nettoyant', () => {
  const login = read('src/components/auth/Login.tsx');
  assert.match(login, /autoComplete="email"/);
  assert.match(login, /autoComplete=\{isRegister \? 'new-password' : 'current-password'\}/);
  assert.match(login, /autoComplete="name"/);
  assert.match(login, /\.json\(\)\.catch\(/);
  assert.match(login, /instanceof TypeError/);
  assert.match(login, /MIN_PASSWORD_LENGTH = 12/);
  assert.match(login, /setPassword\(''\)/);
  assert.match(read('src/contexts/AuthContext.tsx'), /console\.error\('\[CABBA\] logout/);
});

test('résilience — ScreenErrorBoundary par écran + télémétrie consentie', () => {
  const boundary = read('src/components/ErrorBoundary.tsx');
  assert.match(boundary, /export class ScreenErrorBoundary/);
  assert.match(boundary, /track\('error'/);
  assert.match(boundary, /MAX_REPORT_LENGTH = 500/);
  const app = read('src/App.tsx');
  assert.match(app, /<ScreenErrorBoundary key=\{activeTab\}/);
  assert.match(app, /onHome=\{\(\) => setActiveTab\('home'\)\}/);
});

test('résilience — push : rollback d’abonnement, résultats au lieu d’exceptions', () => {
  const hook = read('src/hooks/usePushNotifications.ts');
  assert.match(hook, /createdHere/);
  assert.match(hook, /unsubscribe\(\)\.catch/);
  assert.match(hook, /Promise<PushActionResult>/);
  assert.match(hook, /track\('push_subscribed'\)/);
  assert.match(hook, /track\('push_unsubscribed'\)/);
  const notifications = read('server/notifications.ts');
  assert.match(notifications, /transientFailures/);
  assert.match(notifications, /DELETE FROM push_notification_log WHERE id=\$1/);
  assert.match(notifications, /statusCode === 404 \|\| error\?\.statusCode === 410/);
  assert.match(notifications, /timeout: DELIVERY_TIMEOUT_MS/);
});

test('résilience — worker football : erreur HTTP gérée, arrêt forcé 10 s, listeners bornés', () => {
  const worker = read('scripts/football-worker.mts');
  assert.match(worker, /healthServer\.on\('error'/);
  assert.match(worker, /unhandledRejection/);
  assert.match(worker, /10_000\)\.unref\(\)/);
  assert.match(worker, /main\(\)\.catch/);
  assert.doesNotMatch(worker, /^await /m);
  const events = read('server/football/events.ts');
  assert.doesNotMatch(events, /setMaxListeners\(0\);/);
  assert.match(events, /setMaxListeners\(\d{3,}\)/);
});

/* ========================= PERF & PWA ========================= */

test('perf — code splitting, deep-linking hash, coquille desktop', () => {
  const app = read('src/App.tsx');
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/MatchCenter'\)\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/admin\/AdminDashboard'\)\)/);
  assert.match(app, /import Home from '\.\/components\/Home'/);
  assert.match(app, /<Suspense/);
  assert.match(app, /window\.history\.pushState/);
  assert.match(app, /popstate/);
  assert.match(app, /hashchange/);
  assert.match(app, /md:max-w-6xl/);
  assert.match(app, /hidden md:flex/);
  assert.match(app, /md:hidden/);
  assert.match(app, /md:max-w-3xl/);
});

test('perf — vite : polyfill inline désactivé (CSP), SW versionné, vendor chunks', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /polyfill: false/);
  assert.match(vite, /cabba-sw-version/);
  assert.match(vite, /replaceAll\('__BUILD_ID__'/);
  assert.match(vite, /manualChunks/);
  assert.match(vite, /vendor-charts/);
  const sw = read('public/sw.js');
  assert.match(sw, /CACHE_VERSION = '__BUILD_ID__'/);
  assert.doesNotMatch(sw, /fonts\.googleapis\.com/);
  assert.doesNotMatch(sw, /fonts\.gstatic\.com/);
});

test('perf — SSE : pas d’orage de reconnexion, échecs bornés, pause onglet masqué', () => {
  const mc = read('src/components/MatchCenter.tsx');
  assert.match(mc, /selectedIdRef/);
  assert.doesNotMatch(mc, /\.join\('\|'\), selectedId\]/);
  assert.match(mc, /liveStreamKey/);
  assert.match(mc, /MAX_CONSECUTIVE_FAILURES/);
  assert.match(mc, /RETRY_DELAY_MS/);
  assert.match(mc, /visibilitychange/);
  assert.match(mc, /document\.hidden/);
  const live = read('src/components/LiveMatchUpdate.tsx');
  assert.match(live, /visibilitychange/);
  assert.match(live, /credentials: 'same-origin'/);
});

test('assets — icônes PWA, polices Cairo et onboarding auto-hébergés (binaires committés)', () => {
  for (const file of [
    'public/icon-192.png', 'public/icon-512.png',
    'public/fonts/cairo-arabic-400.woff2', 'public/fonts/cairo-arabic-600.woff2',
    'public/fonts/cairo-arabic-700.woff2', 'public/fonts/cairo-arabic-800.woff2',
    'public/fonts/cairo-arabic-900.woff2', 'public/fonts/cairo-latin-400.woff2',
    'public/fonts/cairo-latin-600.woff2', 'public/fonts/cairo-latin-700.woff2',
    'public/fonts/cairo-latin-800.woff2', 'public/fonts/cairo-latin-900.woff2',
    'public/onboarding/fan-card.jpg', 'public/onboarding/live-match.jpg', 'public/onboarding/community.jpg',
  ]) {
    assert.ok(exists(file), `${file} manquant`);
  }
  const manifest = JSON.parse(read('public/manifest.json'));
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));

  const html = read('index.html');
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(html, /cairo-arabic-400\.woff2/);

  const css = read('src/index.css');
  assert.match(css, /@font-face/);
  assert.match(css, /\/fonts\/cairo-arabic-400\.woff2/);
  assert.match(css, /font-display: swap/);

  const onboarding = read('src/components/OnboardingCarousel.tsx');
  assert.doesNotMatch(onboarding, /unsplash/i);
  assert.match(onboarding, /\/onboarding\/fan-card\.jpg/);
  assert.doesNotMatch(read('seed.ts'), /images\.unsplash\.com/i);
});

/* ====================== DONNÉES RÉELLES ====================== */

test('données — écrans câblés sur PostgreSQL, tableaux morts supprimés', () => {
  const home = read('src/components/Home.tsx');
  assert.match(home, /fetch\('\/api\/matches'/);
  assert.match(home, /fetch\('\/api\/news'/);
  assert.match(home, /Promise\.allSettled/);
  assert.match(home, /fetchTeamSummary/);
  assert.doesNotMatch(home, /no real backend news API/);
  assert.doesNotMatch(read('src/components/TeamStats.tsx'), /const data: any\[\] = \[\];/);
  assert.doesNotMatch(read('src/components/SeasonStats.tsx'), /const goalsByMatchData: any\[\] = \[\]/);
  assert.doesNotMatch(read('src/components/MatchStatsVisualization.tsx'), /const data: any\[\] = \[\];/);
});

test('données — agrégats CABBA côté serveur (team-summary, goals-by-minute)', () => {
  const football = read('server/api/football.ts');
  assert.match(football, /team-summary/);
  assert.match(football, /env\.apiFootballTeamId/);
  assert.match(football, /configured: false/);
  assert.match(football, /home_team_api_id = \$1 OR away_team_api_id = \$1/);
  assert.match(football, /goals-by-minute/);
  assert.match(football, /Missed Penalty/);
  assert.match(football, /Own Goal/);
  assert.match(football, /IS DISTINCT FROM/);
  assert.match(read('src/lib/teamSummary.ts'), /\/api\/football\/team-summary/);
  assert.match(read('src/components/SeasonStats.tsx'), /\/api\/football\/goals-by-minute/);
  assert.match(read('src/components/SeasonStats.tsx'), /MINUTE_BUCKETS/);
});

test('données — météo via proxy serveur, jamais open-meteo direct', () => {
  const widget = read('src/components/WeatherWidget.tsx');
  assert.doesNotMatch(widget, /v1\/forecast/);
  assert.match(widget, /fetch\('\/api\/weather'/);
  const proxy = read('server/api/weather.ts');
  assert.match(proxy, /api\.open-meteo\.com/);
  assert.match(proxy, /CACHE_TTL_MS/);
  assert.match(proxy, /inflight/);
});

test('données — profil : adhésion réelle (numéro + QR uniques), points réels', () => {
  const profile = read('src/components/Profile.tsx');
  assert.doesNotMatch(profile, />CABBA-8291-04</);
  assert.doesNotMatch(profile, /value=\"CABBA-FAN-847291\"/);
  assert.doesNotMatch(profile, /https:\/\/api\.dicebear\.com/i);
  assert.match(profile, /\/api\/memberships\/me/);
  assert.match(profile, /QRCodeSVG value=\{membership\.memberNumber\}/);
});

test('données — assistant : conversation persistée, historique Gemini normalisé', () => {
  const assistant = read('src/components/AiAssistant.tsx');
  assert.match(assistant, /STORAGE_KEYS\.assistantHistory/);
  assert.match(assistant, /readJSON/);
  assert.match(assistant, /writeJSON/);
  assert.match(assistant, /MAX_PERSISTED_MESSAGES = 40/);
  assert.match(assistant, /history\[0\]\.role !== 'user'/);
});

/* ==================== WORKER FOOTBALL (FUSEAU) ==================== */

test('sync — heure locale algérienne de bout en bout, URLs push en deep-link', () => {
  const sync = read('server/football/sync.ts');
  assert.match(sync, /PROVIDER_TIMEZONE = 'Africa\/Algiers'/);
  assert.match(sync, /timezone: PROVIDER_TIMEZONE/);
  assert.doesNotMatch(sync, /toISOString\(\)\.slice\(0, 10\)/);
  assert.match(sync, /literal\.slice\(11, 19\)/);
  assert.doesNotMatch(sync, /\?tab=match/);
  assert.match(sync, /url: '\/#\/match'/);
  assert.doesNotMatch(sync, /INSERT INTO football_sync_log/);
  const scheduler = read('server/football/scheduler.ts');
  assert.match(scheduler, /NOW\(\) AT TIME ZONE 'Africa\/Algiers'/);
  assert.match(scheduler, /url: '\/#\/match'/);
  assert.doesNotMatch(scheduler, /\?tab=match/);
});

test('sync — DELETE+INSERT atomiques, pushs après commit, quota honnête', () => {
  const sync = read('server/football/sync.ts');
  const eventsFn = sync.slice(sync.indexOf('export async function syncFixtureEvents'), sync.indexOf('export async function syncFixtureLineups'));
  assert.match(eventsFn, /withTransaction/);
  assert.ok(eventsFn.indexOf('withTransaction') < eventsFn.indexOf('broadcastPush'));
  const lineupsFn = sync.slice(sync.indexOf('export async function syncFixtureLineups'), sync.indexOf('async function saveLineup'));
  assert.match(lineupsFn, /withTransaction/);
  const standingsFn = sync.slice(sync.indexOf('export async function syncStandings'));
  assert.match(standingsFn, /withTransaction/);
  const client = read('server/football/client.ts');
  assert.match(client, /error instanceof TypeError/);
  assert.match(client, /usedToday = Math\.max\(0, usedToday - 1\)/);
});

/* ======================= ROUTES MÉTIER ======================= */

test('store — annulation restocke, ROLLBACK sûr, quota, emails de commande', () => {
  const store = read('server/api/store.ts');
  assert.match(store, /stock = p\.stock \+ oi\.quantity/);
  assert.match(store, /FOR UPDATE/);
  assert.match(store, /previousStatus !== 'delivered'/);
  assert.match(store, /ROLLBACK'\)\.catch\(/);
  assert.match(store, /keyPrefix: 'orders'/);
  assert.match(store, /order-created:/);
  assert.match(store, /order-status:/);
  assert.match(store, /NOTIFY_STATUSES/);
  const email = read('server/email.ts');
  assert.match(email, /'order'/);
  assert.match(email, /orderConfirmationEmail/);
  assert.match(email, /orderStatusEmail/);
  assert.match(email, /escapeHtml\(item\.name\)/);
  assert.match(email, /RESEND_TIMEOUT_MS/);
  assert.match(email, /signal: controller\.signal/);
  assert.match(email, /WHERE email_log\.status='failed'/);
  const ui = read('src/components/Store.tsx');
  assert.doesNotMatch(ui, /alert\('[^']*'\)/);
  assert.match(ui, /setNotice/);
  assert.match(ui, /role="status"/);
  assert.match(ui, /sm:grid-cols-3/);
});

test('communauté — avatar local, pagination cursor, quota UGC', () => {
  const community = read('server/api/community.ts');
  assert.doesNotMatch(community, /https:\/\/api\.dicebear\.com/i);
  assert.match(community, /data:image\/svg\+xml/);
  assert.match(community, /nextCursor/);
  assert.match(community, /\$2::timestamptz IS NULL OR p\.created_at < \$2::timestamptz/);
  assert.match(community, /keyPrefix: 'community-post'/);
  const fc = read('src/components/FanCommunity.tsx');
  assert.match(fc, /loadPosts/);
  assert.match(fc, /تحميل المزيد/);
  assert.doesNotMatch(fc, /alert\('[^']*'\)/);
  assert.match(fc, /if \(!currentUser\)/);
});

test('média — taille positive, quota presign, purge pending, client S3 mémoïsé', () => {
  const media = read('server/api/media.ts');
  assert.match(media, /Number\(size\) <= 0/);
  assert.match(media, /keyPrefix: 'media-presign'/);
  assert.match(media, /delete\('\/admin\/pending', requireAdmin/);
  assert.match(media, /Promise\.allSettled/);
  assert.match(read('server/media.ts'), /cachedClient/);
  const mu = read('src/components/MediaUploader.tsx');
  assert.match(mu, /image: 10 \* 1024 \* 1024/);
  assert.match(mu, /audio: 50 \* 1024 \* 1024/);
  assert.match(mu, /video: 250 \* 1024 \* 1024/);
  assert.match(mu, /isSafeHttpUrl/);
  assert.match(mu, /onBlur=\{commitUrl\}/);
});

test('push — plafond de 10 endpoints par compte', () => {
  const push = read('server/api/push.ts');
  assert.match(push, /NOT IN/);
  assert.match(push, /LIMIT 10/);
  assert.match(push, /ORDER BY updated_at DESC/);
});

test('CRUD admin — validation partagée, PATCH vidéo partiel, adhésions anti-collision', () => {
  const validate = read('server/api/validate.ts');
  assert.match(validate, /class ValidationError/);
  assert.match(validate, /title: 255/);
  assert.match(validate, /category: 100/);
  for (const router of ['news', 'videos', 'chants']) {
    assert.match(read(`server/api/${router}.ts`), /isValidationError/);
  }
  const videos = read('server/api/videos.ts');
  assert.doesNotMatch(videos, /, published \?\? true\]/);
  assert.match(videos, /if \(published !== undefined\)/);
  assert.match(videos, /keyPrefix: 'video-view'/);
  assert.match(read('server/api/chants.ts'), /keyPrefix: 'chant-view'/);
  const memberships = read('server/api/memberships.ts');
  assert.doesNotMatch(memberships, /Math\.random\(\)\*1_000_000\)\.toString\(\)/);
  assert.match(memberships, /randomInt\(0, 1_000_000\)/);
  assert.match(memberships, /memberships_member_number_key/);
  assert.match(memberships, /requireDateString/);
});

test('highlights — entrées bornées au schéma, lecteur adapté au type d’URL', () => {
  const matches = read('server/api/matches.ts');
  assert.match(matches, /requireDateString\(date, 'date'\)/);
  assert.match(matches, /requireHttpUrl\(requireString\(thumbnail, 'thumbnail', 1024\)/);
  const ui = read('src/components/MatchHighlights.tsx');
  assert.match(ui, /isEmbedUrl/);
  assert.match(ui, /referrerPolicy="strict-origin-when-cross-origin"/);
});

/* =================== FONCTIONNALITÉS SUPPORTERS =================== */

test('galerie — publications R2 persistées, likes serveur, quota', () => {
  assert.ok(migrations().some((f) => f.includes('fan_gallery')));
  const gallery = read('server/api/gallery.ts');
  assert.match(gallery, /status='uploaded' AND kind='image'/);
  assert.match(gallery, /owner_id=\$2/);
  assert.match(gallery, /ON CONFLICT \(media_id\) DO NOTHING/);
  assert.match(gallery, /FOR UPDATE/);
  assert.match(gallery, /publicMediaUrl\(row\.object_key\)/);
  assert.match(gallery, /keyPrefix: 'gallery-post'/);
  const ui = read('src/components/FanGallery.tsx');
  assert.match(ui, /\/api\/gallery\/posts/);
  assert.doesNotMatch(ui, /alert\('[^']*'\)/);
  assert.match(ui, /MAX_IMAGE_BYTES/);
});

test('pronostics — fenêtre de vote, upsert, classement sans comptes anonymisés', () => {
  assert.ok(migrations().some((f) => f.includes('match_predictions')));
  const predictions = read('server/api/predictions.ts');
  assert.match(predictions, /status !== 'scheduled'/);
  assert.match(predictions, /ON CONFLICT \(user_id, match_id\) DO UPDATE/);
  assert.match(predictions, /deleted_at IS NULL/);
  assert.match(predictions, /keyPrefix: 'prediction'/);
  const ui = read('src/components/MatchPredictions.tsx');
  assert.match(ui, /\/api\/predictions/);
  assert.doesNotMatch(ui, />النظام قيد التطوير</);
});

test('sondages — backend réel, vote anti-forge, admin branché', () => {
  assert.ok(migrations().some((f) => f.includes('fan_polls')));
  const polls = read('server/api/polls.ts');
  assert.match(polls, /withTransaction/);
  assert.match(polls, /ON CONFLICT \(poll_id, user_id\) DO UPDATE/);
  assert.match(polls, /id=\$1 AND poll_id=\$2/);
  assert.match(polls, /status !== 'open'/);
  assert.match(polls, /requireAdmin/);
  assert.match(read('src/components/FanPolls.tsx'), /fetch\('\/api\/polls'/);
  const admin = read('src/components/admin/AdminPolls.tsx');
  assert.match(admin, /\/close/);
  assert.match(admin, /MAX_OPTIONS = 5/);
  const dash = read('src/components/admin/AdminDashboard.tsx');
  assert.match(dash, /AdminPolls/);
  assert.match(dash, /key: 'memberships'/, 'l’entrée adhésions manquait : AdminMemberships était inaccessible');
  assert.doesNotMatch(dash, /alert\('[^']*'\)/);
  assert.doesNotMatch(dash, /className=\"[^\"]*min-h-screen/);
});

test('MVP — vote persisté, candidats issus des compositions réelles', () => {
  assert.ok(migrations().some((f) => f.includes('mvp')));
  const matches = read('server/api/matches.ts');
  assert.match(matches, /match_mvp_votes/);
  assert.match(matches, /starter = TRUE/);
  assert.match(matches, /ON CONFLICT \(match_id, user_id\) DO UPDATE/);
  assert.match(matches, /\['live', 'finished'\]/);
  const mvp = read('src/components/MatchMVP.tsx');
  assert.doesNotMatch(mvp, /alert\('[^']*'\)/);
  assert.match(mvp, /navigator\.clipboard\.writeText/);
  assert.match(mvp, /\/mvp\/vote/);
});

test('live — événements réels, résolution de match factorisée, alertes bornées', () => {
  const inGame = read('src/components/InGameNotifications.tsx');
  assert.doesNotMatch(inGame, /عن طريق ياسين/, 'le but inventé de l’ancien fil statique');
  assert.match(inGame, /\/center/);
  assert.match(read('src/lib/featuredMatch.ts'), /resolveFeaturedMatchId/);
  assert.match(read('src/components/MatchStatsVisualization.tsx'), /resolveFeaturedMatchId/);
  const alert = read('src/components/MatchAlert.tsx');
  assert.doesNotMatch(alert, /NOTIFICATIONS_UPDATED_EVENT/);
  assert.match(alert, /md:max-w-xl/);
});

test('réglages & favoris — 4 préférences sync serveur, updater pur', () => {
  const settings = read('src/components/NotificationSettings.tsx');
  assert.match(settings, /finalScores/);
  assert.match(settings, /syncPreferences/);
  assert.match(settings, /usePushNotifications/);
  assert.match(settings, /role="switch"/);
  assert.match(settings, /aria-checked=/);
  const favorites = read('src/hooks/useFavorites.ts');
  assert.match(favorites, /favoritesRef/);
  assert.match(favorites, /applyFavorites/);
  const syncBlock = favorites.slice(favorites.indexOf('const sync'), favorites.indexOf('const toggleFavorite'));
  assert.doesNotMatch(syncBlock, /writeJSON/);
  const chants = read('src/components/ChantsLibrary.tsx');
  assert.match(chants, /audioRef\.current\?\.pause\(\)/);
  assert.doesNotMatch(chants, /if \(audioElement\)/);
  assert.match(chants, /audio\.onended/);
  assert.match(chants, /encodeURIComponent\(chant\.id\)/);
  const tv = read('src/components/CabbaTv.tsx');
  assert.match(tv, /res\.ok \? res\.json\(\)/);
  assert.match(tv, /Array\.isArray\(data\?\.videos\)/);
  const users = read('src/components/admin/AdminUsers.tsx');
  assert.doesNotMatch(users, /alert\('[^']*'\)/);
  assert.match(users, /loadError/);
});

/* ========================= OPS & TESTS ========================= */

test('ops — vérification post-release et checklist de production présentes', () => {
  assert.ok(exists('deploy/verify-audit.sh'));
  const verify = read('deploy/verify-audit.sh');
  assert.match(verify, /VERIFY-AUDIT/);
  assert.match(verify, /__BUILD_ID__/);
  assert.match(verify, /team-summary/);
  assert.match(verify, /goals-by-minute/);
  assert.match(verify, /api\/polls/);
  assert.match(verify, /api\/gallery/);
  assert.match(verify, /api\/auth\/export/);
  assert.match(verify, /\/mvp/);
  assert.ok(exists('deploy/PRODUCTION_CHECKLIST.md'));
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:db'], /auth-register\.mts tests\/db\/auth-logout\.mts tests\/db\/auth-gdpr\.mts/);
  assert.ok(exists('tests/db/auth-logout.mts'));
  assert.ok(exists('tests/db/auth-gdpr.mts'));
});


test('récupération de mot de passe — jeton haché, usage unique, sessions révoquées', () => {
  assert.ok(migrations().some((f) => f.includes('password_reset')), 'migration 017 requise');

  const auth = read('server/auth.ts');
  assert.match(auth, /authRouter\.post\('\/forgot-password'/);
  assert.match(auth, /authRouter\.post\('\/reset-password'/);
  // Le jeton ne doit JAMAIS être stocké en clair.
  assert.match(auth, /createHash\('sha256'\)/);
  assert.match(auth, /randomBytes\(32\)/);
  assert.match(auth, /RESET_TOKEN_TTL_MINUTES = 30/);
  assert.match(auth, /used_at IS NULL AND expires_at > NOW\(\)/);
  // Réponse générique : la route ne révèle pas si l'adresse est inscrite.
  assert.match(auth, /const generic = \{ success: true \};/);
  // Le reset révoque toutes les sessions (cookie volé ne survit pas).
  assert.match(auth, /token_version = token_version \+ 1/);
  // HIBP s'applique aussi au nouveau mot de passe.
  assert.match(auth, /isPasswordCompromised/);

  const email = read('server/email.ts');
  assert.match(email, /passwordResetEmail/);
  assert.match(email, /'password_reset'/);

  const server = read('server.ts');
  assert.match(server, /app\.use\('\/api\/auth\/forgot-password', authRateLimit\)/);
  assert.match(server, /app\.use\('\/api\/auth\/reset-password', authRateLimit\)/);

  const login = read('src/components/auth/Login.tsx');
  assert.match(login, /نسيت كلمة المرور/);
  assert.match(login, /forgot-password/);
  assert.match(login, /enterForgotMode/);

  const app = read('src/App.tsx');
  assert.match(app, /isResetRoute/);
  assert.match(app, /<ResetPassword \/>/);

  assert.ok(exists('src/components/auth/ResetPassword.tsx'));
  const reset = read('src/components/auth/ResetPassword.tsx');
  assert.match(reset, /\/api\/auth\/reset-password/);
  assert.match(reset, /MIN_PASSWORD_LENGTH/);

  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:db'], /auth-reset\.mts/);
  assert.ok(exists('tests/db/auth-reset.mts'));
});

test('صندوق دعم النادي — campagne réelle administrable (bloc mort supprimé)', () => {
  assert.ok(migrations().some((f) => f.includes('support_fund')));
  const support = read('server/api/support.ts');
  assert.match(support, /support_campaigns/);
  assert.match(support, /support_donations/);
  assert.match(support, /requireAdmin/);
  assert.match(support, /COALESCE\(SUM\(amount_dzd\)/, 'le collecté est la somme du registre, jamais saisi à la main');
  const server = read('server.ts');
  assert.match(server, /app\.use\("\/api\/support", supportRouter\)/);
  const home = read('src/components/Home.tsx');
  assert.match(home, /\/api\/support\/campaign/);
  assert.doesNotMatch(home, /البيانات غير متوفرة حالياً/, 'le placeholder mort a disparu de l\'accueil');
  const dash = read('src/components/admin/AdminDashboard.tsx');
  assert.match(dash, /إدارة صندوق الدعم/);
  assert.ok(exists('src/components/admin/AdminSupport.tsx'));
});

test('مراقبة التذاكر الإلكترونية — scanneur mobile, usage unique, journal anti-fraude', () => {
  assert.ok(migrations().some((f) => f.includes('020_tickets')));
  const tickets = read('server/api/tickets.ts');
  assert.match(tickets, /status='used'/, 'verrou anti-double-entrée');
  assert.match(tickets, /ticket_scans/, 'journal de chaque passage');
  assert.match(tickets, /requireAdmin/);
  assert.match(tickets, /scanner/);
  const server = read('server.ts');
  assert.match(server, /app\.use\("\/api\/tickets", ticketsRouter\)/);
  const users = read('server/api/users.ts');
  assert.match(users, /'scanner'/, 'rôle agent de porte');
  const app = read('src/App.tsx');
  assert.match(app, /case 'scanner'/);
  const scan = read('src/components/TicketScanner.tsx');
  assert.match(scan, /BarcodeDetector/);
  assert.match(scan, /AudioContext/);
  assert.match(scan, /vibrate/);
  const dash = read('src/components/admin/AdminDashboard.tsx');
  assert.match(dash, /التذاكر والمراقبة/);
  assert.ok(exists('src/components/admin/AdminTickets.tsx'));
});

test('كاشف الرموز المدمج — repli jsQR vendorisé quand BarcodeDetector manque', () => {
  assert.ok(exists('src/lib/vendor/jsQR.esm.js'), 'décodeur QR vendorisé (MIT, module ES) dans le bundle');
  assert.ok(exists('src/lib/vendor/jsQR.esm.d.ts'), 'typage TS du module vendorisé');
  const scan = read('src/components/TicketScanner.tsx');
  assert.match(scan, /import jsQR from '..\/lib\/vendor\/jsQR.esm.js'/);
  assert.match(scan, /jsQR\(frame\.data/, 'boucle de décodage caméra image par image');
  assert.match(scan, /hasNativeDetector/, 'voie native conservée quand disponible');
  assert.doesNotMatch(scan, /متصفحك لا يملك كاشف رموز/, 'plus aucun navigateur bloqué sans détecteur natif');
});
