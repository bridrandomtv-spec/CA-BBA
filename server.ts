import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import cookieParser from "cookie-parser";
// env doit être importé avant tout module qui lit process.env : c'est lui qui
// appelle dotenv.config() et qui arrête le processus si la config est invalide.
import { env } from "./server/env.js";
import { authRouter, requireAuth } from "./server/auth.js";

import { newsRouter } from "./server/api/news.js";
import { videosRouter } from "./server/api/videos.js";
import { chantsRouter } from "./server/api/chants.js";
import { matchesRouter } from "./server/api/matches.js";
import { storeRouter } from "./server/api/store.js";
import { communityRouter } from "./server/api/community.js";
import { membershipsRouter } from "./server/api/memberships.js";
import { usersRouter } from "./server/api/users.js";
import { footballRouter } from "./server/api/football.js";
import { pushRouter } from "./server/api/push.js";
import { mediaRouter } from "./server/api/media.js";
import { emailRouter } from "./server/api/email.js";
import { analyticsRouter } from "./server/api/analytics.js";
import { weatherRouter } from "./server/api/weather.js";
import { galleryRouter } from "./server/api/gallery.js";
import { predictionsRouter } from "./server/api/predictions.js";
import { pollsRouter } from "./server/api/polls.js";
import { supportRouter } from "./server/api/support.js";
import { ticketsRouter } from "./server/api/tickets.js";
import { accountingRouter } from "./server/api/accounting.js";
import { sponsorsRouter } from "./server/api/sponsors.js";
import { startFootballScheduler, stopFootballScheduler } from "./server/football/scheduler.js";
import { pool, query } from "./server/db/index.js";
import { requestId, securityHeaders } from "./server/security.js";
// Limiteur à backend Redis optionnel (repli mémoire automatique) : même
// signature que createRateLimiter de security.ts.
import { createRateLimiter } from "./server/rateLimit.js";

const app = express();
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

app.param('id', (req, res, next, id) => {
  // Versions 1 à 7 acceptées : gen_random_uuid() produit des v4, mais les
  // UUID v7 (horodatés) se généralisent — la regex d'origine les rejetait.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid UUID format' });
    return;
  }
  next();
});

app.use(requestId);
app.use(securityHeaders);

const apiRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 120,
  message: 'Trop de requêtes. Réessayez dans une minute.',
  keyPrefix: 'api',
});
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 20,
  message: 'Trop de tentatives d’authentification. Réessayez plus tard.',
  keyPrefix: 'auth',
});
// Cloud Run (et la plupart des hébergeurs) imposent le port via la variable
// d'environnement PORT.
const PORT = env.port;
const HOST = env.host;

const GEMINI_API_KEY = env.geminiApiKey;

// Repli galerie sans R2 : les photos compressées côté client arrivent en
// data-URL jusqu'à 500 Ko — au-delà du parseur global 128 Ko. Parseur dédié
// monté AVANT le global, qui ignorera ces corps déjà lus (req._body).
app.use('/api/gallery', express.json({ limit: '600kb' }));
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(cookieParser());
app.use('/api', apiRateLimit);
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
// La récupération de mot de passe est un vecteur classique de bombardement
// d'emails et d'énumération de comptes : même quota que login/register.
app.use('/api/auth/forgot-password', authRateLimit);
app.use('/api/auth/reset-password', authRateLimit);
app.use('/api/auth', authRouter);

