"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const registry = require("../assets/js/gift-directions.js");
const { setup } = require("../assets/js/buyer-journey.js");

test("direction resolution is product-specific and quantities use bounded integer syntax", () => {
  assert.equal(registry.resolve("custom-metal-pens", "pen-case").label, "Pen in presentation case");
  assert.equal(registry.resolve("employee-welcome-kit", "pen-case"), null);
  assert.equal(registry.resolve("__proto__", "pen-case"), null);
  assert.equal(registry.packingLabel("__proto__"), "");
  for (const value of ["0", "-1", "1e3", "2.5", "1000000", " 300 "]) assert.equal(registry.quantity(value), "");
  assert.equal(registry.quantity("300"), "300");
});

function fixture() {
  const events = [], attributes = { "data-buyer-product": "custom-metal-pens" };
  const radio = { value: "pen-case" }, packing = { value: "presentation" };
  const form = { events: {}, querySelector(selector) { return selector.includes("configuration") ? radio : selector.includes("packing") ? packing : { value: "custom-metal-pens" }; }, addEventListener(name, fn) { this.events[name] = fn; } };
  const inquiry = { events: {}, addEventListener(name, fn) { this.events[name] = fn; } };
  const video = { events: {}, getAttribute() { return "golf-video"; }, addEventListener(name, fn, options) { this.events[name] = fn; this.options = options; } };
  const doc = { body: { hasAttribute(name) { return name in attributes; }, getAttribute(name) { return attributes[name]; }, setAttribute(name, value) { attributes[name] = value; } }, events: {}, addEventListener(name, fn) { this.events[name] = fn; }, querySelectorAll(selector) { return selector.includes("direction-builder") ? [form] : selector.startsWith("video") ? [video] : [inquiry]; } };
  let refreshes = 0;
  const host = { location: { href: "https://www.sendoragift.com/custom-metal-pens.html", origin: "https://www.sendoragift.com" }, SendoraGiftDirections: registry, SendoraLeadSourceTracker: { track(name, params) { events.push({ name, params }); }, refreshWhatsApp() { refreshes++; } } };
  setup(doc, host);
  return { doc, host, form, inquiry, video, radio, packing, events, attributes, refreshes: () => refreshes };
}

test("builder choice updates WhatsApp context and records only stable selection IDs", () => {
  const f = fixture();
  assert.equal(f.attributes["data-inquiry-configuration"], "Pen in presentation case");
  f.radio.value = "pen-notebook";
  f.form.events.change({ target: { name: "configuration" } });
  assert.equal(f.attributes["data-inquiry-configuration"], "Notebook & pen direction");
  f.form.events.submit();
  const continuation = f.events.find(e => e.name === "quote_builder_continue");
  assert.deepEqual(continuation.params, { product_id: "custom-metal-pens", configuration_id: "pen-notebook", packing_id: "presentation" });
  assert.ok(f.refreshes() >= 2);
});

test("quote form input is counted once and setup cannot double-bind the page", () => {
  const f = fixture();
  f.inquiry.events.input();
  f.inquiry.events.input();
  setup(f.doc, f.host);
  assert.equal(f.events.filter(e => e.name === "quote_form_start").length, 1);
  assert.equal(f.events.filter(e => e.name === "product_detail_view").length, 1);
  assert.equal(f.video.options.once, true);
});

test("reference inspection and quote intent are distinct from a submitted lead", () => {
  const f = fixture();
  f.doc.events.click({ target: { closest() { return { href: "https://www.sendoragift.com/sample-projects/#sample-metal-pen", getAttribute() { return "metal-pen"; } }; } } });
  f.doc.events.click({ target: { closest() { return { href: "https://www.sendoragift.com/contact/?product=custom-metal-pens", getAttribute() { return null; } }; } } });
  f.video.events.play();
  assert.ok(f.events.some(e => e.name === "sample_reference_open"));
  assert.ok(f.events.some(e => e.name === "quote_start"));
  assert.ok(f.events.some(e => e.name === "sample_video_start"));
  assert.ok(f.events.every(e => e.name !== "generate_lead"));
});
