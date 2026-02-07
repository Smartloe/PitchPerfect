import dotenv from "dotenv";
import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const API_URL = "https://api.longcat.chat/openai/v1/chat/completions";
const API_KEY = process.env.LONGCAT_API_KEY;

const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const rateStore = new Map();
const tokenStore = new Map();

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DB_HOST = process.env.PGHOST || "127.0.0.1";
const DB_PORT = Number(process.env.PGPORT || 5432);
const DB_USER = process.env.PGUSER || "postgres";
const DB_PASSWORD = process.env.PGPASSWORD || "12345678";
const DB_NAME = process.env.PGDATABASE || "postgres";

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

function applyRateLimit(ip) {
  const now = Date.now();
  const entry = rateStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(32) UNIQUE NOT NULL,
      salt VARCHAR(64) NOT NULL,
      password_hash VARCHAR(128) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(32) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      title TEXT NOT NULL,
      ledger TEXT NOT NULL,
      summary_source TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS script_generations (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(32) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      question TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      suggestion JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_scripts (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(32) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      question TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      suggestion JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drill_scores (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(32) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      feedback TEXT NOT NULL DEFAULT '',
      highlight TEXT NOT NULL DEFAULT '',
      improve TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      product_id TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_script_generations_user_created_at ON script_generations(username, created_at DESC)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_saved_scripts_user_created_at ON saved_scripts(username, created_at DESC)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_drill_scores_user_created_at ON drill_scores(username, created_at DESC)"
  );
}

function hashPassword(password, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${password}`)
    .digest("hex");
}

function createToken(username) {
  const token = crypto.randomBytes(24).toString("hex");
  tokenStore.set(token, { username, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const record = tokenStore.get(token);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    tokenStore.delete(token);
    return null;
  }
  return record.username;
}

async function appendMemory(username, title, ledger, summarySource) {
  const summary = await summarizeMemory(summarySource);
  await pool.query(
    `INSERT INTO memory_entries (username, title, ledger, summary_source, summary)
     VALUES ($1, $2, $3, $4, $5)`,
    [username, title, ledger, summarySource, summary]
  );
}

function normalizeGrowthRecord(row) {
  return {
    id: String(row.id),
    createdAt: new Date(row.created_at).toISOString(),
    snapshot: row.snapshot,
    question: row.question,
    suggestion: row.suggestion
  };
}

async function saveScriptGeneration(username, payload) {
  const question = String(payload?.question || "").trim();
  const snapshot = payload?.snapshot;
  const suggestion = payload?.suggestion;
  if (!question) {
    throw new Error("question不能为空");
  }
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("snapshot无效");
  }
  if (!suggestion || typeof suggestion !== "object") {
    throw new Error("suggestion无效");
  }
  await pool.query(
    `INSERT INTO script_generations (username, question, snapshot, suggestion)
     VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
    [username, question, JSON.stringify(snapshot), JSON.stringify(suggestion)]
  );
}

async function saveSavedScript(username, payload) {
  const question = String(payload?.question || "").trim();
  const snapshot = payload?.snapshot;
  const suggestion = payload?.suggestion;
  if (!question) {
    throw new Error("question不能为空");
  }
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("snapshot无效");
  }
  if (!suggestion || typeof suggestion !== "object") {
    throw new Error("suggestion无效");
  }
  await pool.query(
    `INSERT INTO saved_scripts (username, question, snapshot, suggestion)
     VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
    [username, question, JSON.stringify(snapshot), JSON.stringify(suggestion)]
  );
}

async function saveDrillScore(username, payload) {
  const question = String(payload?.question || "").trim();
  const answer = String(payload?.answer || "").trim();
  const score = Number(payload?.score);
  const feedback = String(payload?.feedback || "").trim();
  const highlight = String(payload?.highlight || "").trim();
  const improve = String(payload?.improve || "").trim();
  const industry = String(payload?.industry || "").trim();
  const productId = String(payload?.productId || "").trim();

  if (!question) {
    throw new Error("question不能为空");
  }
  if (!answer) {
    throw new Error("answer不能为空");
  }
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("score必须是0-100");
  }

  await pool.query(
    `INSERT INTO drill_scores (
      username, question, answer, score, feedback, highlight, improve, industry, product_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      username,
      question,
      answer,
      Math.round(score),
      feedback,
      highlight,
      improve,
      industry,
      productId
    ]
  );
}

