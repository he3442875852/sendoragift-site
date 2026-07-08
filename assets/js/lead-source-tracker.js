(function () {
  "use strict";

  var FIELD_NAMES = [
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
    firstLandingPage: "sendora_first_landing_page",
    firstReferrer: "sendora_first_referrer",
    firstAttribution: "sendora_first_attribution",
    currentAttribution: "sendora_current_attribution",
    pageHistory: "sendora_page_history"
  };

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

  function start() {
    initializeVisit();
    fillAllForms();
    debugIfRequested();
    document.addEventListener("submit", handleSubmit, true);
  }

  window.SendoraLeadSourceTracker = {
    getData: getLeadSourceData,
    fillForms: fillAllForms
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
