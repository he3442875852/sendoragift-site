"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../contact/index.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "../assets/js/quote-context.js"), "utf8");

function openContact(search, existingMessage = "", detailedQuote = false) {
  const sourceHtml = detailedQuote ? fs.readFileSync(path.join(__dirname, "../quote.html"), "utf8") : html;
  const select = sourceHtml.match(detailedQuote ? /<select id="quote-product"[\s\S]*?<\/select>/ : /<select id="product_type"[\s\S]*?<\/select>/)[0];
  const options = Array.from(select.matchAll(/<option[^>]*>([^<]+)<\/option>/g), match => ({ value: match[1] }));
  const elements = {
    source_context: { value: "contact page direct RFQ" },
    message: { value: existingMessage },
    product_type: { options, value: "Need recommendation" }
  };
  if (detailedQuote) {
    elements["quote-product"] = elements.product_type;
    elements["quote-details"] = elements.message;
    delete elements.product_type;
    delete elements.message;
  }
  const attributes = {};
  const document = {
    getElementById: id => elements[id],
    body: { setAttribute(name, value) { attributes[name] = value; } }
  };
  vm.runInNewContext(script, { document, window: { location: { search } }, URLSearchParams });
  return { elements, attributes };
}

test("a set inquiry selects the matching product and keeps its context for WhatsApp", () => {
  const { elements, attributes } = openContact("?product=employee-welcome-kit");
  assert.equal(elements.product_type.value, "Custom Employee Welcome Kit");
  assert.match(elements.message.value, /Custom Employee Welcome Kit/);
  assert.equal(attributes["data-inquiry-product"], "Custom Employee Welcome Kit");
});

test("a single-product inquiry uses an accepted category and retains the specific item", () => {
  const { elements, attributes } = openContact("?source=custom-metal-pens");
  assert.equal(elements.product_type.value, "Custom logo gifts");
  assert.match(elements.message.value, /Custom Metal Pens/);
  assert.match(attributes["data-inquiry-product"], /Custom Metal Pens/);
});

test("contact context does not overwrite a buyer's existing message", () => {
  const { elements } = openContact("?product=employee-welcome-kit", "Please quote 300 sets.");
  assert.equal(elements.message.value, "Please quote 300 sets.");
});

test("the existing folder link carries the correct item into the detailed quote route", () => {
  const { elements, attributes } = openContact("?product=pu-document-folders", "", true);
  assert.equal(elements["quote-product"].value, "Custom logo gifts");
  assert.match(elements["quote-details"].value, /Custom PU Document Folders with Logo/);
  assert.equal(attributes["data-inquiry-product"], "Custom PU Document Folders with Logo");
});
