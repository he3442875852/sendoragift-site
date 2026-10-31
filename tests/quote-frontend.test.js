"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { create } = require("../assets/js/quote-form-protection.js");
const { setup } = require("../assets/js/quote-multistep.js");

class Event {
  constructor(type, options = {}) { this.type = type; this.cancelable = options.cancelable; this.defaultPrevented = false; }
  preventDefault() { this.defaultPrevented = true; }
}

// Small DOM doubles cover event ordering and request outcomes. Real browser QA
// covers native keyboard validation, file controls and responsive rendering.
function node(attributes = {}) {
  return {
    attributes: { ...attributes }, style: {}, classList: { add() {} }, events: {}, value: "", textContent: "", hidden: false, valid: true,
    getAttribute(k) { return Object.hasOwn(this.attributes, k) ? this.attributes[k] : null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    removeAttribute(k) { delete this.attributes[k]; },
    hasAttribute(k) { return Object.hasOwn(this.attributes, k); },
    addEventListener(k, fn) { (this.events[k] ||= []).push(fn); },
    dispatchEvent(e) { (this.events[e.type] || []).forEach(fn => fn(e)); return !e.defaultPrevented; },
    setCustomValidity(message) { this.validationMessage = message; },
    checkValidity() { return this.valid && !this.validationMessage; },
    reportValidity() { this.reports = (this.reports || 0) + 1; return this.checkValidity(); },
    closest() { return null; }, focus() { this.focused = true; }
  };
}

function fixture(response = async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) {
  const status = node(), retry = node(), recovery = node(), button = node(), holder = node();
  const message = Object.assign(node(), { value: "Please quote 300 branded notebooks.", required: true });
  const quantity = Object.assign(node(), { value: "300" });
  const next = Object.assign(node(), { value: "https://www.sendoragift.com/thank-you.html" });
  const fields = { message, quantity, _next: next, "cf-turnstile-response": { value: "test-token" }, form_started_at: node(), company_website_url: node() };
  const form = Object.assign(node({ action: "/api/submit-quote" }), { tagName: "FORM", resets: 0, files: [] });
  button.textContent = "Send Quote Request";
  recovery.querySelector = () => retry;
  form.querySelector = selector => {
    const name = selector.match(/^\[name="([^"]+)"\]$/);
    if (name) return fields[name[1]] || null;
    return { '[type="submit"]': button, "[data-quote-status]": status, "[data-quote-recovery]": recovery, "[data-sendora-turnstile]": holder }[selector] || null;
  };
  form.querySelectorAll = selector => selector === 'input[type="file"]' ? form.files : [];
  form.reset = () => { form.resets++; message.value = ""; form.dispatchEvent(new Event("reset")); };
  const requests = [], events = [], redirects = [];
  const host = {
    fetch: async (url, options) => { requests.push({ url, options }); return response(url, options); },
    FormData: class { constructor(f) { this.form = f; } },
    CustomEvent: Event, AbortController, setTimeout, clearTimeout,
    location: { href: "https://www.sendoragift.com/quote.html", assign(url) { redirects.push(url); } },
    turnstile: { render: () => "test-widget", reset() {} },
    SendoraLeadSourceTracker: { track(name, params) { events.push({ name, params }); }, fillForms() {} }
  };
  const doc = { getElementById() { return node(); } };
  const protection = create(doc, host);
  const submit = () => { const event = new Event("submit", { cancelable: true }); event.target = form; return protection.handleSubmit(event); };
  return { protection, submit, form, host, status, retry, recovery, message, quantity, button, fields, requests, events, redirects, holder };
}

test("only an explicitly confirmed response clears the form, records a lead and redirects", async () => {
  const f = fixture();
  await f.submit();
  assert.equal(f.form.resets, 1);
  assert.equal(f.events.filter(e => e.name === "generate_lead").length, 1);
  assert.deepEqual(f.redirects, ["https://www.sendoragift.com/thank-you.html"]);
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.textContent, "Send Quote Request");
});

test("HTML, malformed JSON and ok:false responses keep the brief and never count as leads", async () => {
  for (const body of ["<html>Temporary proxy response</html>", "{", '{"ok":false}', '{}']) {
    const f = fixture(async () => new Response(body, { status: 200 }));
    await f.submit();
    assert.equal(f.form.resets, 0);
    assert.equal(f.message.value, "Please quote 300 branded notebooks.");
    assert.equal(f.events.some(e => e.name === "generate_lead"), false);
    assert.equal(f.redirects.length, 0);
    assert.match(f.status.textContent, /could not confirm/i);
    assert.equal(f.recovery.hidden, false);
    assert.equal(f.button.disabled, false);
  }
});

test("upload errors give a safe recovery instruction without rendering server diagnostics", async () => {
  for (const [status, code, pattern] of [[413, "upload_too_large", /too large/], [400, "invalid_upload", /valid JPG, PNG or PDF/]]) {
    const f = fixture(async () => new Response(JSON.stringify({ ok: false, code, message: "private backend diagnostic" }), { status }));
    await f.submit();
    assert.match(f.status.textContent, pattern);
    assert.doesNotMatch(f.status.textContent, /private backend/);
    assert.equal(f.form.resets, 0);
    assert.equal(f.events.some(e => e.name === "generate_lead"), false);
  }
});

