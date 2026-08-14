"use strict";

const crypto = require("crypto");
const trackingStore = require("../lib/tracking-store.js");

const MAX_BODY_BYTES = Math.min(Number(process.env.QUOTE_FORM_MAX_BODY_BYTES || 4 * 1024 * 1024), 4 * 1024 * 1024);
const MAX_ATTACHMENT_BYTES = Math.min(Number(process.env.QUOTE_FORM_MAX_ATTACHMENT_BYTES || MAX_BODY_BYTES), MAX_BODY_BYTES);
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = Math.min(Math.max(Number(process.env.RESEND_TIMEOUT_MS || 12000), 1000), 15000);
const SUCCESS_MESSAGE = "Thank you. Your quote request has been submitted successfully.";
const FORM_ERROR_MESSAGE = "Please check the form information and try again.";
const TURNSTILE_ERROR_MESSAGE = "We could not verify your submission. Please refresh the page and try again.";
const SERVICE_ERROR_MESSAGE = "We could not submit your request at this time. Please try again later or contact us by email.";

const FIELD_LIMITS = {
  lead_ref: 40,
  visitor_id: 50,
  name: 120,
  company: 160,
  whatsapp_phone: 80,
  phone: 80,
  email: 254,
  product_type: 120,
  product_direction: 160,
  quantity: 20,
  delivery_destination: 200,
  delivery_country: 200,
  target_budget: 100,
  target_delivery_date: 80,
  branding_need: 120,
  logo_packaging_need: 120,
  packaging_need: 160,
  source_context: 200,
  lead_source: 80,
  source_type: 80,
  first_landing_page: 600,
  current_page: 600,
  referrer: 600,
  first_referrer: 600,
  utm_source: 120,
  utm_medium: 120,
  utm_campaign: 160,
  utm_term: 160,
  utm_content: 160,
  gclid: 200,
  fbclid: 200,
  msclkid: 200,
  ttclid: 200,
  browser_language: 40,
  user_timezone: 80,
  submit_time: 80,
  page_history: 1000,
  message: 2000,
  _subject: 180,
  _next: 300
};

const ALLOWED_SELECT_VALUES = new Set([
  "Branded bags",
  "Branded drinkware",
  "Bulk giveaways",
  "Bulk promotional giveaways",
  "Client gift boxes",
  "Conference gifts",
  "Conference or event gifts",
  "Conference or event giveaways",
  "Corporate Gifts for Clients, Partners & VIP Accounts",
  "Corporate gift sets",
  "Custom Client Appreciation Gift Box",
  "Custom Client Gift Boxes for Business Appreciation",
  "Custom Company Swag Kits & Employee Swag Boxes",
  "Custom Conference and Meeting Gift Set",
  "Custom Corporate Gift Boxes & Branded Gift Sets",
  "Custom Corporate Office Gift Set",
  "Custom Employee Welcome Kit",
  "Custom Gift Box Packaging for Corporate Gift Sets",
  "Custom Golf Tournament Gift Set",
  "Custom Pickleball Team Gift Set",
  "Custom Sports Event Giveaway Kit",
  "Custom Trade Show Giveaway Kit",
  "Custom gift box packaging",
  "Custom logo gifts",
  "Custom logo merchandise",
  "Custom packaging",
  "Custom packaging only",
  "Drinkware gifts",
  "Embroidery",
  "Employee welcome kits",
  "Event gifts",
  "Executive client gift boxes",
  "Executive gift boxes",
  "Holiday gift sets",
  "Laser engraving",
  "Logo + custom packaging",
  "Logo + packaging",
  "Logo on packaging",
  "Logo on products",
  "Logo printing",
  "Luxury Corporate Gift Boxes for VIP Clients and Executives",
  "Need method recommendation",
  "Need recommendation",
  "Not sure, need recommendation",
  "Notebook and pen sets",
  "Promotional giveaways",
  "Trade show giveaways"
]);

const PLACEHOLDER_VALUES = new Set([
  "",
  "Select one",
  "Select Product Type",
  "Logo / Branding Need"
]);

