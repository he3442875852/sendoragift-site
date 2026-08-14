"use strict";

const TABLE = "inquiries";
const ALLOWED_STATUSES = new Set(["new", "whatsapp_clicked", "contacted", "qualified", "quoted", "won", "lost", "spam"]);
const ALLOWED_TYPES = new Set(["form", "whatsapp"]);

function getConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) {
    const error = new Error("tracking_not_configured");
    error.code = "TRACKING_NOT_CONFIGURED";
    throw error;
  }
  return { url, key };
}

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function headers(key, extra) {
  return Object.assign({
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  }, extra || {});
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/\0/g, "")
    .replace(/[\u0001-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validLeadRef(value) {
  const ref = clean(value, 40).toUpperCase();
  return /^SG-[0-9]{8}-[A-Z0-9]{6,12}$/.test(ref) ? ref : "";
}

function validVisitorId(value) {
  const id = clean(value, 50);
  return /^SGV-[a-zA-Z0-9_-]{12,40}$/.test(id) ? id : "";
}

function mapInquiry(fields, context, conversionType) {
  const type = ALLOWED_TYPES.has(conversionType) ? conversionType : "form";
  const leadRef = validLeadRef(fields.lead_ref);
  if (!leadRef) throw new Error("invalid_lead_ref");

  return {
    lead_ref: leadRef,
    visitor_id: validVisitorId(fields.visitor_id) || null,
    conversion_type: type,
    status: type === "whatsapp" ? "whatsapp_clicked" : "new",
    name: clean(fields.name, 120) || null,
    company: clean(fields.company, 160) || null,
    email: clean(fields.email, 254) || null,
    whatsapp_phone: clean(fields.whatsapp_phone || fields.phone, 80) || null,
    product_type: clean(fields.product_direction || fields.product_type, 160) || null,
    quantity: clean(fields.quantity, 20) || null,
    target_budget: clean(fields.target_budget, 100) || null,
    delivery_destination: clean(fields.delivery_destination || fields.delivery_country, 200) || null,
    target_delivery_date: clean(fields.target_delivery_date, 80) || null,
    branding_need: clean(fields.logo_packaging_need || fields.branding_need, 160) || null,
    packaging_need: clean(fields.packaging_need, 160) || null,
    message: clean(fields.message, 2000) || null,
    source_context: clean(fields.source_context, 200) || null,
    lead_source: clean(fields.lead_source, 80) || "website",
    source_type: clean(fields.source_type, 80) || "direct",
    first_landing_page: clean(fields.first_landing_page, 600) || null,
    current_page: clean(fields.current_page, 600) || null,
    referrer: clean(fields.referrer, 600) || null,
    first_referrer: clean(fields.first_referrer, 600) || null,
    utm_source: clean(fields.utm_source, 120) || null,
    utm_medium: clean(fields.utm_medium, 120) || null,
    utm_campaign: clean(fields.utm_campaign, 160) || null,
    utm_term: clean(fields.utm_term, 160) || null,
    utm_content: clean(fields.utm_content, 160) || null,
    gclid: clean(fields.gclid, 200) || null,
    fbclid: clean(fields.fbclid, 200) || null,
    msclkid: clean(fields.msclkid, 200) || null,
    ttclid: clean(fields.ttclid, 200) || null,
    browser_language: clean(fields.browser_language, 40) || null,
    user_timezone: clean(fields.user_timezone, 80) || null,
    page_history: clean(fields.page_history, 2000) || null,
    visitor_country: clean(context && context.country, 8) || null,
    visitor_city: clean(context && context.city, 120) || null,
    user_agent: clean(context && context.userAgent, 500) || null,
    email_provider_id: clean(context && context.emailProviderId, 160) || null,
    updated_at: new Date().toISOString()
  };
}

async function supabaseRequest(path, options, deps) {
  const config = getConfig();
  const fetcher = deps && deps.fetch ? deps.fetch : fetch;
  const response = await fetcher(`${config.url}/rest/v1/${path}`, Object.assign({}, options, {
    headers: Object.assign(headers(config.key), options && options.headers)
  }));
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    const error = new Error("tracking_store_failed");
    error.status = response.status;
    error.safeMessage = text.slice(0, 300);
    throw error;
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

async function saveInquiry(fields, context, conversionType, deps) {
  const record = mapInquiry(fields, context || {}, conversionType || "form");
  return supabaseRequest(`${TABLE}?on_conflict=lead_ref`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(record)
  }, deps);
}

function addFilter(params, key, value, maxLength) {
  const cleaned = clean(value, maxLength || 120);
  if (cleaned) params.set(key, `eq.${cleaned}`);
}

async function listInquiries(filters, deps) {
  const params = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "500" });
  if (filters) {
    addFilter(params, "status", ALLOWED_STATUSES.has(filters.status) ? filters.status : "");
    addFilter(params, "conversion_type", ALLOWED_TYPES.has(filters.type) ? filters.type : "");
    addFilter(params, "source_type", filters.source, 80);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from || "") ? filters.from : "";
    const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to || "") ? filters.to : "";
    if (from) params.set("created_at", `gte.${from}T00:00:00.000Z`);
    if (to) params.append("created_at", `lte.${to}T23:59:59.999Z`);
  }
  const result = await supabaseRequest(`${TABLE}?${params.toString()}`, { method: "GET" }, deps);
  return Array.isArray(result) ? result : [];
}

async function updateInquiry(id, changes, deps) {
  const uuid = clean(id, 40);
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) throw new Error("invalid_inquiry_id");
  const update = { updated_at: new Date().toISOString() };
  if (changes && ALLOWED_STATUSES.has(changes.status)) update.status = changes.status;
  if (changes && Object.prototype.hasOwnProperty.call(changes, "notes")) update.notes = clean(changes.notes, 3000) || null;
  if (Object.keys(update).length === 1) throw new Error("empty_update");
  return supabaseRequest(`${TABLE}?id=eq.${encodeURIComponent(uuid)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(update)
  }, deps);
}

module.exports = {
  ALLOWED_STATUSES,
  clean,
  isConfigured,
  listInquiries,
  mapInquiry,
  saveInquiry,
  updateInquiry,
  validLeadRef,
  validVisitorId
};