test("a lost response times out, aborts the request and restores the submit button", async () => {
  const f = fixture(() => new Promise(() => {}));
  let expire;
  f.host.setTimeout = fn => { expire = fn; return 1; };
  f.host.clearTimeout = () => {};
  const pending = f.submit();
  await Promise.resolve();
  assert.equal(f.button.disabled, true);
  expire();
  await pending;
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.button.disabled, false);
  assert.equal(f.form.hasAttribute("data-submitting"), false);
  assert.equal(f.form.resets, 0);
  assert.equal(f.events.at(-1).params.journey_step, "network");
});

test("duplicate submit attempts produce only one POST", async () => {
  let finish;
  const f = fixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.submit();
  await Promise.resolve();
  await f.submit();
  assert.equal(f.requests.length, 1);
  finish(new Response('{"ok":true}', { status: 200 }));
  await pending;
  assert.equal(f.events.filter(e => e.name === "generate_lead").length, 1);
});

test("verification is still required and a missing token never reaches the submission endpoint", async () => {
  const f = fixture();
  f.fields["cf-turnstile-response"].value = "";
  await f.submit();
  assert.equal(f.requests.length, 0);
  assert.equal(f.recovery.hidden, false);
  assert.equal(f.retry.hidden, false);
  assert.equal(f.events.at(-1).params.journey_step, "verification");
});

test("verification initialization can be retried after a failed configuration request", async () => {
  let attempt = 0;
  const f = fixture(async () => {
    if (++attempt === 1) throw new Error("offline");
    return new Response('{"siteKey":"public-test-key","maxAttachmentBytes":2097152}');
  });
  assert.equal(await f.protection.ensureTurnstile(f.form), false);
  assert.equal(f.form.getAttribute("data-turnstile-unavailable"), "1");
  assert.equal(await f.protection.ensureTurnstile(f.form, true), true);
  assert.equal(f.form.hasAttribute("data-turnstile-unavailable"), false);
  assert.equal(attempt, 2);
  const file = Object.assign(node({ "data-file-feedback": "file-help" }), { files: [{ name: "logo.pdf", size: 2200000 }] });
  assert.equal(f.protection.checkFile(file), false);
  assert.match(file.validationMessage, /2 MB/);
});

test("a failed verification reset stays recoverable instead of reporting readiness", async () => {
  const f = fixture(async () => new Response('{"siteKey":"public-test-key"}'));
  assert.equal(await f.protection.ensureTurnstile(f.form), true);
  f.host.turnstile.reset = () => { throw new Error("widget unavailable"); };
  assert.equal(await f.protection.ensureTurnstile(f.form, true), false);
  assert.equal(f.form.getAttribute("data-turnstile-unavailable"), "1");
  assert.match(f.status.textContent, /could not load/);
});

test("file feedback clears when artwork is removed and unsupported formats remain blocked", () => {
  const f = fixture();
  const file = Object.assign(node({ "data-file-feedback": "file-help" }), { files: [{ name: "artwork.ai", size: 100 }] });
  assert.equal(f.protection.checkFile(file), false);
  assert.match(file.validationMessage, /JPG, PNG or PDF/);
  file.files = [];
  assert.equal(f.protection.checkFile(file), true);
  assert.equal(file.validationMessage, "");
  file.files = [{ name: "logo.png", size: 5 * 1024 * 1024 }];
  assert.equal(f.protection.checkFile(file), false);
});

test("preparation keeps both spam traps off screen and exposes message and quantity bounds", () => {
  const f = fixture(async () => new Response('{"siteKey":"public-test-key"}'));
  f.fields._gotcha = node();
  f.protection.prepareForm(f.form);
  for (const field of [f.fields._gotcha, f.fields.company_website_url]) {
    assert.equal(field.style.left, "-10000px");
    assert.equal(field.getAttribute("aria-hidden"), "true");
    assert.equal(field.tabIndex, -1);
  }
  assert.equal(f.message.maxLength, 2000);
  assert.equal(f.quantity.max, "1000000");
  f.message.setCustomValidity("old error");
  f.message.dispatchEvent(new Event("input"));
  assert.equal(f.message.validationMessage, "");
});

function stepper(f) {
  const contact = node(), project = node(), branding = node();
  const controls = [contact, project, branding];
  const legends = [node(), node(), node()];
  const steps = controls.map((control, index) => Object.assign(node(), { querySelectorAll: () => [control], querySelector: () => legends[index] }));
  const progress = [node(), node(), node()];
  const originalQuery = f.form.querySelectorAll;
  f.form.querySelectorAll = s => s === "[data-form-step]" ? steps : s === ".form-progress li" ? progress : originalQuery(s);
  setup(f.form);
  return { controls, steps, legends };
}

test("keyboard submits advance one step and POST only after every step is valid", async () => {
  const f = fixture();
  const { controls, steps } = stepper(f);
  assert.equal(f.form.noValidate, true);
  await f.submit();
  assert.equal(f.form.getAttribute("data-current-step"), "2");
  assert.equal(f.requests.length, 0);
  await f.submit();
  assert.equal(f.form.getAttribute("data-current-step"), "3");
  assert.equal(f.requests.length, 0);
  controls[0].valid = false;
  await f.submit();
  assert.equal(f.requests.length, 0);
  assert.equal(f.form.getAttribute("data-current-step"), "1");
  assert.equal(steps[0].hidden, false);
  assert.equal(controls[0].reports, 1);
  controls[0].valid = true;
  await f.submit();
  await f.submit();
  await f.submit();
  assert.equal(f.requests.length, 1);
  assert.equal(f.form.getAttribute("data-current-step"), "1");
  assert.equal(f.events.filter(e => e.name === "generate_lead").length, 1);
});