const ALLOWED_FILE_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf"
};

const FORBIDDEN_EXTENSION_SEGMENTS = new Set([
  "html",
  "htm",
  "js",
  "mjs",
  "cjs",
  "php",
  "exe",
  "zip",
  "svg",
  "ai",
  "eps",
  "psd"
]);

function logStage(requestId, stage, data) {
  const details = data ? Object.assign({ requestId, stage }, data) : { requestId, stage };
  console.log(JSON.stringify(details));
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function success(res) {
  sendJson(res, 200, { ok: true, message: SUCCESS_MESSAGE });
}

function getRemoteIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || req.socket?.remoteAddress || "";
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        const error = new Error("payload_too_large");
        error.code = "PAYLOAD_TOO_LARGE";
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseDisposition(value) {
  const result = {};
  String(value || "").split(";").forEach((part) => {
    const [rawKey, ...rawRest] = part.trim().split("=");
    if (!rawRest.length) return;
    const key = rawKey.toLowerCase();
    let val = rawRest.join("=").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    result[key] = val.replace(/\\"/g, '"');
  });
  return result;
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!boundaryMatch) throw new Error("missing_boundary");
  const boundary = Buffer.from("--" + (boundaryMatch[1] || boundaryMatch[2]));
  const parts = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    let start = buffer.indexOf(boundary, cursor);
    if (start === -1) break;
    start += boundary.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), start);
    if (headerEnd === -1) break;

    const headerText = buffer.slice(start, headerEnd).toString("latin1");
    const headers = {};
    headerText.split("\r\n").forEach((line) => {
      const index = line.indexOf(":");
      if (index === -1) return;
      headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
    });

    const nextBoundary = buffer.indexOf(boundary, headerEnd + 4);
    if (nextBoundary === -1) break;
    let contentEnd = nextBoundary;
    if (buffer[contentEnd - 2] === 13 && buffer[contentEnd - 1] === 10) contentEnd -= 2;

    const disposition = parseDisposition(headers["content-disposition"]);
    if (disposition.name) {
      parts.push({
        name: disposition.name,
        filename: disposition.filename || "",
        contentType: (headers["content-type"] || "").toLowerCase(),
        data: buffer.slice(headerEnd + 4, contentEnd)
      });
    }
    cursor = nextBoundary;
  }

  return parts;
}

function parseUrlEncoded(buffer) {
  const params = new URLSearchParams(buffer.toString("utf8"));
  const parts = [];
  params.forEach((value, name) => {
    parts.push({ name, filename: "", contentType: "", data: Buffer.from(value, "utf8") });
  });
  return parts;
}

function partsToFields(parts) {
  const fields = {};
  const files = [];
  for (const part of parts) {
    if (part.filename) {
      if (part.data.length > 0) files.push(part);
      continue;
    }
    const value = part.data.toString("utf8");
    if (fields[part.name] === undefined) fields[part.name] = value;
    else if (Array.isArray(fields[part.name])) fields[part.name].push(value);
    else fields[part.name] = [fields[part.name], value];
  }
  return { fields, files };
}

function firstField(fields, name) {
  const value = fields[name];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function hasField(fields, name) {
  return Object.prototype.hasOwnProperty.call(fields, name);
}

function cleanString(value, maxLength) {
  const cleaned = String(value || "")
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (cleaned.length > maxLength) throw new Error("field_too_long");
  if (/[\r\n]/.test(cleaned) && maxLength <= 300) throw new Error("header_injection");
  if (/<\s*script\b/i.test(cleaned) || /javascript\s*:/i.test(cleaned) || /<\s*iframe\b/i.test(cleaned)) {
    throw new Error("dangerous_html");
  }
  return cleaned;
}

function normalizeEmail(value) {
  const email = cleanString(value, FIELD_LIMITS.email);
  if (!email) throw new Error("email_required");
  if (/[\r\n]/.test(email)) throw new Error("email_newline");
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) throw new Error("invalid_email");
  return email;
}

