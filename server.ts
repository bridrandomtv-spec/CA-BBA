import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import cookieParser from "cookie-parser";
// env doit être importé avant tout module qui lit process.env : c'est lui qui
// appelle dotenv.config() et qui arrête le processus si la config est invalide.
import { env } from "./server/env.js";
import { authRouter } from "./server/auth.js";

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
import { startFootballScheduler, stopFootballScheduler } from "./server/football/scheduler.js";
import { pool, query } from "./server/db/index.js";
import { createRateLimiter, requestId, securityHeaders } from "./server/security.js";

const app = express();
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

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
// d'environnement PORT. Le 3000 codé en dur empêchait tout démarrage en ligne.
const PORT = env.port;
const HOST = env.host;

const GEMINI_API_KEY = env.geminiApiKey;

app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(cookieParser());
app.use('/api', apiRateLimit);
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
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


const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY ?? "" });

const SYSTEM_INSTRUCTION = `أنت مساعد ذكي مخصص لأنصار نادي شباب أهلي برج بوعريريج (CABBA).
تتحدث باللغة العربية بطلاقة، ويمكنك التحدث باللهجة الجزائرية إذا لزم الأمر.
مهمتك هي مساعدة الأنصار في كتابة منشورات لدعم الفريق، اقتراح شعارات (Slogans)، وتوليد أفكار لمساندة النادي في أزمته المالية والرياضية.
ألوان الفريق هي الأصفر والأسود (الجراد الأصفر). كن دائمًا إيجابيًا وحماسيًا!`;

/** Nombre maximal de tours conservés, pour borner la taille du contexte envoyé. */
const MAX_HISTORY_TURNS = 20;

interface ClientMessage {
  role?: unknown;
  text?: unknown;
}

/**
 * Convertit l'historique du client vers le format attendu par le SDK Gemini.
 *
 * L'ancienne version parcourait `history` dans une boucle vide : l'assistant
 * repartait donc de zéro à chaque message et ne pouvait pas suivre une
 * conversation ("et lui ?", "reformule", etc.).
 */
function toGeminiHistory(history: unknown) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((entry): entry is ClientMessage => typeof entry === "object" && entry !== null)
    .filter((entry) => typeof entry.text === "string" && (entry.text as string).trim().length > 0)
    .map((entry) => ({
      // Le SDK attend "model" là où le client utilise "ai".
      role: entry.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: entry.text as string }],
    }))
    .slice(-MAX_HISTORY_TURNS);
}

const chatRate = new Map<string, { count: number; resetAt: number }>();
const CHAT_WINDOW_MS = 60_000;
const CHAT_LIMIT = 10;

app.post("/api/chat", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = chatRate.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    chatRate.set(ip, { count: 1, resetAt: now + CHAT_WINDOW_MS });
  } else if (bucket.count >= CHAT_LIMIT) {
    res.status(429).json({ error: "Trop de requêtes. Réessayez dans une minute." });
    return;
  } else {
    bucket.count += 1;
  }

  try {
    const { message, history } = req.body ?? {};

    // On envoie puis on sort, sans `return res.…` : les types d'Express 5
    // attendent `void | Promise<void>` et refusent un handler qui renvoie `res`.
    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
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

// Liveness : ne dépend pas de PostgreSQL. L'hébergeur peut redémarrer le
// processus uniquement si le serveur lui-même ne répond plus.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', geminiConfigured: Boolean(GEMINI_API_KEY) });
});

// Readiness : vérifie la dépendance critique PostgreSQL avant d'envoyer du
// trafic à une instance qui ne pourra pas traiter les requêtes métier.
app.get('/api/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready', database: 'ok' });
  } catch (error) {
    console.error('[CABBA] readiness database check failed:', error instanceof Error ? error.message : error);
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

// Les routes API inconnues renvoient du JSON, tandis que les routes front sont
// prises en charge par le fallback SPA plus bas.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import dynamique : avec un import statique, esbuild produit un `require("vite")`
    // en tête de dist/server.cjs, ce qui obligeait à installer Vite (un outil de
    // build) sur le serveur de production, y compris avec `npm ci --omit=dev`.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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
