"use strict";

const { isAuthorized, verifyPassword } = require("../lib/admin-auth.js");
const { deleteSpamInquiry, listInquiries, updateInquiry } = require("../lib/tracking-store.js");

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
      if (size > 8192) { reject(new Error("payload_too_large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function requestIsAuthorized(req, body) {
  return Boolean(body.admin_password && verifyPassword(body.admin_password)) || isAuthorized(req, undefined, body.session_token);
}

module.exports = async function handler(req, res) {
  let body = {};
  try {
    if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") body = await readJson(req);
  } catch (_) {
    send(res, 400, { ok: false, message: "Invalid request." });
    return;
  }

  if (!requestIsAuthorized(req, body)) {
    send(res, 401, { ok: false, message: "Sign in required." });
    return;
  }

  try {
    if (req.method === "GET" || req.method === "POST") {
      const url = new URL(req.url || "/api/admin-leads", "https://www.sendoragift.com");
      const filters = req.method === "POST" ? (body.filters || {}) : {
        status: url.searchParams.get("status") || "",
        type: url.searchParams.get("type") || "",
        source: url.searchParams.get("source") || "",
        from: url.searchParams.get("from") || "",
        to: url.searchParams.get("to") || ""
      };
      const inquiries = await listInquiries({
        status: filters.status || "",
        type: filters.type || "",
        source: filters.source || "",
        from: filters.from || "",
        to: filters.to || ""
      });
      send(res, 200, { ok: true, inquiries });
      return;
    }

    if (req.method === "PATCH") {
      const result = await updateInquiry(body.id, { status: body.status, notes: body.notes });
      send(res, 200, { ok: true, inquiry: Array.isArray(result) ? result[0] : result });
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await deleteSpamInquiry(body.id);
      send(res, 200, { ok: true, deleted_id: deleted.id });
      return;
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    send(res, 405, { ok: false });
  } catch (error) {
    const unavailable = error.code === "TRACKING_NOT_CONFIGURED";
    const notDeletable = error.code === "INQUIRY_NOT_DELETABLE";
    send(res, unavailable ? 503 : (notDeletable ? 409 : 400), {
      ok: false,
      message: unavailable
        ? "Inquiry database is not configured."
        : (notDeletable ? "只有垃圾询盘可以删除，请刷新列表后重试。" : "Could not complete the request.")
    });
  }
};

module.exports._test = { readJson, requestIsAuthorized };