function validateQuantity(value, required) {
  const text = cleanString(value, FIELD_LIMITS.quantity);
  if (!text) {
    if (required) throw new Error("quantity_required");
    return "";
  }
  if (!/^[1-9]\d{0,6}$/.test(text)) throw new Error("invalid_quantity");
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < 1 || number > 1000000) throw new Error("invalid_quantity");
  return text;
}

function validateDestination(value, required) {
  const text = cleanString(value, FIELD_LIMITS.delivery_destination);
  if (!text) {
    if (required) throw new Error("destination_required");
    return "";
  }
  if (text.length < 2 || /^[\p{P}\p{S}\s]+$/u.test(text)) throw new Error("invalid_destination");
  return text;
}

function validateMessage(value, required) {
  const text = cleanString(value, FIELD_LIMITS.message);
  if (!text) {
    if (required) throw new Error("message_required");
    return "";
  }
  if (required && text.replace(/\s+/g, "").length < 10) throw new Error("message_too_short");
  return text;
}

function validateDateLike(value) {
  const text = cleanString(value, FIELD_LIMITS.target_delivery_date);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(text + "T00:00:00Z");
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error("invalid_date");
    return text;
  }
  if (/^(asap|urgent|flexible|to be confirmed|tbd|soon)$/i.test(text)) return text;
  if (/^[a-z]{8,}$/i.test(text)) throw new Error("invalid_date");
  if (text.length < 2 || text.length > FIELD_LIMITS.target_delivery_date) throw new Error("invalid_date");
  return text;
}

function validateSelect(value, required) {
  const text = cleanString(value, 160);
  if (PLACEHOLDER_VALUES.has(text)) {
    if (required) throw new Error("select_required");
    return "";
  }
  if (!text) {
    if (required) throw new Error("select_required");
    return "";
  }
  if (!ALLOWED_SELECT_VALUES.has(text)) throw new Error("invalid_select");
  return text;
}

function validateStartedAt(value, now) {
  const raw = cleanString(value, 80);
  if (!raw) throw new Error("missing_started_at");
  const started = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(started)) throw new Error("invalid_started_at");
  const elapsed = now - started;
  if (elapsed < 3000 || elapsed > 24 * 60 * 60 * 1000) throw new Error("suspicious_timing");
}

function getExtension(filename) {
  const match = /\.[a-z0-9]+$/i.exec(filename || "");
  return match ? match[0].toLowerCase() : "";
}

function sanitizeFilename(filename) {
  const base = String(filename || "attachment")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 120);
  return base || "attachment";
}

function hasForbiddenDoubleExtension(filename) {
  const segments = String(filename || "").toLowerCase().split(".").filter(Boolean);
  if (segments.length < 3) return false;
  return segments.slice(0, -1).some((segment) => FORBIDDEN_EXTENSION_SEGMENTS.has(segment));
}

function matchesSignature(buffer, extension) {
  if (extension === ".jpg" || extension === ".jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (extension === ".png") {
    return buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === ".pdf") {
    return buffer.length >= 5 && buffer.slice(0, 5).toString("ascii") === "%PDF-";
  }
  return false;
}

