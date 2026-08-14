"use strict";

const { clearCookie, createSession, isAuthorized, sessionCookie, verifyPassword } = require("../lib/admin-auth.js");

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 4096) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    send(res, isAuthorized(req) ? 200 : 401, { ok: isAuthorized(req) });
    return;
  }
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearCookie());
    send(res, 200, { ok: true });
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    send(res, 405, { ok: false });
    return;
  }
  try {
    const body = await readJson(req);
    if (!verifyPassword(body.password)) {
      send(res, 401, { ok: false, message: "Password is incorrect." });
      return;
    }
    const token = createSession();
    res.setHeader("Set-Cookie", sessionCookie(token));
    send(res, 200, { ok: true });
  } catch (error) {
    const unavailable = /not_configured/.test(error.message || "");
    send(res, unavailable ? 503 : 400, { ok: false, message: unavailable ? "Dashboard is not configured." : "Invalid request." });
  }
};

module.exports._test = { readJson };
