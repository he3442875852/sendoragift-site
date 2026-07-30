(function () {
  "use strict";

  var SUCCESS_MESSAGE = "Thank you. Your quote request has been submitted successfully.";
  var FORM_ERROR_MESSAGE = "Please check the form information and try again.";
  var TURNSTILE_ERROR_MESSAGE = "We could not verify your submission. Please refresh the page and try again.";
  var SERVICE_ERROR_MESSAGE = "We could not submit your request at this time. Please try again later or contact us by email.";
  var API_ENDPOINT = "/api/submit-quote";
  var KEY_ENDPOINT = "/api/turnstile-site-key";
  var turnstileSiteKey = "";
  var turnstileReady = null;

  function isQuoteForm(form) {
    if (!form || form.tagName !== "FORM") return false;
    var action = form.getAttribute("action") || "";
    return action === API_ENDPOINT || form.querySelector('[name="email"]');
  }

  function ensureField(form, name, type) {
    var field = form.querySelector('[name="' + name + '"]');
    if (!field) {
      field = document.createElement("input");
      field.type = type || "hidden";
      field.name = name;
      form.appendChild(field);
    }
    return field;
  }

  function ensureHoneypot(form) {
    var field = ensureField(form, "company_website_url", "text");
    field.tabIndex = -1;
    field.autocomplete = "off";
    field.setAttribute("aria-hidden", "true");
    field.style.position = "absolute";
    field.style.left = "-10000px";
    field.style.top = "auto";
    field.style.width = "1px";
    field.style.height = "1px";
    field.style.overflow = "hidden";
  }

  function ensureStartedAt(form) {
    var field = ensureField(form, "form_started_at", "hidden");
    if (!field.value) field.value = String(Date.now());
  }

  function ensureStatus(form) {
    var status = form.querySelector("[data-quote-status]");
    if (!status) {
      status = document.createElement("div");
      status.setAttribute("data-quote-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.style.marginTop = "12px";
      status.style.fontSize = "14px";
      var button = form.querySelector('[type="submit"]');
      if (button && button.parentNode) button.parentNode.insertBefore(status, button.nextSibling);
      else form.appendChild(status);
    }
    return status;
  }

  function setStatus(form, message, isError) {
    var status = ensureStatus(form);
    status.textContent = message || "";
    status.style.color = isError ? "#b42318" : "#1f6f43";
  }

  function fetchSiteKey() {
    if (turnstileReady) return turnstileReady;
    turnstileReady = fetch(KEY_ENDPOINT, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error("site_key_unavailable");
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.siteKey) throw new Error("site_key_missing");
        turnstileSiteKey = data.siteKey;
        return loadTurnstileScript();
      });
    return turnstileReady;
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function ensureTurnstile(form) {
    var holder = form.querySelector("[data-sendora-turnstile]");
    if (!holder) {
      holder = document.createElement("div");
      holder.setAttribute("data-sendora-turnstile", "");
      holder.style.margin = "12px 0";
      var button = form.querySelector('[type="submit"]');
      if (button && button.parentNode) button.parentNode.insertBefore(holder, button);
      else form.appendChild(holder);
    }

    return fetchSiteKey()
      .then(function () {
        if (!window.turnstile || holder.getAttribute("data-widget-id")) return;
        var widgetId = window.turnstile.render(holder, {
          sitekey: turnstileSiteKey,
          callback: function () {
            setStatus(form, "", false);
          },
          "expired-callback": function () {
            if (window.turnstile) window.turnstile.reset(widgetId);
          },
          "error-callback": function () {
            setStatus(form, TURNSTILE_ERROR_MESSAGE, true);
          }
        });
        holder.setAttribute("data-widget-id", widgetId);
      })
      .catch(function () {
        form.setAttribute("data-turnstile-unavailable", "1");
      });
  }

  function resetTurnstile(form) {
    var holder = form.querySelector("[data-sendora-turnstile]");
    var widgetId = holder && holder.getAttribute("data-widget-id");
    try {
      if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
    } catch (error) {
      // A reset failure should not turn a completed customer submission into an error.
    }
  }

  function setPending(form, pending) {
    var button = form.querySelector('[type="submit"]');
    if (!button) return;
    if (pending) {
      button.setAttribute("data-original-label", button.textContent);
      button.disabled = true;
      button.textContent = "Submitting...";
    } else {
      button.disabled = false;
      var label = button.getAttribute("data-original-label");
      if (label) button.textContent = label;
    }
  }

  function updateFileLabels(form) {
    Array.prototype.forEach.call(form.querySelectorAll('.file-upload input[type="file"]'), function (input) {
      var display = input.closest(".file-upload") && input.closest(".file-upload").querySelector(".file-name");
      if (display) display.textContent = input.files && input.files.length ? input.files[0].name : "No file selected";
    });
  }

  function resetForm(form) {
    try {
      form.reset();
    } catch (error) {}

    try {
      var startedAt = ensureStartedAt(form);
      if (startedAt) startedAt.value = String(Date.now());
    } catch (error) {}

    try {
      updateFileLabels(form);
    } catch (error) {}

    resetTurnstile(form);

    try {
      if (window.SendoraLeadSourceTracker && typeof window.SendoraLeadSourceTracker.fillForms === "function") {
        window.SendoraLeadSourceTracker.fillForms();
      }
    } catch (error) {}
  }

  function handleSubmit(event) {
    var form = event.target;
    if (!isQuoteForm(form)) return;
    event.preventDefault();
    if (form.getAttribute("data-submitting") === "1") return;

    if (window.SendoraLeadSourceTracker && typeof window.SendoraLeadSourceTracker.fillForms === "function") {
      window.SendoraLeadSourceTracker.fillForms();
    }

    if (form.getAttribute("data-turnstile-unavailable") === "1") {
      setStatus(form, TURNSTILE_ERROR_MESSAGE, true);
      return;
    }

    var token = form.querySelector('[name="cf-turnstile-response"]');
    if (!token || !token.value) {
      setStatus(form, TURNSTILE_ERROR_MESSAGE, true);
      resetTurnstile(form);
      return;
    }

    form.setAttribute("data-submitting", "1");
    setPending(form, true);
    setStatus(form, "", false);

    fetch(API_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form)
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok) {
            var error = new Error(data.message || FORM_ERROR_MESSAGE);
            error.status = response.status;
            error.publicMessage = data.message || "";
            throw error;
          }
          return data;
        });
      })
      .then(function (data) {
        setStatus(form, data.message || SUCCESS_MESSAGE, false);
        resetForm(form);
      })
      .catch(function (error) {
        if (error.publicMessage) setStatus(form, error.publicMessage, true);
        else if (error.message === TURNSTILE_ERROR_MESSAGE) setStatus(form, TURNSTILE_ERROR_MESSAGE, true);
        else if (error.status >= 500) setStatus(form, SERVICE_ERROR_MESSAGE, true);
        else setStatus(form, FORM_ERROR_MESSAGE, true);
        resetTurnstile(form);
      })
      .finally(function () {
        form.removeAttribute("data-submitting");
        setPending(form, false);
      });
  }

  function prepareForm(form) {
    if (!isQuoteForm(form)) return;
    form.setAttribute("action", API_ENDPOINT);
    form.setAttribute("method", "POST");
    form.setAttribute("enctype", "multipart/form-data");
    ensureHoneypot(form);
    ensureStartedAt(form);
    ensureStatus(form);
    ensureTurnstile(form);
  }

  function start() {
    Array.prototype.forEach.call(document.forms || [], prepareForm);
    document.addEventListener("submit", handleSubmit, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