async function loadGrowthSnapshot(username) {
  const [historyResult, savedResult, statsResult] = await Promise.all([
    pool.query(
      `SELECT id, question, snapshot, suggestion, created_at
       FROM script_generations
       WHERE username = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [username]
    ),
    pool.query(
      `SELECT id, question, snapshot, suggestion, created_at
       FROM saved_scripts
       WHERE username = $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [username]
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM script_generations WHERE username = $1) AS total_generations,
         (SELECT COUNT(*)::int FROM saved_scripts WHERE username = $1) AS total_saved_scripts,
         (SELECT COUNT(*)::int FROM drill_scores WHERE username = $1) AS drill_score_count,
         (SELECT COALESCE(ROUND(AVG(score)), 0)::int FROM drill_scores WHERE username = $1) AS drill_average_score`,
      [username]
    )
  ]);

  const statsRow = statsResult.rows[0] || {
    total_generations: 0,
    total_saved_scripts: 0,
    drill_score_count: 0,
    drill_average_score: 0
  };

  return {
    history: historyResult.rows.map(normalizeGrowthRecord),
    savedScripts: savedResult.rows.map(normalizeGrowthRecord),
    stats: {
      totalGenerations: Number(statsRow.total_generations || 0),
      totalSavedScripts: Number(statsRow.total_saved_scripts || 0),
      drillScoreCount: Number(statsRow.drill_score_count || 0),
      drillAverageScore: Number(statsRow.drill_average_score || 0)
    }
  };
}

function fallbackSummary(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

async function summarizeMemory(text) {
  if (!API_KEY) {
    return fallbackSummary(text);
  }
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "LongCat-Flash-Chat",
        messages: [
          {
            role: "system",
            content:
              "你是记忆整理助手。请把输入内容精炼为 1-2 条可长期记忆要点，输出纯文本，每条不超过 20 字。"
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });
    if (!response.ok) {
      return fallbackSummary(text);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : fallbackSummary(text);
  } catch (error) {
    return fallbackSummary(text);
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": req.headers.origin || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    });
    res.end();
    return;
  }

  const pathname = requestUrl.pathname;

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const ip = getClientIp(req);
  if (!applyRateLimit(ip)) {
    sendJson(res, 429, { error: "Too Many Requests" });
    return;
  }

  try {
    if (pathname === "/api/chat") {
      if (!API_KEY) {
        sendJson(res, 500, { error: "Missing LONGCAT_API_KEY" });
        return;
      }
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const body = await readJson(req);
      const { messages, model } = body || {};
      if (!Array.isArray(messages)) {
        sendJson(res, 400, { error: "messages must be an array" });
        return;
      }

      const stream = Boolean(body?.stream);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model || "LongCat-Flash-Chat",
          messages,
          stream
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        sendJson(res, response.status, {
          error: errorText || "Upstream error",
          upstream_status: response.status
        });
        return;
      }

      if (stream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        });
        const reader = response.body?.getReader();
        if (!reader) {
          res.end();
          return;
        }
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
        return;
      }

      const data = await response.json();
      sendJson(res, 200, data);
      return;
    }

    if (pathname === "/api/auth/register") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const body = await readJson(req);
      const username = String(body?.username || "").trim();
      const password = String(body?.password || "");
      if (!USERNAME_PATTERN.test(username)) {
        sendJson(res, 400, { error: "用户名需为3-16位字母数字或下划线" });
        return;
      }
      if (password.length < 6) {
        sendJson(res, 400, { error: "密码至少6位" });
        return;
      }
      const existingResult = await pool.query(
        "SELECT 1 FROM users WHERE username = $1 LIMIT 1",
        [username]
      );
      if (existingResult.rowCount > 0) {
        sendJson(res, 409, { error: "用户名已存在" });
        return;
      }
      const salt = crypto.randomBytes(8).toString("hex");
      const passwordHash = hashPassword(password, salt);
      await pool.query(
        `INSERT INTO users (username, salt, password_hash)
         VALUES ($1, $2, $3)`,
        [username, salt, passwordHash]
      );
      const token = createToken(username);
      sendJson(res, 200, { token, username });
      return;
    }

    if (pathname === "/api/auth/login") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const body = await readJson(req);
      const username = String(body?.username || "").trim();
      const password = String(body?.password || "");
      const userResult = await pool.query(
        "SELECT username, salt, password_hash FROM users WHERE username = $1 LIMIT 1",
        [username]
      );
      if (userResult.rowCount === 0) {
        sendJson(res, 401, { error: "账号或密码错误" });
        return;
      }
      const user = userResult.rows[0];
      const passwordHash = hashPassword(password, user.salt);
      if (passwordHash !== user.password_hash) {
        sendJson(res, 401, { error: "账号或密码错误" });
        return;
      }
      const token = createToken(username);
      sendJson(res, 200, { token, username });
      return;
    }

    if (pathname === "/api/memory") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const username = getUserFromToken(req);
      if (!username) {
        sendJson(res, 401, { error: "未授权" });
        return;
      }
      const body = await readJson(req);
      const title = String(body?.title || "对话记录");
      const ledger = String(body?.ledger || "").trim();
      const summarySource = String(body?.summarySource || "").trim();
      if (!ledger) {
        sendJson(res, 400, { error: "ledger不能为空" });
        return;
      }
      await appendMemory(username, title, ledger, summarySource || ledger);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/growth/snapshot") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const username = getUserFromToken(req);
      if (!username) {
        sendJson(res, 401, { error: "未授权" });
        return;
      }
      const snapshot = await loadGrowthSnapshot(username);
      sendJson(res, 200, snapshot);
      return;
    }

    if (pathname === "/api/growth/script-generation") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const username = getUserFromToken(req);
      if (!username) {
        sendJson(res, 401, { error: "未授权" });
        return;
      }
      const body = await readJson(req);
      try {
        await saveScriptGeneration(username, body);
      } catch (error) {
        const message = error instanceof Error ? error.message : "参数错误";
        sendJson(res, 400, { error: message });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/growth/saved-script") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const username = getUserFromToken(req);
      if (!username) {
        sendJson(res, 401, { error: "未授权" });
        return;
      }
      const body = await readJson(req);
      try {
        await saveSavedScript(username, body);
      } catch (error) {
        const message = error instanceof Error ? error.message : "参数错误";
        sendJson(res, 400, { error: message });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/growth/drill-score") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      const username = getUserFromToken(req);
      if (!username) {
        sendJson(res, 401, { error: "未授权" });
        return;
      }
      const body = await readJson(req);
      try {
        await saveDrillScore(username, body);
      } catch (error) {
        const message = error instanceof Error ? error.message : "参数错误";
        sendJson(res, 400, { error: message });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    console.error("Server error:", error);
    sendJson(res, 500, { error: "Server Error" });
  }
});

async function startServer() {
  await initDatabase();
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(
      `PostgreSQL connected: ${DB_HOST}:${DB_PORT}/${DB_NAME} (user: ${DB_USER})`
    );
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
