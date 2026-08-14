(function () {
  "use strict";

  var WHATSAPP_NUMBER = "8613400883682";
  var WHATSAPP_MESSAGE = "Hello Sendora Gift, I need a custom corporate gift set with: [type the items here]. Please recommend suitable options and provide the MOQ, price range, and lead time.";

  var FIELD_NAMES = [
    "lead_ref",
    "visitor_id",
    "lead_source",
    "source_type",
    "first_landing_page",
    "current_page",
    "referrer",
    "first_referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "msclkid",
    "ttclid",
    "browser_language",
    "user_timezone",
    "submit_time",
    "page_history"
  ];

  var ATTRIBUTION_FIELDS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "msclkid",
    "ttclid"
  ];

  var STORAGE_KEYS = {
    visitorId: "sendora_visitor_id",
    leadRef: "sendora_lead_ref",
    firstLandingPage: "sendora_first_landing_page",
    firstReferrer: "sendora_first_referrer",
    firstAttribution: "sendora_first_attribution",
    currentAttribution: "sendora_current_attribution",
    pageHistory: "sendora_page_history"
  };

  function randomToken(length) {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var output = "";
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var values = new Uint8Array(length);
      window.crypto.getRandomValues(values);
      for (var i = 0; i < values.length; i += 1) output += alphabet.charAt(values[i] % alphabet.length);
      return output;
    }
    while (output.length < length) output += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return output;
  }

  function getVisitorId() {
    var id = safeGet(window.localStorage, STORAGE_KEYS.visitorId);
    if (!id) {
      id = "SGV-" + randomToken(20);
      safeSet(window.localStorage, STORAGE_KEYS.visitorId, id);
    }
    return id;
  }

  function createLeadRef() {
    var date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return "SG-" + date + "-" + randomToken(8);
  }

  function getLeadRef() {
    var ref = safeGet(window.sessionStorage, STORAGE_KEYS.leadRef);
    if (!ref) {
      ref = createLeadRef();
      safeSet(window.sessionStorage, STORAGE_KEYS.leadRef, ref);
    }
    return ref;
  }

  function getWhatsappUrl(leadRef) {
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(WHATSAPP_MESSAGE + "\n\nInquiry reference: " + leadRef);
  }

  function safeGet(storage, key) {
    try {
      return storage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (error) {
      // Storage can be disabled in private browsing or strict privacy modes.
    }
  }

  function safeHas(storage, key) {
    try {
      return storage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }

  function readJSON(storage, key, fallback) {
    var raw = safeGet(storage, key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(storage, key, value) {
    safeSet(storage, key, JSON.stringify(value));
  }

  function getQueryAttribution() {
    var params = new URLSearchParams(window.location.search);
    var values = {};
    var hasValue = false;

    ATTRIBUTION_FIELDS.forEach(function (name) {
      var value = params.get(name) || "";
      values[name] = value;
      if (value) hasValue = true;
    });

    return hasValue ? values : null;
  }

  function normalizeSource(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "");
  }

  function sourceFromText(value) {
    var source = normalizeSource(value);
    if (!source) return "";
    if (source.indexOf("chatgpt") !== -1 || source.indexOf("openai") !== -1) return "chatgpt";
    if (source.indexOf("perplexity") !== -1) return "perplexity";
    if (source.indexOf("gemini") !== -1 || source.indexOf("bard.google") !== -1) return "gemini";
    if (source.indexOf("copilot") !== -1) return "copilot";
    if (source.indexOf("claude") !== -1 || source.indexOf("anthropic") !== -1) return "claude";
    if (source === "you.com" || source.endsWith(".you.com")) return "you.com";
    if (source.indexOf("google") !== -1) return "google";
    if (source.indexOf("bing") !== -1) return "bing";
    if (source.indexOf("yahoo") !== -1) return "yahoo";
    if (source.indexOf("alibaba") !== -1) return "alibaba";
    if (source.indexOf("linkedin") !== -1) return "linkedin";
    if (source.indexOf("facebook") !== -1 || source === "fb" || source.indexOf(".fb.") !== -1) return "facebook";
    if (source.indexOf("instagram") !== -1) return "instagram";
    if (source.indexOf("email") !== -1 || source.indexOf("newsletter") !== -1 || source.indexOf("mail") !== -1) return "email";
    return "";
  }

  function getSourceType(attribution, referrer, firstReferrer) {
    var utmSource = attribution && attribution.utm_source ? normalizeSource(attribution.utm_source) : "";
    var knownSource = sourceFromText(utmSource);
    if (knownSource) return knownSource;
    if (utmSource) return utmSource.replace(/[^a-z0-9_-]/g, "_").slice(0, 64) || "other";

    var referrerSource = sourceFromText(referrer) || sourceFromText(firstReferrer);
    if (referrerSource) return referrerSource;
    if (!referrer && !firstReferrer) return "direct";
    return "other";
  }

  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (error) {
      return "";
    }
  }

  function updateStoredAttribution() {
    var queryAttribution = getQueryAttribution();
    var firstAttribution = readJSON(window.localStorage, STORAGE_KEYS.firstAttribution, {});
    var currentAttribution = readJSON(window.localStorage, STORAGE_KEYS.currentAttribution, {});

    if (queryAttribution) {
      if (!safeHas(window.localStorage, STORAGE_KEYS.firstAttribution)) {
        writeJSON(window.localStorage, STORAGE_KEYS.firstAttribution, queryAttribution);
      }
      writeJSON(window.localStorage, STORAGE_KEYS.currentAttribution, queryAttribution);
      currentAttribution = queryAttribution;
    } else if (!safeHas(window.localStorage, STORAGE_KEYS.currentAttribution) && firstAttribution) {
      currentAttribution = firstAttribution;
    }

    return currentAttribution || {};
  }

  function updatePageHistory() {
    var currentPath = window.location.pathname + window.location.search;
    var history = readJSON(window.sessionStorage, STORAGE_KEYS.pageHistory, []);
    if (!Array.isArray(history)) history = [];
    if (history[history.length - 1] !== currentPath) {
      history.push(currentPath);
    }
    history = history.slice(-10);
    writeJSON(window.sessionStorage, STORAGE_KEYS.pageHistory, history);
    return history;
  }

  function initializeVisit() {
    if (!safeHas(window.localStorage, STORAGE_KEYS.firstLandingPage)) {
      safeSet(window.localStorage, STORAGE_KEYS.firstLandingPage, window.location.href);
    }

    if (!safeHas(window.localStorage, STORAGE_KEYS.firstReferrer)) {
      safeSet(window.localStorage, STORAGE_KEYS.firstReferrer, document.referrer || "");
    }

    updateStoredAttribution();
    updatePageHistory();
  }

  function getLeadSourceData() {
    var attribution = updateStoredAttribution();
    var firstLandingPage = safeGet(window.localStorage, STORAGE_KEYS.firstLandingPage) || window.location.href;
    var firstReferrer = safeGet(window.localStorage, STORAGE_KEYS.firstReferrer);
    var pageHistory = readJSON(window.sessionStorage, STORAGE_KEYS.pageHistory, []);
    var data = {
      lead_ref: getLeadRef(),
      visitor_id: getVisitorId(),
      lead_source: "website",
      source_type: getSourceType(attribution, document.referrer || "", firstReferrer),
      first_landing_page: firstLandingPage,
      current_page: window.location.href,
      referrer: document.referrer || "",
      first_referrer: firstReferrer,
      browser_language: navigator.language || "",
      user_timezone: getTimezone(),
      submit_time: new Date().toISOString(),
      page_history: Array.isArray(pageHistory) ? pageHistory.join(" > ") : ""
    };

    ATTRIBUTION_FIELDS.forEach(function (name) {
      data[name] = attribution && attribution[name] ? attribution[name] : "";
    });

    return data;
  }

  function ensureHiddenField(form, name) {
    var field = form.querySelector('[name="' + name + '"]');
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = name;
      form.appendChild(field);
    }
    return field;
  }

  function fillForm(form) {
    if (!form || !form.elements) return;
    var data = getLeadSourceData();
    FIELD_NAMES.forEach(function (name) {
      ensureHiddenField(form, name).value = data[name] || "";
    });
  }

  function fillAllForms() {
    Array.prototype.forEach.call(document.forms || [], fillForm);
  }

  function sendGenerateLeadEvent(data) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "generate_lead", {
      source_type: data.source_type,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      current_page: data.current_page
    });
  }

  function sendWhatsappClickEvent(data) {
    var payload = JSON.stringify(Object.assign({ event_type: "whatsapp_click" }, data));
    if (navigator && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/track-lead-event", payload);
    } else if (typeof window.fetch === "function") {
      window.fetch("/api/track-lead-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(function () {});
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", "whatsapp_click", {
        lead_ref: data.lead_ref,
        source_type: data.source_type,
        current_page: data.current_page
      });
    }
  }

  function handleSubmit(event) {
    var form = event.target;
    if (!form || form.tagName !== "FORM") return;
    fillForm(form);
    sendGenerateLeadEvent(getLeadSourceData());
  }

  function debugIfRequested() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("debug_lead_source") === "1") {
      console.log("Lead Source Tracking", getLeadSourceData());
    }
  }

  function normalizeWhatsappLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href*="wa.me/' + WHATSAPP_NUMBER + '"]'), function (link) {
      var leadRef = createLeadRef();
      link.href = getWhatsappUrl(leadRef);
      link.dataset.sendoraLeadRef = leadRef;
      link.addEventListener("click", function () {
        var data = getLeadSourceData();
        data.lead_ref = leadRef;
        sendWhatsappClickEvent(data);
      });
    });
  }

  function start() {
    initializeVisit();
    fillAllForms();
    normalizeWhatsappLinks();
    debugIfRequested();
    document.addEventListener("submit", handleSubmit, true);
  }

  window.SendoraLeadSourceTracker = {
    getData: getLeadSourceData,
    fillForms: fillAllForms,
    whatsapp: {
      number: WHATSAPP_NUMBER,
      message: WHATSAPP_MESSAGE,
      getUrl: function () { return getWhatsappUrl(getLeadRef()); }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
