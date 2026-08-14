"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const auth = require("../lib/admin-auth.js");
const store = require("../lib/tracking-store.js");
const trackEvent = require("../api/track-lead-event.js");

function withEnv(values, fn) {
  const previous = {};
  Object.keys(values).forEach((key) => {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  });
  return Promise.resolve().then(fn).finally(() => {
    Object.keys(values).forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  });
}

test("maps a form inquiry without exposing raw IP data", () => {
  const record = store.mapInquiry({
    lead_ref: "SG-20260813-ABC23456",
    visitor_id: "SGV-ABC23456789XYZ",
    email: "buyer@example.com",
    source_type: "chatgpt",
    utm_term: "custom corporate gifts",
    current_page: "https://www.sendoragift.com/quote.html"
  }, { country: "US", city: "Seattle", userAgent: "Test" }, "form");
  assert.equal(record.lead_ref, "SG-20260813-ABC23456");
  assert.equal(record.conversion_type, "form");
  assert.equal(record.status, "new");
  assert.equal(record.source_type, "chatgpt");
  assert.equal(record.visitor_country, "US");
  assert.equal(Object.prototype.hasOwnProperty.call(record, "remote_ip"), false);
});

test("rejects malformed inquiry references", () => {
  assert.throws(() => store.mapInquiry({ lead_ref: "bad" }, {}, "whatsapp"), /invalid_lead_ref/);
});

test("writes through server-only Supabase REST credentials", async () => withEnv({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test"
}, async () => {
  let request;
  const result = await store.saveInquiry({
    lead_ref: "SG-20260813-ABC23456",
    current_page: "https://www.sendoragift.com/quote.html"
  }, {}, "whatsapp", {
    fetch: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify([{ id: "test-id" }]), { status: 201 });
    }
  });
  assert.match(request.url, /\/rest\/v1\/inquiries\?on_conflict=lead_ref$/);
  assert.equal(request.options.headers.apikey, "service-role-test");
  assert.equal(JSON.parse(request.options.body).status, "whatsapp_clicked");
  assert.equal(result[0].id, "test-id");
}));

test("admin session is signed, expires, and rejects tampering", () => withEnv({
  ADMIN_DASHBOARD_PASSWORD: "a-long-admin-password",
  ADMIN_DASHBOARD_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef"
}, () => {
  const now = Date.UTC(2026, 7, 13, 12, 0, 0);
  const token = auth.createSession(now);
  const req = { headers: { cookie: `sendora_admin=${encodeURIComponent(token)}` } };
  assert.equal(auth.verifyPassword("a-long-admin-password"), true);
  assert.equal(auth.verifyPassword("wrong-password"), false);
  assert.equal(auth.isAuthorized(req, now + 1000), true);
  assert.equal(auth.isAuthorized({ headers: { cookie: `sendora_admin=${token}x` } }, now + 1000), false);
  assert.equal(auth.isAuthorized(req, now + (auth.SESSION_SECONDS + 1) * 1000), false);
}));

test("admin password tolerates accidental surrounding whitespace", () => withEnv({
  ADMIN_DASHBOARD_PASSWORD: "  0123456789abcdef0123456789abcdef\n"
}, () => {
  assert.equal(auth.passwordIsConfigured(), true);
  assert.equal(auth.verifyPassword("0123456789abcdef0123456789abcdef"), true);
  assert.equal(auth.verifyPassword("  0123456789abcdef0123456789abcdef  "), true);
}));

test("admin password reports when its environment variable is not configured", () => withEnv({
  ADMIN_DASHBOARD_PASSWORD: undefined
}, () => {
  assert.equal(auth.passwordIsConfigured(), false);
  assert.equal(auth.verifyPassword("any-password-value"), false);
}));

test("public WhatsApp tracking accepts only Sendora HTTPS pages", () => {
  assert.equal(trackEvent._test.isSendoraPage("https://www.sendoragift.com/corporate-gift.html"), true);
  assert.equal(trackEvent._test.isSendoraPage("https://sendoragift.com/quote.html"), true);
  assert.equal(trackEvent._test.isSendoraPage("http://www.sendoragift.com/quote.html"), false);
  assert.equal(trackEvent._test.isSendoraPage("https://evil.example/quote.html"), false);
  assert.equal(trackEvent._test.isAllowedOrigin({ headers: { origin: "https://www.sendoragift.com", host: "www.sendoragift.com" } }), true);
  assert.equal(trackEvent._test.isAllowedOrigin({ headers: { origin: "https://preview.vercel.app", host: "preview.vercel.app" } }), true);
  assert.equal(trackEvent._test.isAllowedOrigin({ headers: { origin: "https://evil.example", host: "www.sendoragift.com" } }), false);
});
