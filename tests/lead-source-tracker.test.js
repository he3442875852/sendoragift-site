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

function loadTracker({ search = "", referrer = "" } = {}) {
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
    addEventListener() {},
    querySelectorAll() {
      return [];
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
});
