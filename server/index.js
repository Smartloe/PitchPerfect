import dotenv from "dotenv";
import http from "node:http";
import { URL } from "node:url";

dotenv.config({ path: ".env.local" });
dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const API_URL = "https://api.longcat.chat/openai/v1/chat/completions";
const API_KEY = process.env.LONGCAT_API_KEY;

const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const rateStore = new Map();

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

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": req.headers.origin || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
    res.end();
    return;
  }

  if (requestUrl.pathname !== "/api/chat") {
    sendJson(res, 404, { error: "Not Found" });
    return;
  }

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (!API_KEY) {
    sendJson(res, 500, { error: "Missing LONGCAT_API_KEY" });
    return;
  }

  const ip = getClientIp(req);
  if (!applyRateLimit(ip)) {
    sendJson(res, 429, { error: "Too Many Requests" });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const body = await readJson(req);
    const { messages, model } = body || {};
    if (!Array.isArray(messages)) {
      sendJson(res, 400, { error: "messages must be an array" });
      return;
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || "LongCat-Flash-Chat",
        messages,
        stream: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, {
        error: data?.error?.message || "Upstream error",
        upstream_status: response.status
      });
      return;
    }

    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, { error: "Server Error" });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
