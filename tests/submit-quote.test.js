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
  return request.arrayBuffer().then((arrayBuffer) => {
    const req = Readable.from(Buffer.from(arrayBuffer));
    req.method = "POST";
    req.headers = Object.assign({ "user-agent": "node-test" }, Object.fromEntries(request.headers.entries()));
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
    company: "Acme Gifts",
    product_type: "Corporate gift sets",
    quantity: "300",
    delivery_destination: "United States",
    target_budget: "USD 8-15 per set",
    target_delivery_date: "2026-08-30",
    branding_need: "Logo printing",
    message: "Please quote branded gift sets for an employee event.",
    privacy_consent: "on",
    form_started_at: String(Date.now() - 5000),
    "cf-turnstile-response": "valid-token",
    source_context: "quote.html",
    lead_source: "website",
    first_landing_page: "https://www.sendoragift.com/",
    current_page: "https://www.sendoragift.com/quote.html",
    referrer: "https://www.google.com/",
    utm_source: "google",
    utm_medium: "organic",
    utm_campaign: "brand",
    browser_language: "en-US",
    user_timezone: "America/New_York",
    page_history: "home > quote"
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
    sendInquiryEmail: async () => ({ id: "email_test_123" })
  }, deps || {}));
  await handler(req, res);
  return res;
}

function withEmailEnv(fn) {
  const previous = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    INQUIRY_TO_EMAIL: process.env.INQUIRY_TO_EMAIL,
    INQUIRY_FROM_EMAIL: process.env.INQUIRY_FROM_EMAIL
  };
  process.env.RESEND_API_KEY = "re_test_secret";
  process.env.INQUIRY_TO_EMAIL = "rita@mcpatch.com";
  process.env.INQUIRY_FROM_EMAIL = "inquiry@sendoragift.com";
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });
}

test("accepts a normal quote without attachment", async () => {
  const res = await run(baseFields());
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
});

