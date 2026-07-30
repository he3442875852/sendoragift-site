"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { test } = require("node:test");
const { createHandler, _test } = require("../api/submit-quote.js");

function createReq(fields, files) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  for (const file of files || []) {
    form.append(file.name || "attachment", new Blob([file.data], { type: file.type }), file.filename);
  }
  const request = new Request("http://localhost/api/submit-quote", { method: "POST", body: form });
  const nodeReq = Readable.from(Buffer.from([]));
  return request.arrayBuffer().then((arrayBuffer) => {
    const req = Readable.from(Buffer.from(arrayBuffer));
    req.method = "POST";
    req.headers = Object.fromEntries(request.headers.entries());
    req.socket = { remoteAddress: "127.0.0.1" };
    return req;
  });
}

function createRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value) {
      this.body = value || "";
    },
    json() {
      return JSON.parse(this.body);
    }
  };
}

function baseFields(overrides) {
  return Object.assign({
    name: "Jane Buyer",
    email: "jane@example.com",
    product_type: "Corporate gift sets",
    quantity: "300",
    delivery_destination: "United States",
    target_delivery_date: "2026-08-30",
    branding_need: "Logo printing",
    message: "Please quote branded gift sets for an employee event.",
    privacy_consent: "on",
    form_started_at: String(Date.now() - 5000),
    "cf-turnstile-response": "valid-token",
    source_context: "quote.html"
  }, overrides || {});
}

async function run(fields, files, deps) {
  const req = await createReq(fields, files);
  const res = createRes();
  const handler = createHandler(Object.assign({
    verifyTurnstile: async (token) => {
      if (token !== "valid-token") {
        const error = new Error("turnstile_failed");
        error.publicType = "turnstile";
        throw error;
      }
    },
    forwardToFormspree: async () => {}
  }, deps || {}));
  await handler(req, res);
  return res;
}

test("accepts a normal quote without attachment", async () => {
  const res = await run(baseFields());
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
});

test("accepts jpg, png, and pdf attachments with valid signatures", async () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const pdf = Buffer.from("%PDF-1.7\n");
  for (const [filename, type, data] of [
    ["logo.jpg", "image/jpeg", jpg],
    ["logo.png", "image/png", png],
    ["brief.pdf", "application/pdf", pdf]
  ]) {
    const res = await run(baseFields(), [{ filename, type, data }]);
    assert.equal(res.statusCode, 200);
  }
});

test("rejects missing or invalid turnstile token", async () => {
  const missing = await run(baseFields({ "cf-turnstile-response": "" }));
  assert.equal(missing.statusCode, 400);
  assert.match(missing.json().message, /verify/);

  const invalid = await run(baseFields({ "cf-turnstile-response": "bad-token" }));
  assert.equal(invalid.statusCode, 400);
});

test("honeypot returns generic success without forwarding", async () => {
  let forwarded = false;
  const res = await run(baseFields({ company_website_url: "https://spam.example" }), [], {
    forwardToFormspree: async () => {
      forwarded = true;
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  assert.equal(forwarded, false);
});

test("rejects submissions under three seconds", async () => {
  const res = await run(baseFields({ form_started_at: String(Date.now() - 1000) }));
  assert.equal(res.statusCode, 400);
});

test("rejects invalid fields", async () => {
  assert.equal((await run(baseFields({ product_type: "" }))).statusCode, 400);
  assert.equal((await run(baseFields({ product_type: "Random product" }))).statusCode, 400);
  assert.equal((await run(baseFields({ email: "not-an-email" }))).statusCode, 400);
  assert.equal((await run(baseFields({ quantity: "abc" }))).statusCode, 400);
  assert.equal((await run(baseFields({ quantity: "-1" }))).statusCode, 400);
  assert.equal((await run(baseFields({ target_delivery_date: "asdfghjkl" }))).statusCode, 400);
  assert.equal((await run(baseFields({ privacy_consent: "" }))).statusCode, 400);
});

test("rejects disallowed or mismatched attachments", async () => {
  assert.equal((await run(baseFields(), [{ filename: "bad.svg", type: "image/svg+xml", data: Buffer.from("<svg") }])).statusCode, 400);
  assert.equal((await run(baseFields(), [{ filename: "logo.jpg", type: "image/png", data: Buffer.from([0xff, 0xd8, 0xff]) }])).statusCode, 400);
  assert.equal((await run(baseFields(), [{ filename: "logo.php.jpg", type: "image/jpeg", data: Buffer.from([0xff, 0xd8, 0xff]) }])).statusCode, 400);
});

test("reports third-party forwarding failure as service error", async () => {
  const res = await run(baseFields(), [], {
    forwardToFormspree: async () => {
      const error = new Error("forward_failed");
      error.status = 500;
      throw error;
    }
  });
  assert.equal(res.statusCode, 502);
  assert.match(res.json().message, /try again later/);
});

test("parses urlencoded submissions for native fallback", () => {
  const parts = _test.parseUrlEncoded(Buffer.from(new URLSearchParams(baseFields()).toString()));
  const { fields } = _test.partsToFields(parts);
  const result = _test.validateFields(fields);
  assert.equal(result.bot, false);
  assert.equal(result.fields.email, "jane@example.com");
});
