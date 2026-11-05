"use strict";
const crypto = require("node:crypto");
const { clean } = require("./tracking-store");
const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
function configured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    String(process.env.ADMIN_DASHBOARD_SECRET || "").length >= 32 &&
    process.env.TURNSTILE_SECRET_KEY &&
    process.env.TURNSTILE_SITE_KEY,
  );
}
async function db(path, method = "GET", body, prefer) {
  if (!configured())
    throw fail(503, "Chat is not configured yet. Please use our contact form.");
  const response = await fetch(
    String(process.env.SUPABASE_URL).replace(/\/$/, "") + "/rest/v1/" + path,
    {
      method,
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: prefer || "return=representation",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok)
    throw fail(
      503,
      "Chat database is unavailable. Please use our contact form.",
    );
  return response.status === 204 ? null : response.json();
}
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function token(req) {
  const match = String(req.headers.authorization || "").match(
    /^Bearer ([a-f0-9]{64})$/,
  );
  return match ? match[1] : "";
}
function sessionId(req) {
  return String(req.headers["x-chat-session"] || "");
}
async function visitor(req) {
  const id = sessionId(req),
    secret = token(req);
  if (!uuid(id) || !secret)
    throw fail(401, "Your chat session could not be verified.");
  const rows = await db(
    "chat_conversations?id=eq." +
      id +
      "&token_hash=eq." +
      hash(secret) +
      "&select=id,status,intake_state",
  );
  if (!rows.length) throw fail(401, "Your chat session could not be verified.");
  return rows[0];
}
async function settings() {
  const rows = await db(
    "chat_settings?select=enabled,available_until&id=eq.true",
  );
  if (!rows.length) throw fail(503, "Chat setup is incomplete.");
  return rows[0];
}
async function rate(req, kind, limit, seconds) {
  const ip = String(
    req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown",
  )
    .split(",")[0]
    .trim();
  const key =
    kind +
    ":" +
    crypto
      .createHmac("sha256", process.env.ADMIN_DASHBOARD_SECRET)
      .update(ip)
      .digest("hex");
  if (
    !(await db("rpc/sendora_chat_rate_limit", "POST", {
      p_key: key,
      p_limit: limit,
      p_seconds: seconds,
    }))
  )
    throw fail(429, "Too many requests. Please wait a moment and try again.");
}
function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin || req.headers.referer || "");
    const host = String(req.headers.host || "").toLowerCase();
    return (
      origin.protocol === "https:" &&
      (origin.host.toLowerCase() === host ||
        (["sendoragift.com", "www.sendoragift.com"].includes(origin.host) &&
          ["sendoragift.com", "www.sendoragift.com"].includes(host)))
    );
  } catch (_) {
    return false;
  }
}
async function verifyChallenge(req, value) {
  if (!value) throw fail(400, "Please complete the security check.");
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: String(value).slice(0, 2048),
      }),
      signal: AbortSignal.timeout(12000),
    },
  );
  const data = await result.json();
  if (
    !data.success ||
    data.action !== "sendora_chat" ||
    ![
      "sendoragift.com",
      "www.sendoragift.com",
      String(req.headers.host || "").split(":")[0],
    ].includes(data.hostname)
  )
    throw fail(400, "Security check expired. Please try again.");
}
function context(req, body) {
  const result = {};
  for (const field of [
    "current_page",
    "first_landing_page",
    "source_type",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "page_history",
  ])
    result[field] = clean(body[field], field === "page_history" ? 2000 : 600);
  result.country = clean(req.headers["x-vercel-ip-country"], 8);
  result.language = clean(body.language, 50);
  return result;
}
async function start(req, body) {
  const id = sessionId(req),
    secret = token(req);
  if (!uuid(id) || !secret) throw fail(400, "Invalid chat session.");
  const existing = await db(
    "chat_conversations?id=eq." +
      id +
      "&token_hash=eq." +
      hash(secret) +
      "&select=id",
  );
  if (existing.length) return existing[0];
  const email = clean(body.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw fail(400, "Please enter a valid email address.");
  await rate(req, "start", 8, 3600);
  await verifyChallenge(req, body.challenge);
  const record = {
    id,
    token_hash: hash(secret),
    email,
    context: context(req, body.context || {}),
  };
  for (const field of [
    "name",
    "company",
    "product",
    "quantity",
    "destination",
    "deadline",
  ])
    record[field] = clean(body[field], 160);
  const rows = await db(
    "chat_conversations?on_conflict=id",
    "POST",
    record,
    "resolution=ignore-duplicates,return=representation",
  );
  if (!rows.length) return visitor(req);
  return { id };
}
async function messages(id, after) {
  const cursor = String(after || "0");
  if (!/^\d{1,15}$/.test(cursor)) throw fail(400, "Invalid message cursor.");
  return db(
    "chat_messages?conversation_id=eq." +
      id +
      "&seq=gt." +
      cursor +
      "&select=seq,role,content,client_id,created_at&order=seq.asc&limit=100",
  );
}
async function updateProfile(id, body) {
  const patch = {};
  const email = clean(body.email, 254);
  const name = clean(body.name, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw fail(400, "Please enter a valid email address.");
  if (email) patch.email = email;
  if (name) patch.name = name;
  if (!Object.keys(patch).length)
    throw fail(400, "Add a name or email, or continue chatting without it.");
  await db("chat_conversations?id=eq." + id, "PATCH", patch);
}
async function sendMessage(id, role, body) {
  const content =
    typeof body.content === "string"
      ? body.content.replace(/\0/g, "").trim()
      : "";
  if (!content || content.length > 2000 || !uuid(body.client_id))
    throw fail(400, "Please enter a message of up to 2,000 characters.");
  const rows = await db(
    "chat_messages?on_conflict=conversation_id,client_id",
    "POST",
    { conversation_id: id, role, content, client_id: body.client_id },
    "resolution=ignore-duplicates,return=representation",
  );
  if (rows.length) return rows[0];
  const existing = await db(
    "chat_messages?conversation_id=eq." +
      id +
      "&client_id=eq." +
      body.client_id +
      "&select=seq,role,content,client_id,created_at",
  );
  if (
    !existing.length ||
    existing[0].role !== role ||
    existing[0].content !== content
  )
    throw fail(409, "Message could not be confirmed. Please refresh.");
  return existing[0];
}
function publicIntake(state) {
  if (!state || typeof state !== "object") return null;
  return {
    mode: state.mode || "",
    step: Number.isInteger(state.step) ? state.step : null,
    prompt_seq: Number(state.prompt_seq) || 0,
  };
}
async function receiveMessage(id, body) {
  const content =
    typeof body.content === "string"
      ? body.content.replace(/\0/g, "").trim()
      : "";
  const choice = body.choice === undefined ? "" : body.choice;
  const prompt = body.prompt_seq === undefined ? 0 : body.prompt_seq;
  if (
    !content ||
    content.length > 2000 ||
    !uuid(body.client_id) ||
    !["", "skip", "handoff"].includes(choice) ||
    !Number.isSafeInteger(prompt) ||
    prompt < 0
  )
    throw fail(400, "Please enter a message of up to 2,000 characters.");
  const result = await db("rpc/sendora_chat_receive", "POST", {
    p_conversation_id: id,
    p_client_id: body.client_id,
    p_content: content,
    p_choice: choice,
    p_prompt_seq: prompt,
  });
  return { message: result.message, intake: publicIntake(result.intake) };
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 16384) {
        reject(fail(413, "Request is too large."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > 16384) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
      } catch (_) {
        reject(fail(400, "Invalid request."));
      }
    });
    req.on("error", reject);
  });
}
function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Cookie, Authorization");
  res.end(JSON.stringify(body));
}
function errorResponse(res, error) {
  respond(
    res,
    [400, 401, 403, 404, 409, 413, 429, 503].includes(error.status)
      ? error.status
      : 503,
    {
      ok: false,
      message: error.status
        ? error.message
        : "Chat is temporarily unavailable. Please try again or use our contact form.",
    },
  );
}
module.exports = {
  receiveMessage,
  publicIntake,
  updateProfile,
  db,
  uuid,
  fail,
  configured,
  visitor,
  settings,
  rate,
  sameOrigin,
  start,
  messages,
  sendMessage,
  readJson,
  respond,
  errorResponse,
};