app.use("/api/news", newsRouter);
app.use("/api/videos", videosRouter);
app.use("/api/chants", chantsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/store", storeRouter);
app.use("/api/community", communityRouter);
app.use("/api/memberships", membershipsRouter);
app.use("/api/users", usersRouter);
app.use("/api/football", footballRouter);
app.use("/api/push", pushRouter);
app.use("/api/media", mediaRouter);
app.use("/api/email", emailRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/weather", weatherRouter);
app.use("/api/gallery", galleryRouter);
app.use("/api/predictions", predictionsRouter);
app.use("/api/polls", pollsRouter);
app.use("/api/support", supportRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/accounting", accountingRouter);
app.use("/api/sponsors", sponsorsRouter);

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY ?? "" });

const SYSTEM_INSTRUCTION = `أنت مساعد ذكي مخصص لأنصار نادي شباب أهلي برج بوعريريج (CABBA).
تتحدث باللغة العربية بطلاقة، ويمكنك التحدث باللهجة الجزائرية إذا لزم الأمر.
مهمتك هي مساعدة الأنصار في كتابة منشورات لدعم الفريق، اقتراح شعارات (Slogans)، وتوليد أفكار لمساندة النادي في أزمته المالية والرياضية.
ألوان الفريق هي الأصفر والأسود (الجراد الأصفر). كن دائمًا إيجابيًا ومتحمسًا!`;

/** Nombre maximal de tours conservés, pour borner la taille du contexte envoyé. */
const MAX_HISTORY_TURNS = 20;

/**
 * Longueur maximale d'un message (et de chaque tour d'historique).
 * Sans cette borne, un client pouvait envoyer des dizaines de milliers de
 * caractères par requête et consumer le quota Gemini à moindre coût.
 */
const MAX_MESSAGE_LENGTH = 2_000;

interface ClientMessage {
  role?: unknown;
  text?: unknown;
}

/**
 * Convertit l'historique du client vers le format attendu par le SDK Gemini.
 * Chaque texte est tronqué à MAX_MESSAGE_LENGTH : l'historique vient du
 * navigateur, il est donc aussi peu fiable que le message courant.
 */
function toGeminiHistory(history: unknown) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((entry): entry is ClientMessage => typeof entry === "object" && entry !== null)
    .filter((entry) => typeof entry.text === "string" && (entry.text as string).trim().length > 0)
    .map((entry) => ({
      // Le SDK attend "model" là où le client utilise "ai".
      role: entry.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: (entry.text as string).slice(0, MAX_MESSAGE_LENGTH) }],
    }))
    .slice(-MAX_HISTORY_TURNS);
}

// Quota Gemini par COMPTE, pas par IP : derrière un NAT (campus, réseau
// mobile), des dizaines de supporters partageraient le même compartiment.
const chatRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 10,
  message: 'Trop de requêtes. Réessayez dans une minute.',
  keyPrefix: 'chat',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

// requireAuth AVANT le limiteur : les anonymes reçoivent 401 sans consommer
// de compartiment, et la keyFn voit req.user. L'assistant n'est plus une
// pompe à quota Gemini ouverte à toute IP jetable.
app.post("/api/chat", requireAuth, chatRateLimit, async (req, res) => {
  try {
    const { message, history } = req.body ?? {};

    // On envoie puis on sort, sans `return res.…` : les types d'Express 5
    // attendent `void | Promise<void>` et refusent un handler qui renvoie `res`.
    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: "الرسالة طويلة جداً." });
      return;
    }

    if (!GEMINI_API_KEY) {
      res.status(503).json({ error: "خدمة المساعد غير مهيأة حالياً." });
      return;
    }

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history: toGeminiHistory(history),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    const response = await chat.sendMessage({ message });

    res.json({ text: response.text });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "فشل في الاتصال بالذكاء الاصطناعي." });
  }
});

// Liveness : ne dépend pas de PostgreSQL.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', geminiConfigured: Boolean(GEMINI_API_KEY) });
});

// Readiness : vérifie la dépendance critique PostgreSQL.
app.get('/api/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready', database: 'ok' });
  } catch (error) {
    console.error('[CABBA] readiness database check failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

// Les routes API inconnues renvoient du JSON ; les routes front sont prises
// en charge par le fallback SPA plus bas.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import dynamique : avec un import statique, esbuild produit un
    // `require("vite")` en tête de dist/server.cjs, ce qui obligerait à
    // installer Vite sur le serveur de production.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use((req, res, next) => {
      if (req.path.endsWith('.cjs') || req.path.endsWith('.cjs.map')) {
        res.status(404).end();
        return;
      }
      next();
    });

    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (env.footballSchedulerEnabled) {
      startFootballScheduler();
    } else {
      console.log('[CABBA] API-Football scheduler disabled for this web instance; use the football worker.');
    }
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[CABBA] arrêt demandé (${signal})`);
    stopFootballScheduler();
    server.close(() => {
      void pool.end().then(() => {
        console.log('[CABBA] arrêt propre terminé.');
        process.exit(0);
      }).catch((error) => {
        console.error('[CABBA] erreur fermeture PostgreSQL:', error);
        process.exit(1);
      });
    });
    setTimeout(() => {
      console.error('[CABBA] arrêt forcé après délai de grâce.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  console.error('[CABBA] impossible de démarrer le serveur :', error);
  process.exit(1);
});
