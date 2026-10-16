"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { matches, validKind, setup } = require("../assets/js/product-catalog.js");

test("catalog search combines type and every search word without case sensitivity", () => {
  const item = { kind: "sets", text: "Office gift set with notebook and metal pens" };
  assert.equal(matches(item, "sets", " OFFICE   pens "), true);
  assert.equal(matches(item, "single", "pens"), false);
  assert.equal(matches(item, "all", "office golf"), false);
  assert.equal(matches(item, "all", ""), true);
  assert.equal(matches({ kind: "single", text: "Metal pen in a case" }, "single", "pens"), true);
});

test("search preserves non-Latin queries and treats punctuation as separators", () => {
  assert.equal(matches({ kind: "single", text: "Metal pens" }, "all", "笔"), false);
  assert.equal(matches({ kind: "sets", text: "Office & travel gifts" }, "all", "office-travel"), true);
  assert.equal(matches({ kind: "single", text: "Café mugs" }, "all", "cafe"), true);
  assert.equal(validKind("unexpected"), "all");
});

function node(dataset = {}) {
  return {
    dataset, hidden: false, value: "", events: {}, attributes: {},
    addEventListener(name, fn) { this.events[name] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; },
    click() { this.events.click(); },
    focus() { this.focused = true; }
  };
}

function catalog(search = "") {
  const cards = [node({ productKind: "sets", search: "Office notebook pens" }), node({ productKind: "single", search: "Metal pens" }), node({ productKind: "single", search: "Golf balls" })];
  const groups = [{ contains: card => card === cards[0] }, { contains: card => cards.slice(1).includes(card) }];
  const controls = node(), input = node(), status = node(), empty = node(), reset = node();
  controls.hidden = true;
  const buttons = ["all", "sets", "single"].map(kind => node({ catalogKind: kind }));
  const single = { "[data-catalog-controls]": controls, "[data-catalog-search]": input, "[data-catalog-status]": status, "[data-catalog-empty]": empty };
  const many = { "[data-catalog-kind]": buttons, "[data-catalog-item]": cards, "[data-catalog-group]": groups, "[data-catalog-reset]": [reset] };
  const root = { querySelector: key => single[key], querySelectorAll: key => many[key] };
  const host = { location: { search, href: "https://www.sendoragift.com/products/" + search }, events: {}, addEventListener(name, fn) { this.events[name] = fn; } };
  host.history = { replaceState(_state, _title, href) { host.location.href = href; host.location.search = new URL(href).search; } };
  setup(root, host);
  return { cards, groups, controls, input, status, empty, buttons, reset, host };
}

test("a single-product deep link reveals only that group and keeps filter state accessible", () => {
  const c = catalog("?type=single");
  assert.equal(c.controls.hidden, false);
  assert.deepEqual(c.cards.map(card => card.hidden), [true, false, false]);
  assert.equal(c.groups[0].hidden, true);
  assert.equal(c.buttons[2].attributes["aria-pressed"], "true");
  assert.match(c.status.textContent, /^2 product directions/);
});

test("an empty search result can be reset without leaving hidden cards or orphan headings", () => {
  const c = catalog("?type=single");
  c.input.value = "umbrella";
  c.input.events.input();
  assert.equal(c.empty.hidden, false);
  assert.ok(c.groups.every(group => group.hidden));
  c.reset.click();
  assert.equal(c.empty.hidden, true);
  assert.ok(c.cards.every(card => !card.hidden));
  assert.ok(c.groups.every(group => !group.hidden));
  assert.equal(c.input.value, "");
  assert.equal(c.input.focused, true);
});

test("changing filters preserves attribution parameters and browser navigation restores type", () => {
  const c = catalog("?utm_source=google");
  c.buttons[1].click();
  const url = new URL(c.host.location.href);
  assert.equal(url.searchParams.get("utm_source"), "google");
  assert.equal(url.searchParams.get("type"), "sets");
  c.host.location.search = "?type=single";
  c.host.events.popstate();
  assert.deepEqual(c.cards.map(card => card.hidden), [true, false, false]);
});
