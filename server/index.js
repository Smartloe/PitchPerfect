import dotenv from "dotenv";
import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

dotenv.config({ path: ".env.local" });
dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const API_URL = "https://api.longcat.chat/openai/v1/chat/completions";
const API_KEY = process.env.LONGCAT_API_KEY;

const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const rateStore = new Map();
const tokenStore = new Map();

const DATA_DIR = path.resolve("server", "data");
const MEMORY_DIR = path.resolve("server", "memory");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

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

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadUsers() {
  await ensureDir(DATA_DIR);
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return { users: [] };
  }
}

async function saveUsers(payload) {
  await ensureDir(DATA_DIR);
  await fs.writeFile(USERS_FILE, JSON.stringify(payload, null, 2), "utf8");
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
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safeUsername) {
    throw new Error("Invalid username");
  }
  const userDir = path.join(MEMORY_DIR, safeUsername);
  await ensureDir(userDir);
  const ledgerPath = path.join(userDir, "ledger.md");
  const summaryPath = path.join(userDir, "persistent-memory.md");
  const timestamp = new Date().toISOString();

  const ledgerBlock = `\n## ${timestamp} ${title}\n${ledger}\n`;
  await fs.appendFile(ledgerPath, ledgerBlock, "utf8");

  const summary = await summarizeMemory(summarySource);
  const summaryLines = summary
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const summaryBlock = summaryLines.length
    ? summaryLines.map((line) => `- ${timestamp} ${line}`).join("\n") + "\n"
    : `- ${timestamp} ${summary || "新增对话记忆"}\n`;
  await fs.appendFile(summaryPath, summaryBlock, "utf8");
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
      const data = await loadUsers();
      if (data.users.some((user) => user.username === username)) {
        sendJson(res, 409, { error: "用户名已存在" });
        return;
      }
      const salt = crypto.randomBytes(8).toString("hex");
      const passwordHash = hashPassword(password, salt);
      data.users.push({ username, salt, passwordHash, createdAt: Date.now() });
      await saveUsers(data);
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
      const data = await loadUsers();
      const user = data.users.find((item) => item.username === username);
      if (!user) {
        sendJson(res, 401, { error: "账号或密码错误" });
        return;
      }
      const passwordHash = hashPassword(password, user.salt);
      if (passwordHash !== user.passwordHash) {
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

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    sendJson(res, 500, { error: "Server Error" });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
