"use strict";

const { saveInquiry } = require("../lib/tracking-store.js");

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
      if (size > 24576) { reject(new Error("payload_too_large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function isSendoraPage(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "sendoragift.com" || url.hostname === "www.sendoragift.com");
  } catch (_) {
    return false;
  }
}

function isAllowedOrigin(req) {
  try {
    const origin = new URL(String(req.headers.origin || req.headers.referer || ""));
    const requestHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0].toLowerCase();
    const productionHost = origin.hostname === "sendoragift.com" || origin.hostname === "www.sendoragift.com";
    return origin.protocol === "https:" && (productionHost || origin.hostname.toLowerCase() === requestHost);
  } catch (_) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    send(res, 405, { ok: false });
    return;
  }

  try {
    const body = await readJson(req);
    if (!isAllowedOrigin(req) || body.event_type !== "whatsapp_click" || !isSendoraPage(body.current_page)) {
      send(res, 400, { ok: false });
      return;
    }
    await saveInquiry(body, {
      country: req.headers["x-vercel-ip-country"] || "",
      city: req.headers["x-vercel-ip-city"] || "",
      userAgent: req.headers["user-agent"] || ""
    }, "whatsapp");
    send(res, 202, { ok: true });
  } catch (error) {
    send(res, error.code === "TRACKING_NOT_CONFIGURED" ? 503 : 400, { ok: false });
  }
};

module.exports._test = { isAllowedOrigin, isSendoraPage, readJson };