test("calls Resend sender and returns success when it returns an email id", async () => {
  let context;
  const res = await run(baseFields(), [], {
    sendInquiryEmail: async (fields, files, ctx) => {
      assert.equal(fields.email, "jane@example.com");
      assert.equal(files.length, 0);
      context = ctx;
      return { id: "email_abc123" };
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(context.remoteIp, "127.0.0.1");
  assert.ok(context.requestId);
});

test("stores a validated form inquiry after email delivery", async () => {
  let saved;
  const res = await run(baseFields({
    lead_ref: "SG-20260813-ABC23456",
    visitor_id: "SGV-ABC23456789XYZ"
  }), [], {
    saveInquiry: async (fields, context, type) => {
      saved = { fields, context, type };
      return [{ id: "lead_1" }];
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(saved.fields.lead_ref, "SG-20260813-ABC23456");
  assert.equal(saved.type, "form");
  assert.equal(saved.context.emailProviderId, "email_test_123");
});

test("tracking database failure does not lose a successfully emailed inquiry", async () => {
  const previousLog = console.log;
  console.log = () => {};
  try {
    const res = await run(baseFields(), [], {
      saveInquiry: async () => { throw new Error("database unavailable"); }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
  } finally {
    console.log = previousLog;
  }
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

test("honeypot returns generic success without sending email", async () => {
  let sent = false;
  const res = await run(baseFields({ company_website_url: "https://spam.example" }), [], {
    sendInquiryEmail: async () => {
      sent = true;
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  assert.equal(sent, false);
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

test("reports Resend failure as a service error", async () => {
  const res = await run(baseFields(), [], {
    sendInquiryEmail: async () => {
      const error = new Error("email_failed");
      error.publicType = "service";
      error.status = 502;
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

test("sends Resend payload with html, text, reply-to, and fixed from address", async () => withEmailEnv(async () => {
  let payload;
  const result = await _test.sendInquiryEmail(baseFields({ _subject: "New inquiry\r\nBcc: test@example.com" }), [], { requestId: "req_1" }, {
    fetch: async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(options.headers.Authorization, "Bearer re_test_secret");
      payload = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    }
  });
  assert.equal(result.id, "email_123");
  assert.equal(payload.from, "Sendora Gift Website <inquiry@sendoragift.com>");
  assert.deepEqual(payload.to, ["rita@mcpatch.com"]);
  assert.equal(payload.reply_to, "jane@example.com");
  assert.notEqual(payload.from, "jane@example.com");
  assert.match(payload.subject, /New inquiry Bcc:/);
  assert.ok(payload.html);
  assert.ok(payload.text);
}));

test("fails safely when RESEND_API_KEY is missing", async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  process.env.INQUIRY_TO_EMAIL = "rita@mcpatch.com";
  process.env.INQUIRY_FROM_EMAIL = "inquiry@sendoragift.com";
  await assert.rejects(
    _test.sendInquiryEmail(baseFields(), [], {}),
    (error) => error.publicType === "service" && error.status === 503 && /RESEND_API_KEY/.test(error.safeMessage)
  );
  if (previous === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previous;
});

test("fails safely when recipient email is missing", async () => {
  const previous = process.env.INQUIRY_TO_EMAIL;
  process.env.RESEND_API_KEY = "re_test_secret";
  delete process.env.INQUIRY_TO_EMAIL;
  process.env.INQUIRY_FROM_EMAIL = "inquiry@sendoragift.com";
  await assert.rejects(
    _test.sendInquiryEmail(baseFields(), [], {}),
    (error) => error.publicType === "service" && error.status === 503 && /INQUIRY_TO_EMAIL/.test(error.safeMessage)
  );
  if (previous === undefined) delete process.env.INQUIRY_TO_EMAIL;
  else process.env.INQUIRY_TO_EMAIL = previous;
});

test("maps Resend 4xx and 5xx responses to sanitized service errors", async () => withEmailEnv(async () => {
  for (const status of [400, 503]) {
    await assert.rejects(
      _test.sendInquiryEmail(baseFields(), [], {}, {
        fetch: async () => new Response(JSON.stringify({ message: "Bad request for jane@example.com" }), { status })
      }),
      (error) => {
        assert.equal(error.publicType, "service");
        assert.equal(error.status, status);
        assert.doesNotMatch(error.safeMessage, /jane@example.com/);
        return true;
      }
    );
  }
}));

test("maps Resend timeout to service error", async () => withEmailEnv(async () => {
  await assert.rejects(
    _test.sendInquiryEmail(baseFields(), [], {}, {
      fetch: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }
    }),
    (error) => error.publicType === "service" && error.status === 503 && error.safeMessage === "resend_timeout"
  );
}));

test("converts valid PNG attachment to Base64 for Resend", () => {
  const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const [file] = _test.validateFiles([{ filename: "logo.png", contentType: "image/png", data }]);
  const attachments = _test.buildResendAttachments([file]);
  assert.equal(attachments[0].filename.endsWith(".png"), true);
  assert.equal(attachments[0].content, data.toString("base64"));
});

test("escapes HTML input in email body", () => {
  const html = _test.buildEmailHtml(baseFields({ message: "<script>alert(1)</script>", company: "A & B" }), { requestId: "req_1" });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /A &amp; B/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("logs do not include API key or attachment Base64", async () => withEmailEnv(async () => {
  const base64 = Buffer.from("secret attachment").toString("base64");
  const previousLog = console.log;
  const logs = [];
  console.log = (line) => logs.push(String(line));
  try {
    const res = await run(baseFields(), [], {
      sendInquiryEmail: async () => {
        const error = new Error("email_failed");
        error.publicType = "service";
        error.status = 502;
        error.safeMessage = `resend failed re_test_secret ${base64}`;
        throw error;
      }
    });
    assert.equal(res.statusCode, 502);
  } finally {
    console.log = previousLog;
  }
  const joined = logs.join("\n");
  assert.doesNotMatch(joined, /re_test_secret/);
  assert.doesNotMatch(joined, new RegExp(base64));
}));
