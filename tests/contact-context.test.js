"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const directions = require("../assets/js/gift-directions.js");

const html = fs.readFileSync(path.join(__dirname, "../contact/index.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "../assets/js/quote-context.js"), "utf8");

function openContact(search, existingMessage = "", detailedQuote = false) {
  const sourceHtml = detailedQuote ? fs.readFileSync(path.join(__dirname, "../quote.html"), "utf8") : html;
  const select = sourceHtml.match(detailedQuote ? /<select id="quote-product"[\s\S]*?<\/select>/ : /<select id="product_type"[\s\S]*?<\/select>/)[0];
  const options = Array.from(select.matchAll(/<option[^>]*>([^<]+)<\/option>/g), match => ({ value: match[1] }));
  const elements = {
    source_context: { value: "contact page direct RFQ" },
    "inquiry-selection": { hidden: true },
    "inquiry-selection-name": { textContent: "" },
    "inquiry-selection-details": { textContent: "", hidden: true },
    quantity: { value: "" },
    message: { value: existingMessage },
    product_type: { options, value: "Need recommendation", events: {}, addEventListener(name, fn) { this.events[name] = fn; } }
  };
  if (detailedQuote) {
    elements["quote-product"] = elements.product_type;
    elements["quote-details"] = elements.message;
    elements["quote-quantity"] = elements.quantity;
    delete elements.quantity;
    delete elements.product_type;
    delete elements.message;
  }
  const attributes = {};
  const document = {
    getElementById: id => elements[id],
    body: { setAttribute(name, value) { attributes[name] = value; } }
  };
  vm.runInNewContext(script, { document, window: { location: { search }, SendoraGiftDirections: directions }, URLSearchParams });
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

test("a sample set inquiry retains its exact selection in the gift-set category", () => {
  const { elements, attributes } = openContact("?product=sample-ace-outdoor");
  assert.equal(elements.product_type.value, "Corporate gift sets");
  assert.equal(elements.source_context.value, "Outdoor Essentials Gift Set Sample");
  assert.match(elements.message.value, /Outdoor Essentials Gift Set Sample/);
  assert.equal(attributes["data-inquiry-product"], "Outdoor Essentials Gift Set Sample");
});

test("a single-product sample carries its exact selection into a detailed quote", () => {
  const { elements, attributes } = openContact("?product=sample-metal-bookmark", "", true);
  assert.equal(elements["quote-product"].value, "Custom logo gifts");
  assert.equal(elements.source_context.value, "Metal Bookmark with Tassel Sample");
  assert.match(elements["quote-details"].value, /Metal Bookmark with Tassel Sample/);
  assert.equal(attributes["data-inquiry-product"], "Metal Bookmark with Tassel Sample");
});

test("the selected reference is visible before a buyer fills in the contact form", () => {
  const { elements } = openContact("?product=sample-pu-folder");
  assert.equal(elements["inquiry-selection"].hidden, false);
  assert.equal(elements["inquiry-selection-name"].textContent, "PU Document File Pouch Sample");
  const direct = openContact("");
  assert.equal(direct.elements["inquiry-selection"].hidden, true);
});

test("new headwear, backpack and mouse-pad choices retain their names in both inquiry forms", () => {
  const choices = {
    "bucket-hat": "Bucket Hat with Logo Sample",
    "baseball-cap": "Baseball Cap with Logo Sample",
    "backpack": "Backpack with Logo Sample",
    "mouse-pad": "Mouse Pad with Logo Sample"
  };
  for (const [id, label] of Object.entries(choices)) {
    for (const detailed of [false, true]) {
      const { elements, attributes } = openContact("?product=sample-" + id, "", detailed);
      assert.equal(elements.source_context.value, label);
      assert.equal(elements[detailed ? "quote-product" : "product_type"].value, "Custom logo gifts");
      assert.ok(elements[detailed ? "quote-details" : "message"].value.includes(label));
      assert.equal(attributes["data-inquiry-product"], label);
      assert.equal(elements["inquiry-selection-name"].textContent, label);
    }
  }
});


test("all detailed sample pages retain their selection through both quote routes", () => {
  const samples = {
    "black-gold-executive-set": ["Black & Gold Executive Gift Set Sample", "Corporate gift sets"],
    "red-organizer-set": ["Red Organizer & Tumbler Gift Set Sample", "Corporate gift sets"],
    "two-tone-mug": ["Two-Tone Ceramic Mug Logo Sample", "Custom logo gifts"],
    "golf-accessory-set": ["Navy & Orange Golf Accessory Gift Set Sample", "Corporate gift sets"]
  };
  for (const [key, [label, category]] of Object.entries(samples)) {
    for (const detailed of [false, true]) {
      const { elements, attributes } = openContact("?sample=" + key, "", detailed);
      assert.equal(elements.source_context.value, label);
      assert.equal(elements[detailed ? "quote-product" : "product_type"].value, category);
      assert.ok(elements[detailed ? "quote-details" : "message"].value.includes(label));
      assert.equal(attributes["data-inquiry-product"], label);
      assert.equal(elements["inquiry-selection-name"].textContent, label);
    }
  }
});

test("sample context preserves a buyer's written message and explicit product selection wins", () => {
  const { elements } = openContact("?sample=two-tone-mug", "Need 200 mugs with a red logo.");
  assert.equal(elements.message.value, "Need 200 mugs with a red logo.");
  const product = openContact("?product=employee-welcome-kit&sample=two-tone-mug");
  assert.equal(product.elements.product_type.value, "Custom Employee Welcome Kit");
});

test("handover landing pages retain the selected set in both inquiry routes", () => {
  for (const [slug, label] of Object.entries({
    "car-dealership-handover-gift-set": "Custom Car Dealership Handover Gift Set",
    "real-estate-closing-gift-set": "Custom Real Estate Closing Gift Set"
  })) {
    for (const detailed of [false, true]) {
      const { elements, attributes } = openContact("?product=" + slug, "", detailed);
      assert.equal(elements[detailed ? "quote-product" : "product_type"].value, "Corporate gift sets");
      assert.equal(elements.source_context.value, label);
      assert.equal(elements["inquiry-selection-name"].textContent, label);
      assert.ok(elements[detailed ? "quote-details" : "message"].value.includes(label));
      assert.equal(attributes["data-inquiry-product"], label);
    }
  }
});

test("a chosen configuration, quantity and packing remain visible in both quote routes", () => {
  for (const detailed of [false, true]) {
    const { elements, attributes } = openContact("?product=car-dealership-handover-gift-set&configuration=signing-delivery&packing=presentation&quantity=350", "", detailed);
    assert.equal(elements[detailed ? "quote-quantity" : "quantity"].value, "350");
    assert.match(elements[detailed ? "quote-details" : "message"].value, /Signing & delivery set/);
    assert.match(elements["inquiry-selection-details"].textContent, /metal keychain/);
    assert.match(elements["inquiry-selection-details"].textContent, /Presentation box/);
    assert.equal(elements["inquiry-selection-details"].hidden, false);
    assert.equal(attributes["data-inquiry-configuration"], "Signing & delivery set");
  }
});

test("configuration IDs cannot be reused on an unrelated product or as arbitrary text", () => {
  for (const configuration of ["signing-delivery", "__proto__", "custom unverified promise"]) {
    const { elements, attributes } = openContact("?product=employee-welcome-kit&configuration=" + encodeURIComponent(configuration) + "&quantity=350&packing=presentation");
    assert.equal(elements["inquiry-selection-details"].hidden, true);
    assert.equal(elements.quantity.value, "");
    assert.equal(attributes["data-inquiry-configuration"], undefined);
  }
});

test("invalid quantity and packing are ignored without losing a valid configuration", () => {
  const { elements } = openContact("?product=custom-metal-pens&configuration=pen-case&quantity=1e6&packing=unverified-free-shipping");
  assert.equal(elements.quantity.value, "");
  assert.match(elements.message.value, /Pen in presentation case/);
  assert.doesNotMatch(elements.message.value, /unverified-free-shipping|1e6/);
});

test("changing product clears the old automatic configuration but preserves buyer edits", () => {
  for (const existingMessage of ["", "Please also quote 200 blue pens."]) {
    const { elements, attributes } = openContact("?product=custom-metal-pens&configuration=pen-case", existingMessage);
    elements.product_type.value = "Custom Employee Welcome Kit";
    elements.product_type.events.change();
    assert.equal(attributes["data-inquiry-configuration"], "");
    assert.equal(elements["inquiry-selection-details"].hidden, true);
    if (existingMessage) assert.equal(elements.message.value, existingMessage);
    else { assert.match(elements.message.value, /Custom Employee Welcome Kit/); assert.doesNotMatch(elements.message.value, /Pen in presentation case/); }
  }
});
