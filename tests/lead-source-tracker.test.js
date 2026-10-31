const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const trackerSource = fs.readFileSync(
  path.join(__dirname, "../assets/js/lead-source-tracker.js"),
  "utf8"
);

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function loadTracker({ search = "", referrer = "", product = "", configuration = "", packing = "", journey = {}, productSelect = null, whatsappLinks = [], forms = [] } = {}) {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const location = {
    href: `https://www.sendoragift.com/${search}`,
    pathname: "/",
    search
  };
  const attributes = Object.assign({ "data-inquiry-product": product, "data-inquiry-configuration": configuration, "data-inquiry-packing": packing }, journey);
  const document = {
    readyState: "complete",
    referrer,
    forms,
    body: { getAttribute(name) { return attributes[name] || ""; }, setAttribute(name, value) { attributes[name] = value; } },
    getElementById(id) { return id === "product_type" ? productSelect : null; },
    addEventListener() {},
    querySelectorAll(selector) {
      return selector.includes("wa.me/") ? whatsappLinks : [];
    }
  };
  const window = { location, localStorage, sessionStorage };
  const context = {
    console,
    document,
    Intl,
    navigator: { language: "en-US" },
    URLSearchParams,
    window
  };

  vm.runInNewContext(trackerSource, context);
  window.SendoraLeadSourceTracker.__testWindow = window;
  return window.SendoraLeadSourceTracker;
}

test("classifies ChatGPT UTM referrals for GEO reporting", () => {
  const tracker = loadTracker({ search: "?utm_source=chatgpt.com&utm_medium=referral" });
  assert.equal(tracker.getData().source_type, "chatgpt");
});

test("classifies answer-engine referrers without UTM parameters", () => {
  const tracker = loadTracker({ referrer: "https://www.perplexity.ai/search/corporate-gift-sets" });
  assert.equal(tracker.getData().source_type, "perplexity");
});

test("pushes generate_lead only when the success handler asks for it", () => {
  const tracker = loadTracker({ search: "?utm_source=linkedin&utm_medium=referral" });
  assert.equal(tracker.__testWindow.dataLayer, undefined);
  tracker.track("generate_lead");
  assert.equal(tracker.__testWindow.dataLayer.length, 1);
  assert.equal(tracker.__testWindow.dataLayer[0].event, "generate_lead");
  assert.equal(tracker.__testWindow.dataLayer[0].source_type, "linkedin");
  assert.equal(tracker.__testWindow.dataLayer[0].lead_ref, undefined);
});

test("prefills WhatsApp with broad gift requirements and a tracking reference", () => {
  const tracker = loadTracker();
  const url = new URL(tracker.whatsapp.getUrl());
  const message = url.searchParams.get("text");

  assert.match(message, /I'm looking for customized gifts/);
  assert.match(message, /Gift type or items: \[please enter\]/);
  assert.match(message, /Quantity: \[please enter\]/);
  assert.match(message, /Delivery country: \[please enter\]/);
  assert.match(message, /Inquiry reference: SG-\d{8}-[A-Z2-9]{8}$/);
});

test("carries the current product into WhatsApp while preserving the inquiry reference", () => {
  const tracker = loadTracker({ product: "Custom Employee Welcome Kit" });
  const message = new URL(tracker.whatsapp.getUrl()).searchParams.get("text");
  assert.match(message, /Gift type or items: Custom Employee Welcome Kit/);
  assert.match(message, /Inquiry reference: SG-\d{8}-[A-Z2-9]{8}$/);
  assert.doesNotMatch(message, /Gift type or items: \[please enter\]/);
});

test("does not carry a previous product onto an unrelated page", () => {
  loadTracker({ product: "Custom Employee Welcome Kit" });
  const nextPage = loadTracker();
  const message = new URL(nextPage.whatsapp.getUrl()).searchParams.get("text");
  assert.match(message, /Gift type or items: \[please enter\]/);
  assert.doesNotMatch(message, /Custom Employee Welcome Kit/);
});

test("changing the selected gift updates WhatsApp without replacing its tracking reference", () => {
  const handlers = {};
  const productSelect = {
    value: "Custom Employee Welcome Kit",
    addEventListener(event, handler) { handlers[event] = handler; }
  };
  const link = { href: "", dataset: {}, addEventListener() {} };
  loadTracker({ product: productSelect.value, productSelect, whatsappLinks: [link] });
  const originalRef = link.dataset.sendoraLeadRef;
  productSelect.value = "Custom Golf Tournament Gift Set";
  handlers.change();
  const message = new URL(link.href).searchParams.get("text");
  assert.match(message, /Gift type or items: Custom Golf Tournament Gift Set/);
  assert.ok(message.endsWith("Inquiry reference: " + originalRef));
  assert.doesNotMatch(message, /Custom Employee Welcome Kit/);
});

test("WhatsApp includes the selected direction and packing while product changes clear stale choices", () => {
  const events = {};
  const productSelect = { value: "Custom Metal Pens", addEventListener(name, fn) { events[name] = fn; } };
  const link = { href: "", dataset: {}, addEventListener() {} };
  loadTracker({ product: productSelect.value, configuration: "Pen in presentation case", packing: "Presentation box", productSelect, whatsappLinks: [link] });
  assert.match(new URL(link.href).searchParams.get("text"), /Direction: Pen in presentation case/);
  assert.match(new URL(link.href).searchParams.get("text"), /Packing: Presentation box/);
  productSelect.value = "Custom Employee Welcome Kit";
  events.change();
  assert.doesNotMatch(new URL(link.href).searchParams.get("text"), /Pen in presentation case|Packing:/);
});

test("analytics accepts bounded product IDs and drops arbitrary fields and field values", () => {
  const tracker = loadTracker();
  tracker.track("gift_direction_select", { product_id: "custom-metal-pens", configuration_id: "pen-case", packing_id: "buyer@example.com", email: "buyer@example.com", message: "private note", current_page: "https://invalid.example" });
  const event = tracker.__testWindow.dataLayer[0];
  assert.equal(event.product_id, "custom-metal-pens");
  assert.equal(event.configuration_id, "pen-case");
  assert.equal(event.packing_id, undefined);
  assert.equal(event.email, undefined);
  assert.equal(event.message, undefined);
  assert.equal(event.current_page, "https://www.sendoragift.com/");
});

test("GET selection forms are not filled with hidden lead identifiers or attribution fields", () => {
  const form = { method: "get", elements: [], querySelector() { throw new Error("GET form must remain unchanged"); } };
  assert.doesNotThrow(() => loadTracker({ forms: [form] }));
});

test("successful inquiry analytics retain the selected product and configuration IDs", () => {
  const tracker = loadTracker({ journey: { "data-buyer-product": "car-dealership-handover-gift-set", "data-buyer-configuration": "signing-delivery", "data-buyer-packing": "presentation" } });
  tracker.track("generate_lead");
  const event = tracker.__testWindow.dataLayer[0];
  assert.equal(event.event, "generate_lead");
  assert.equal(event.product_id, "car-dealership-handover-gift-set");
  assert.equal(event.configuration_id, "signing-delivery");
  assert.equal(event.packing_id, "presentation");
  assert.equal(event.lead_ref, undefined);
});
