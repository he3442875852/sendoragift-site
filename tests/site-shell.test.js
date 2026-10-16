"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { setup } = require("../assets/js/site-shell.js");

function surface() {
  const button = { hidden: true, attrs: { "aria-expanded": "false" }, addEventListener(_name, fn) { this.click = fn; }, setAttribute(name, value) { this.attrs[name] = value; }, getAttribute(name) { return this.attrs[name]; }, focus() { this.focused = true; } };
  const nav = { addEventListener(_name, fn) { this.click = fn; } };
  const header = { attrs: {}, classList: { add() {} }, querySelector: selector => selector.includes("toggle") ? button : nav, setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; }, contains: target => target === button || target === nav };
  const doc = { events: {}, addEventListener(name, fn) { this.events[name] = fn; } };
  const media = { addEventListener(_name, fn) { this.change = fn; } };
  setup(header, doc, { matchMedia: () => media });
  return { header, button, nav, doc, media };
}

test("the mobile menu exposes its state and Escape returns keyboard focus", () => {
  const s = surface();
  assert.equal(s.button.hidden, false);
  s.button.click();
  assert.equal(s.button.attrs["aria-expanded"], "true");
  assert.ok("data-menu-open" in s.header.attrs);
  s.doc.events.keydown({ key: "Escape" });
  assert.equal(s.button.attrs["aria-expanded"], "false");
  assert.equal(s.button.focused, true);
  assert.ok(!("data-menu-open" in s.header.attrs));
});

test("navigation, outside clicks and breakpoint changes close the menu", () => {
  const s = surface();
  s.button.click();
  s.nav.click({ target: { closest: () => true } });
  assert.equal(s.button.attrs["aria-expanded"], "false");
  s.button.click();
  s.doc.events.click({ target: {} });
  assert.equal(s.button.attrs["aria-expanded"], "false");
  s.button.click();
  s.media.change();
  assert.equal(s.button.attrs["aria-expanded"], "false");
});
