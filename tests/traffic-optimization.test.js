"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("quote form uses three short progressive steps", () => {
  const html = read("quote.html");
  const steps = Array.from(html.matchAll(/<fieldset data-form-step>([\s\S]*?)<\/fieldset>/g), (match) => match[1]);
  assert.equal(steps.length, 3);
  for (const step of steps) {
    const visibleFields = (step.match(/<(?:input|select|textarea)\b(?![^>]*type="hidden")/g) || []).length;
    assert.ok(visibleFields <= 5, `expected at most 5 visible fields, found ${visibleFields}`);
  }
  assert.ok(html.indexOf("quote-assurance") < html.indexOf("data-multistep-form"));
});

test("lead tracker exposes the five conversion event names", () => {
  const source = read("assets/js/lead-source-tracker.js");
  for (const eventName of ["generate_lead", "whatsapp_click", "email_click", "phone_click", "catalog_download"]) {
    assert.match(source, new RegExp(`\\b${eventName}\\b`));
  }
});

test("robots explicitly allows supported answer-engine crawlers", () => {
  const robots = read("robots.txt");
  for (const crawler of ["OAI-SearchBot", "GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
    assert.match(robots, new RegExp(`User-agent: ${crawler}`));
  }
});

test("thank-you page offers three useful next actions", () => {
  const html = read("thank-you.html");
  assert.equal((html.match(/data-next-action/g) || []).length, 3);
});

test("IndexNow verification key and automatic workflow stay aligned", () => {
  const key = read("9dfc83352bdfabdb5f9793c37f14793e.txt").trim();
  const script = read("scripts/submit_indexnow.py");
  const workflow = read(".github/workflows/indexnow.yml");
  assert.equal(key, "9dfc83352bdfabdb5f9793c37f14793e");
  assert.match(script, new RegExp(key));
  assert.match(workflow, new RegExp(key));
});
