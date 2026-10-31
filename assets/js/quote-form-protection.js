(function () {
  "use strict";

  function create(doc, host) {
  var document = doc;
  var window = host;
  var fetch = host.fetch.bind(host);
  var FormData = host.FormData;

  var SUCCESS_MESSAGE = "Thank you. Your quote request has been submitted successfully.";
  var FORM_ERROR_MESSAGE = "Please check the form information and try again.";
  var TURNSTILE_ERROR_MESSAGE = "We could not verify your submission. Please refresh the page and try again.";
  var VERIFICATION_ACTION_MESSAGE = "Complete the verification check before submitting. If it does not load, retry the check below or contact us directly.";
  var SERVICE_ERROR_MESSAGE = "We could not submit your request at this time. Please try again later or contact us by email.";
  var API_ENDPOINT = "/api/submit-quote";
  var KEY_ENDPOINT = "/api/turnstile-site-key";
  var turnstileSiteKey = "";
  var turnstileReady = null;
  var maxAttachmentBytes = 4 * 1024 * 1024;
  var configuredForms = [];
  var fileCounter = 0;
  var NETWORK_ERROR_MESSAGE = "We could not confirm your request. Your details are still here. Check your connection before trying again, or contact us directly.";

  function timedRequest(operation, timeoutMs) {
    var timer;
    var controller = window.AbortController ? new window.AbortController() : null;
    var timeout = new Promise(function (_, reject) {
      timer = window.setTimeout(function () {
        if (controller) controller.abort();
        var error = new Error("request_timeout");
        error.networkFailure = true;
        reject(error);
      }, timeoutMs);
    });
    return Promise.race([Promise.resolve().then(function () { return operation(controller ? controller.signal : undefined); }), timeout])
      .finally(function () { window.clearTimeout(timer); });
  }

  function trackError(category) {
    try {
      if (window.SendoraLeadSourceTracker) window.SendoraLeadSourceTracker.track("quote_submit_error", { journey_step: category });
    } catch (_) {}
  }

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
    var fields = [ensureField(form, "company_website_url", "text"), form.querySelector('[name="_gotcha"]')];
    fields.filter(Boolean).forEach(function (field) {
    field.tabIndex = -1;
    field.autocomplete = "off";
    field.setAttribute("aria-hidden", "true");
    field.style.position = "absolute";
    field.style.left = "-10000px";
    field.style.top = "auto";
    field.style.width = "1px";
    field.style.height = "1px";
    field.style.overflow = "hidden";
    });
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
    if (status.closest && status.closest("[data-form-step]")) form.appendChild(status);
    return status;
  }

  function setStatus(form, message, isError) {
    var status = ensureStatus(form);
    status.textContent = message || "";
    status.style.color = isError ? "#b42318" : "#1f6f43";
    status.style.flexBasis = "100%";
    status.style.width = "100%";
  }

  function ensureRecovery(form) {
    var panel = form.querySelector("[data-quote-recovery]");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.setAttribute("data-quote-recovery", "");
    panel.setAttribute("aria-label", "Submission help");
    panel.hidden = true;
    panel.style.cssText = "flex-basis:100%;width:100%;margin-top:12px;padding:14px;border:1px solid #d8cbb5;border-radius:6px;background:#faf7f0;color:#51452f;font-size:14px;line-height:1.6";
    var copy = document.createElement("p");
    copy.textContent = "You can send your project brief by email or WhatsApp. An unconfirmed submission stays in this form.";
    panel.appendChild(copy);
    var retry = document.createElement("button");
    retry.type = "button";
    retry.setAttribute("data-quote-retry-verification", "");
    retry.textContent = "Retry verification";
    retry.style.cssText = "margin:10px 12px 0 0;padding:8px 12px;min-height:44px;font:inherit;cursor:pointer";
    retry.addEventListener("click", function () {
      retry.disabled = true;
      retry.textContent = "Loading verification...";
      form.removeAttribute("data-turnstile-unavailable");
      ensureTurnstile(form, true).then(function (ready) {
        retry.disabled = false;
        retry.textContent = "Retry verification";
        if (ready) {
          retry.hidden = true;
          setStatus(form, "Verification is ready. Complete the check, then submit your request.", false);
        }
      });
    });
    panel.appendChild(retry);
    [["mailto:mcpatch@188.com", "Email us"], ["https://wa.me/8613400883682", "WhatsApp"]].forEach(function (item) {
      var link = document.createElement("a");
      link.href = item[0];
      link.textContent = item[1];
      link.style.cssText = "display:inline-block;margin:10px 16px 0 0;padding:8px 0;min-height:44px;color:#765522;text-decoration:underline";
      if (item[0].indexOf("https:") === 0) { link.target = "_blank"; link.rel = "noopener"; }
      panel.appendChild(link);
    });
    var status = ensureStatus(form);
    status.parentNode.insertBefore(panel, status.nextSibling);
    if (window.SendoraLeadSourceTracker && window.SendoraLeadSourceTracker.refreshWhatsApp) window.SendoraLeadSourceTracker.refreshWhatsApp();
    return panel;
  }

  function showRecovery(form, verification) {
    var panel = ensureRecovery(form);
    panel.hidden = false;
    panel.querySelector("[data-quote-retry-verification]").hidden = !verification;
  }

  function fileLimitLabel() {
    return (Math.floor(maxAttachmentBytes / (1024 * 1024) * 100) / 100).toString() + " MB";
  }

  function checkFile(input) {
    var files = input.files || [];
    var message = "";
    if (files.length > 1) message = "Choose one JPG, PNG or PDF, or send additional files by email.";
    else if (files.length && !/\.(jpe?g|png|pdf)$/i.test(files[0].name)) message = "Choose a JPG, PNG or PDF. You can send other artwork formats by email or WhatsApp.";
    else if (files.length && files[0].size > maxAttachmentBytes) message = "Choose a file smaller than " + fileLimitLabel() + ", or remove it and send the artwork later.";
    input.setCustomValidity(message);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    var hint = document.getElementById(input.getAttribute("data-file-feedback"));
    if (hint) { hint.textContent = message || "One JPG, PNG or PDF. Keep files below " + fileLimitLabel() + "; artwork can also be sent later."; hint.style.color = message ? "#b42318" : "#625f58"; }
    return !message;
  }

  function prepareFiles(form) {
    Array.prototype.forEach.call(form.querySelectorAll('input[type="file"]'), function (input) {
      if (!input.hasAttribute("data-file-feedback")) {
        var id = "quote-file-feedback-" + (++fileCounter);
        var field = input.closest(".field");
        var hint = field && field.querySelector(".help, .hint");
        var existingHint = !!hint;
        if (!hint) hint = document.createElement("p");
        if (hint.id) id = hint.id;
        else hint.id = id;
        hint.style.cssText = "margin-top:8px;font-size:13px;line-height:1.5";
        hint.setAttribute("aria-live", "polite");
        input.setAttribute("data-file-feedback", id);
        var descriptions = (input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
        if (descriptions.indexOf(id) < 0) descriptions.push(id);
        input.setAttribute("aria-describedby", descriptions.join(" "));
        var label = input.closest(".file-upload");
        var anchor = label || input;
        if (!existingHint) anchor.parentNode.insertBefore(hint, anchor.nextSibling);
        var remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove file";
        remove.hidden = true;
        remove.setAttribute("data-remove-quote-file", "");
        remove.style.cssText = "margin:8px 0;padding:8px 12px;min-height:44px;font:inherit;cursor:pointer";
        hint.parentNode.insertBefore(remove, hint.nextSibling);
        function update() {
          checkFile(input);
          remove.hidden = !input.files || !input.files.length;
          updateFileLabels(form);
        }
        input.addEventListener("change", update);
        remove.addEventListener("click", function () { input.value = ""; update(); input.focus(); });
      }
      checkFile(input);
    });
  }

  function validateInputs(form) {
    prepareFiles(form);
    var message = form.querySelector('[name="message"]');
    if (message && message.required) message.setCustomValidity(message.value.replace(/\s/g, "").length < 10 ? "Add a short sentence about the products, recipients or event." : "");
    if (form.hasAttribute("data-multistep-ready")) return form.dispatchEvent(new window.CustomEvent("sendora:quote-validate", { cancelable: true }));
    return typeof form.reportValidity !== "function" || form.reportValidity();
  }

  function isKnownPublicMessage(message) {
    return message === SUCCESS_MESSAGE ||
      message === FORM_ERROR_MESSAGE ||
      message === TURNSTILE_ERROR_MESSAGE ||
      message === SERVICE_ERROR_MESSAGE;
  }

  function fetchSiteKey() {
    if (turnstileReady) return turnstileReady;
    turnstileReady = timedRequest(function (signal) {
      return fetch(KEY_ENDPOINT, { headers: { Accept: "application/json" }, signal: signal })
      .then(function (response) {
        if (!response.ok) throw new Error("site_key_unavailable");
        return response.json();
      });
    }, 10000)
      .then(function (data) {
        if (!data || !data.siteKey) throw new Error("site_key_missing");
        turnstileSiteKey = data.siteKey;
        if (Number.isFinite(data.maxAttachmentBytes) && data.maxAttachmentBytes > 0) {
          maxAttachmentBytes = Math.min(data.maxAttachmentBytes, 4 * 1024 * 1024);
          configuredForms.forEach(prepareFiles);
        }
        return loadTurnstileScript();
      }).catch(function (error) {
        turnstileReady = null;
        throw error;
      });
    return turnstileReady;
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');
      if (existing && existing.hasAttribute("data-sendora-load-failed")) {
        existing.parentNode.removeChild(existing);
        existing = null;
      }
      var script = existing || document.createElement("script");
      var timer = window.setTimeout(function () { failed(); }, 10000);
      function cleanup() {
        window.clearTimeout(timer);
        script.removeEventListener("load", loaded);
        script.removeEventListener("error", failed);
      }
      function loaded() {
        cleanup();
        if (window.turnstile) resolve();
        else { script.setAttribute("data-sendora-load-failed", ""); reject(new Error("verification_unavailable")); }
      }
      function failed() {
        cleanup();
        script.setAttribute("data-sendora-load-failed", "");
        reject(new Error("verification_unavailable"));
      }
      script.addEventListener("load", loaded, { once: true });
      script.addEventListener("error", failed, { once: true });
      if (existing) {
        return;
      }
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    });
  }

  function ensureTurnstile(form, retry) {
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
        if (!window.turnstile) throw new Error("verification_unavailable");
        form.removeAttribute("data-turnstile-unavailable");
        if (holder.getAttribute("data-widget-id") !== null) {
          if (retry) window.turnstile.reset(holder.getAttribute("data-widget-id"));
          return true;
        }
        var widgetId = window.turnstile.render(holder, {
          sitekey: turnstileSiteKey,
          callback: function () {
            setStatus(form, "", false);
          },
          "expired-callback": function () {
            if (window.turnstile) window.turnstile.reset(widgetId);
          },
          "error-callback": function () {
            setStatus(form, VERIFICATION_ACTION_MESSAGE, true);
            showRecovery(form, true);
          }
        });
        holder.setAttribute("data-widget-id", widgetId);
        return true;
      })
      .catch(function () {
        form.setAttribute("data-turnstile-unavailable", "1");
        setStatus(form, "Verification could not load. Retry the check or send your brief directly.", true);
        showRecovery(form, true);
        return false;
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
    form.setAttribute("aria-busy", String(pending));
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
      prepareFiles(form);
      Array.prototype.forEach.call(form.querySelectorAll("[data-remove-quote-file]"), function (button) { button.hidden = true; });
    } catch (error) {}

    resetTurnstile(form);

    try {
      if (window.SendoraLeadSourceTracker && typeof window.SendoraLeadSourceTracker.fillForms === "function") {
        window.SendoraLeadSourceTracker.fillForms();
      }
    } catch (error) {}

  }

  function redirectToNextPage(form) {
    var field = form.querySelector('[name="_next"]');
    if (!field || !field.value || !window.location) return;
    try {
      var next = new URL(field.value, window.location.href);
      var allowedHost = next.hostname === "sendoragift.com" || next.hostname === "www.sendoragift.com";
      if (next.protocol === "https:" && allowedHost) window.location.assign(next.href);
    } catch (error) {}
  }

  function handleSubmit(event) {
    var form = event.target;
    if (!isQuoteForm(form)) return;
    event.preventDefault();
    if (form.getAttribute("data-submitting") === "1") return;
    if (!validateInputs(form)) return;

    if (window.SendoraLeadSourceTracker && typeof window.SendoraLeadSourceTracker.fillForms === "function") {
      window.SendoraLeadSourceTracker.fillForms();
    }

    if (form.getAttribute("data-turnstile-unavailable") === "1") {
      setStatus(form, VERIFICATION_ACTION_MESSAGE, true);
      showRecovery(form, true);
      trackError("verification");
      return;
    }

    var token = form.querySelector('[name="cf-turnstile-response"]');
    if (!token || !token.value) {
      setStatus(form, VERIFICATION_ACTION_MESSAGE, true);
      showRecovery(form, true);
      trackError("verification");
      resetTurnstile(form);
      return;
    }

    form.setAttribute("data-submitting", "1");
    setPending(form, true);
    setStatus(form, "", false);
    var recovery = form.querySelector("[data-quote-recovery]");
    if (recovery) recovery.hidden = true;

    return timedRequest(function (signal) { return fetch(API_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form),
      signal: signal
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok) {
            var error = new Error(data.message || FORM_ERROR_MESSAGE);
            error.status = response.status;
            error.publicCode = ["upload_too_large", "invalid_upload"].indexOf(data.code) >= 0 ? data.code : "";
            error.publicMessage = isKnownPublicMessage(data.message) ? data.message : "";
            throw error;
          }
          if (data.ok !== true) {
            var unconfirmed = new Error("unconfirmed_response");
            unconfirmed.networkFailure = true;
            throw unconfirmed;
          }
          return data;
        });
      }); }, 30000)
      .then(function (data) {
        setStatus(form, SUCCESS_MESSAGE, false);
        try {
          if (window.SendoraLeadSourceTracker && typeof window.SendoraLeadSourceTracker.track === "function") {
            window.SendoraLeadSourceTracker.track("generate_lead");
          }
        } catch (error) {}
        resetForm(form);
        redirectToNextPage(form);
      })
      .catch(function (error) {
        var verification = error.publicMessage === TURNSTILE_ERROR_MESSAGE;
        var category = verification ? "verification" : error.publicCode || (error.status >= 500 ? "service" : error.status ? "validation" : "network");
        if (error.status === 413 || error.publicCode === "upload_too_large") setStatus(form, "The request or artwork is too large. Use a smaller file, or remove it and send the artwork later by email or WhatsApp.", true);
        else if (error.publicCode === "invalid_upload") setStatus(form, "The artwork could not be accepted. Choose one valid JPG, PNG or PDF, or remove it and send the file later.", true);
        else if (verification) setStatus(form, VERIFICATION_ACTION_MESSAGE, true);
        else if (!error.status) setStatus(form, NETWORK_ERROR_MESSAGE, true);
        else if (error.publicMessage) setStatus(form, error.publicMessage, true);
        else if (error.status >= 500) setStatus(form, SERVICE_ERROR_MESSAGE, true);
        else setStatus(form, FORM_ERROR_MESSAGE, true);
        showRecovery(form, verification);
        trackError(category);
        resetTurnstile(form);
      })
      .finally(function () {
        form.removeAttribute("data-submitting");
        setPending(form, false);
      });
  }

  function prepareForm(form) {
    if (!isQuoteForm(form)) return;
    if (form.hasAttribute("data-quote-ready")) return;
    form.setAttribute("data-quote-ready", "");
    configuredForms.push(form);
    form.setAttribute("action", API_ENDPOINT);
    form.setAttribute("method", "POST");
    form.setAttribute("enctype", "multipart/form-data");
    ensureHoneypot(form);
    ensureStartedAt(form);
    ensureStatus(form);
    prepareFiles(form);
    var message = form.querySelector('[name="message"]');
    if (message) {
      message.maxLength = 2000;
      message.addEventListener("input", function () { message.setCustomValidity(""); });
    }
    var quantity = form.querySelector('[name="quantity"]');
    if (quantity) { quantity.min = "1"; quantity.max = "1000000"; quantity.step = "1"; }
    form.addEventListener("invalid", function (event) {
      var details = event.target.closest("details");
      if (details) details.open = true;
    }, true);
    ensureTurnstile(form);
  }

  function start() {
    Array.prototype.forEach.call(document.forms || [], prepareForm);
    document.addEventListener("submit", handleSubmit, true);
  }

  return { start: start, prepareForm: prepareForm, handleSubmit: handleSubmit, validateInputs: validateInputs, timedRequest: timedRequest, ensureTurnstile: ensureTurnstile, checkFile: checkFile };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { create: create };
  if (typeof document !== "undefined") {
    var protection = create(document, window);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", protection.start);
    else protection.start();
  }
})();
