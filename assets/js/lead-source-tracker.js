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

  function installWhatsappButton() {
    var buttonId = "sendora-whatsapp-float";
    var styleId = "sendora-whatsapp-float-style";
    var whatsappUrl = "https://wa.me/8618390800841?text=Hello%20Sendora%20Gift%2C%20I%20need%20corporate%20gift%20ideas%20and%20a%20price%20range.";

    Array.prototype.forEach.call(document.querySelectorAll(".home-whatsapp, #whatsapp-btn, a.whatsapp"), function (oldButton) {
      if (oldButton.id !== buttonId) {
        oldButton.style.display = "none";
        oldButton.setAttribute("aria-hidden", "true");
        oldButton.setAttribute("tabindex", "-1");
      }
    });

    if (!document.getElementById(styleId)) {
      var style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        "#" + buttonId + "{position:fixed;left:18px;bottom:18px;z-index:9999;width:52px;height:52px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(135deg,#2ee978 0%,#19b85a 58%,#0f9449 100%);border:2px solid rgba(255,255,255,.96);box-shadow:0 12px 28px rgba(13,21,18,.22),0 0 0 7px rgba(37,211,102,.12);color:#fff!important;font-size:0!important;line-height:0!important;text-decoration:none!important;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}",
        "#" + buttonId + ":hover,#" + buttonId + ":focus-visible{color:#fff!important;filter:saturate(1.08);transform:translateY(-2px) scale(1.04);box-shadow:0 16px 34px rgba(13,21,18,.28),0 0 0 8px rgba(37,211,102,.16);outline:none}",
        "#" + buttonId + " svg{width:29px;height:29px;display:block;fill:currentColor;flex:0 0 auto}",
        "#" + buttonId + " span{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}",
        "@media(max-width:560px){#" + buttonId + "{left:16px;bottom:16px;width:50px;height:50px;box-shadow:0 10px 24px rgba(13,21,18,.2),0 0 0 6px rgba(37,211,102,.12)}#" + buttonId + " svg{width:27px;height:27px}}"
      ].join("");
      document.head.appendChild(style);
    }

    if (document.getElementById(buttonId)) return;

    var button = document.createElement("a");
    button.id = buttonId;
    button.href = whatsappUrl;
    button.target = "_blank";
    button.rel = "noopener";
    button.setAttribute("aria-label", "Chat with Sendora Gift on WhatsApp");
    button.innerHTML = [
      '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">',
      '<path d="M16.04 3.2A12.75 12.75 0 0 0 5.08 22.5L3.7 28.8l6.44-1.7a12.73 12.73 0 0 0 5.9 1.5h.01A12.7 12.7 0 0 0 28.8 15.9 12.73 12.73 0 0 0 16.04 3.2Zm0 23.24h-.01a10.62 10.62 0 0 1-5.4-1.48l-.39-.23-3.82 1.01.81-3.74-.25-.39a10.58 10.58 0 1 1 9.06 4.83Zm5.8-7.94c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.31-.81 1.03-.99 1.24-.18.21-.37.24-.68.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.88-1.76-2.19-.18-.32-.02-.49.14-.65.14-.14.32-.37.47-.55.16-.18.21-.32.32-.53.11-.21.05-.39-.03-.55-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.53-.71-.54h-.61c-.21 0-.55.08-.84.39-.29.32-1.1 1.08-1.1 2.62 0 1.55 1.13 3.04 1.29 3.25.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.88-.77 2.14-1.51.26-.74.26-1.38.18-1.51-.08-.13-.29-.21-.61-.37Z"/>',
      "</svg>",
      "<span>WhatsApp</span>"
    ].join("");
    document.body.appendChild(button);
  }

  function start() {
    initializeVisit();
    fillAllForms();
    installWhatsappButton();
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
