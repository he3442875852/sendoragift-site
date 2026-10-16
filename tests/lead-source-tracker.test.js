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

function loadTracker({ search = "", referrer = "", product = "", productSelect = null, whatsappLinks = [] } = {}) {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const location = {
    href: `https://www.sendoragift.com/${search}`,
    pathname: "/",
    search
  };
  const document = {
    readyState: "complete",
    referrer,
    forms: [],
    body: { getAttribute() { return product; }, setAttribute(name, value) { product = value; } },
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