function validateFiles(files) {
  if (files.length > 1) throw new Error("too_many_files");
  return files.map((file) => {
    const originalName = sanitizeFilename(file.filename);
    const extension = getExtension(originalName);
    const expectedType = ALLOWED_FILE_TYPES[extension];
    if (!expectedType) throw new Error("invalid_file_extension");
    if (hasForbiddenDoubleExtension(originalName)) throw new Error("double_extension");
    if (file.data.length > MAX_ATTACHMENT_BYTES) throw new Error("file_too_large");
    if (file.contentType && file.contentType !== expectedType) throw new Error("mime_mismatch");
    if (!matchesSignature(file.data, extension)) throw new Error("signature_mismatch");
    return {
      fieldName: file.name,
      filename: crypto.randomUUID() + extension,
      contentType: expectedType,
      data: file.data
    };
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function sanitizeSubject(value) {
  return String(value || "")
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, FIELD_LIMITS._subject);
}

function buildEmailSubject(fields) {
  const requestedSubject = sanitizeSubject(fields._subject || "");
  if (requestedSubject) return requestedSubject;

  const parts = ["New Sendora Gift Inquiry"];
  if (fields.company) parts.push(fields.company);
  if (fields.quantity) parts.push(fields.quantity);
  return sanitizeSubject(parts.join(" - ")) || "New Sendora Gift Inquiry";
}

function valueOrFallback(value) {
  return value === undefined || value === null || value === "" ? "Not provided" : String(value);
}

function buildEmailRows(fields, context) {
  return [
    ["Inquiry time", new Date().toISOString()],
    ["Inquiry reference", fields.lead_ref],
    ["Customer name", fields.name],
    ["Company", fields.company],
    ["Business email", fields.email],
    ["WhatsApp / phone", fields.whatsapp_phone || fields.phone],
    ["Gift direction / product type", fields.product_direction || fields.product_type],
    ["Estimated quantity", fields.quantity],
    ["Target budget", fields.target_budget],
    ["Delivery country / city", fields.delivery_destination || fields.delivery_country],
    ["Target delivery date", fields.target_delivery_date],
    ["Logo / branding need", fields.logo_packaging_need || fields.branding_need],
    ["Packaging need", fields.packaging_need],
    ["Project details / message", fields.message],
    ["Source context", fields.source_context],
    ["Lead source", fields.lead_source || fields.source_type],
    ["First landing page", fields.first_landing_page],
    ["Current page", fields.current_page],
    ["Referrer", fields.referrer || fields.first_referrer],
    ["UTM source", fields.utm_source],
    ["UTM medium", fields.utm_medium],
    ["UTM campaign", fields.utm_campaign],
    ["UTM term", fields.utm_term],
    ["UTM content", fields.utm_content],
    ["Browser language", fields.browser_language],
    ["User timezone", fields.user_timezone],
    ["Page history", fields.page_history],
    ["Request ID", context.requestId],
    ["Customer IP", context.remoteIp],
    ["User-Agent", context.userAgent]
  ];
}

function buildEmailHtml(fields, context = {}) {
  const rows = buildEmailRows(fields, context).map(([label, value]) => (
    `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:700;width:190px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(valueOrFallback(value))}</td></tr>`
  )).join("");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;"><div style="padding:20px 24px;background:#111827;color:#ffffff;"><h1 style="margin:0;font-size:20px;line-height:1.3;">New Sendora Gift Inquiry</h1></div><div style="padding:22px 24px;"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.45;">${rows}</table></div></div></body></html>`;
}

function buildEmailText(fields, context = {}) {
  return buildEmailRows(fields, context)
    .map(([label, value]) => `${label}: ${valueOrFallback(value)}`)
    .join("\n");
}

function buildResendAttachments(files) {
  const attachments = files.map((file) => ({
    filename: sanitizeFilename(file.filename),
    content: file.data.toString("base64")
  }));
  return attachments.length ? attachments : undefined;
}

function redactForLog(value) {
  return String(value || "")
    .replace(/\bre_[A-Za-z0-9_=-]+\b/g, "[secret]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?\d[\s-]?){8,}\b/g, "[phone]")
    .replace(/\b[A-Za-z0-9+/]{20,}={0,2}\b/g, "[redacted]")
    .slice(0, 300);
}

function getEmailConfig() {
  const missing = [];
  const apiKey = process.env.RESEND_API_KEY || "";
  const toEmail = process.env.INQUIRY_TO_EMAIL || "";
  const fromEmail = process.env.INQUIRY_FROM_EMAIL || "";
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!toEmail) missing.push("INQUIRY_TO_EMAIL");
  if (!fromEmail) missing.push("INQUIRY_FROM_EMAIL");
  if (missing.length) {
    const error = new Error("email_failed");
    error.publicType = "service";
    error.status = 503;
    error.safeMessage = "missing_env:" + missing.join(",");
    throw error;
  }
  return { apiKey, toEmail, fromEmail };
}

function validateFields(fields) {
  const now = Date.now();
  const validated = {};

  if (cleanString(firstField(fields, "company_website_url"), 200) || cleanString(firstField(fields, "_gotcha"), 200)) {
    return { bot: true, fields: {} };
  }

  validateStartedAt(firstField(fields, "form_started_at"), now);
  const suppliedLeadRef = cleanString(firstField(fields, "lead_ref"), FIELD_LIMITS.lead_ref).toUpperCase();
  validated.lead_ref = /^SG-[0-9]{8}-[A-Z0-9]{6,12}$/.test(suppliedLeadRef)
    ? suppliedLeadRef
    : `SG-${new Date(now).toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  validated.email = normalizeEmail(firstField(fields, "email"));

  const privacy = firstField(fields, "privacy_consent");
  if (!["on", "true", "1", "yes", "agreed"].includes(String(privacy).toLowerCase())) throw new Error("privacy_required");

  if (hasField(fields, "product_type")) validated.product_type = validateSelect(firstField(fields, "product_type"), true);

  if (hasField(fields, "product_direction") && firstField(fields, "product_direction") !== "") {
    validated.product_direction = validateSelect(firstField(fields, "product_direction"), false);
  }

  if (hasField(fields, "branding_need") && firstField(fields, "branding_need") !== "") {
    validated.branding_need = validateSelect(firstField(fields, "branding_need"), false);
  }

  if (hasField(fields, "logo_packaging_need") && firstField(fields, "logo_packaging_need") !== "") {
    validated.logo_packaging_need = validateSelect(firstField(fields, "logo_packaging_need"), false);
  }

  if (hasField(fields, "quantity")) {
    validated.quantity = validateQuantity(firstField(fields, "quantity"), true);
  }

  const destination = firstField(fields, "delivery_destination") || firstField(fields, "delivery_country");
  if (hasField(fields, "delivery_destination") || hasField(fields, "delivery_country")) {
    validated.delivery_destination = validateDestination(destination, false);
  }

  if (hasField(fields, "message")) validated.message = validateMessage(firstField(fields, "message"), true);
  validated.target_budget = cleanString(firstField(fields, "target_budget"), FIELD_LIMITS.target_budget);
  validated.target_delivery_date = validateDateLike(firstField(fields, "target_delivery_date"));

  for (const [name, limit] of Object.entries(FIELD_LIMITS)) {
    if (validated[name] !== undefined) continue;
    if (["company_website_url", "_gotcha", "form_started_at", "cf-turnstile-response"].includes(name)) continue;
    const value = firstField(fields, name);
    if (hasField(fields, name) && value !== "") validated[name] = cleanString(value, limit);
  }

  return { bot: false, fields: validated };
}

async function verifyTurnstile(token, remoteIp) {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    const error = new Error("missing_turnstile_secret");
    error.publicType = "turnstile";
    throw error;
  }

  if (!token) {
    const error = new Error("missing_turnstile_token");
    error.publicType = "turnstile";
    throw error;
  }

  const params = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token
  });
  if (remoteIp) params.set("remoteip", remoteIp);

  let response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: params });
  } catch (error) {
    error.publicType = "turnstile";
    throw error;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    const error = new Error("turnstile_failed");
    error.publicType = "turnstile";
    error.codes = result["error-codes"] || [];
    throw error;
  }
}

async function sendInquiryEmail(fields, files, context = {}, deps = {}) {
  const config = getEmailConfig();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS) : null;
  const fetcher = deps.fetch || fetch;
  const attachments = buildResendAttachments(files);
  const payload = {
    from: `Sendora Gift Website <${config.fromEmail}>`,
    to: [config.toEmail],
    reply_to: fields.email,
    subject: buildEmailSubject(fields),
    html: buildEmailHtml(fields, context),
    text: buildEmailText(fields, context)
  };
  if (attachments) payload.attachments = attachments;

  try {
    const response = await fetcher(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    });

    const responseText = await response.text().catch(() => "");
    let result = {};
    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch (_) {
        result = { message: responseText };
      }
    }

    if (!response.ok) {
      const error = new Error("email_failed");
      error.publicType = "service";
      error.status = response.status;
      error.safeMessage = redactForLog(result.message || result.error || responseText || "resend_error");
      throw error;
    }

    return { id: result.id || "" };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("email_failed");
      timeoutError.publicType = "service";
      timeoutError.status = 503;
      timeoutError.safeMessage = "resend_timeout";
      throw timeoutError;
    }
    if (error.publicType === "service") throw error;
    const wrapped = new Error("email_failed");
    wrapped.publicType = "service";
    wrapped.status = 503;
    wrapped.safeMessage = redactForLog(error.message || "resend_request_failed");
    throw wrapped;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function createHandler(deps = {}) {
  const turnstileVerifier = deps.verifyTurnstile || verifyTurnstile;
  const emailSender = deps.sendInquiryEmail || sendInquiryEmail;
  const inquirySaver = deps.saveInquiry || trackingStore.saveInquiry;

  return async function handler(req, res) {
    const requestId = crypto.randomUUID();
    const remoteIp = getRemoteIp(req);

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { ok: false, message: FORM_ERROR_MESSAGE });
      return;
    }

    try {
      const contentType = String(req.headers["content-type"] || "");
      const body = await readBody(req, MAX_BODY_BYTES);
      const parts = contentType.includes("multipart/form-data")
        ? parseMultipart(body, contentType)
        : parseUrlEncoded(body);
      const { fields, files } = partsToFields(parts);
      const validation = validateFields(fields);

      if (validation.bot) {
        logStage(requestId, "bot_honeypot");
        success(res);
        return;
      }

      await turnstileVerifier(firstField(fields, "cf-turnstile-response"), remoteIp);
      const safeFiles = validateFiles(files);
      const emailResult = await emailSender(validation.fields, safeFiles, {
        requestId,
        remoteIp,
        userAgent: String(req.headers["user-agent"] || "")
      });

      if (deps.saveInquiry || trackingStore.isConfigured()) {
        try {
          await inquirySaver(validation.fields, {
            requestId,
            country: String(req.headers["x-vercel-ip-country"] || ""),
            city: String(req.headers["x-vercel-ip-city"] || ""),
            userAgent: String(req.headers["user-agent"] || ""),
            emailProviderId: emailResult && emailResult.id ? emailResult.id : ""
          }, "form");
          logStage(requestId, "inquiry_stored", { leadRef: validation.fields.lead_ref || "" });
        } catch (trackingError) {
          logStage(requestId, "tracking_store_failed", {
            message: redactForLog(trackingError.safeMessage || trackingError.message),
            status: trackingError.status || ""
          });
        }
      }

      logStage(requestId, "email_sent", { fileCount: safeFiles.length, resendId: emailResult && emailResult.id ? emailResult.id : "" });
      success(res);
    } catch (error) {
      const type = error.publicType || "validation";
      logStage(requestId, type, {
        message: redactForLog(error.safeMessage || error.message),
        code: error.code || "",
        status: error.status || "",
        turnstileCodes: error.codes || undefined
      });

      if (error.code === "PAYLOAD_TOO_LARGE" || error.message === "file_too_large") {
        sendJson(res, 413, { ok: false, message: FORM_ERROR_MESSAGE });
      } else if (type === "turnstile") {
        sendJson(res, 400, { ok: false, message: TURNSTILE_ERROR_MESSAGE });
      } else if (type === "service" || error.message === "email_failed") {
        sendJson(res, error.status && error.status >= 500 ? error.status : 502, { ok: false, message: SERVICE_ERROR_MESSAGE });
      } else {
        sendJson(res, 400, { ok: false, message: FORM_ERROR_MESSAGE });
      }
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports._test = {
  parseMultipart,
  parseUrlEncoded,
  partsToFields,
  validateFields,
  validateFiles,
  validateStartedAt,
  buildEmailHtml,
  buildEmailText,
  buildEmailSubject,
  buildResendAttachments,
  escapeHtml,
  sendInquiryEmail,
  MAX_BODY_BYTES,
  MAX_ATTACHMENT_BYTES
};
