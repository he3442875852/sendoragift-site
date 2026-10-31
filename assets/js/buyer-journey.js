(function () {
  "use strict";
  function setup(doc, host) {
    if (!doc.body || doc.body.hasAttribute("data-journey-ready")) return;
    doc.body.setAttribute("data-journey-ready", "");
    var registry = host.SendoraGiftDirections;
    function productId() { return doc.body.getAttribute("data-buyer-product") || ""; }
    function track(name, extra) {
      if (host.SendoraLeadSourceTracker) host.SendoraLeadSourceTracker.track(name, Object.assign({ product_id: productId() }, extra));
    }
    var builders = doc.querySelectorAll("[data-direction-builder]");
    if (productId() && builders.length) track("product_detail_view");
    builders.forEach(function (form) {
      function selection() {
        var product = form.querySelector('[name="product"]');
        var radio = form.querySelector('[name="configuration"]:checked');
        return product && radio && registry ? registry.resolve(product.value, radio.value) : null;
      }
      function sync() {
        var chosen = selection();
        if (!chosen) return;
        var packing = form.querySelector('[name="packing"]');
        doc.body.setAttribute("data-inquiry-configuration", chosen.label);
        doc.body.setAttribute("data-inquiry-packing", registry.packingLabel(packing ? packing.value : ""));
        doc.body.setAttribute("data-buyer-configuration", chosen.id);
        doc.body.setAttribute("data-buyer-packing", packing && registry.packingLabel(packing.value) ? packing.value : "");
        if (host.SendoraLeadSourceTracker && host.SendoraLeadSourceTracker.refreshWhatsApp) host.SendoraLeadSourceTracker.refreshWhatsApp();
      }
      sync();
      form.addEventListener("change", function (event) {
        sync();
        var chosen = selection();
        if (chosen && event.target.name === "configuration") track("gift_direction_select", { configuration_id: chosen.id });
      });
      form.addEventListener("submit", function () {
        var chosen = selection();
        if (!chosen) return;
        var packing = form.querySelector('[name="packing"]');
        track("quote_builder_continue", { configuration_id: chosen.id, packing_id: packing && registry.packingLabel(packing.value) ? packing.value : "unspecified" });
      });
    });
    doc.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a");
      if (!link) return;
      var evidence = link.getAttribute("data-evidence-id");
      if (evidence) track("sample_reference_open", { evidence_id: evidence });
      try {
        var url = new URL(link.href, host.location.href);
        if (url.origin === host.location.origin && ["/contact/", "/quote.html"].includes(url.pathname)) track("quote_start", { journey_step: "quote_link" });
      } catch (_) { /* Non-URL links do not affect the quote flow. */ }
    });
    doc.querySelectorAll("video[data-evidence-id]").forEach(function (video) {
      video.addEventListener("play", function () { track("sample_video_start", { evidence_id: video.getAttribute("data-evidence-id") }); }, { once: true });
    });
    doc.querySelectorAll('form[action="/api/submit-quote"]').forEach(function (form) {
      var started = false;
      form.addEventListener("input", function () {
        if (!started) { started = true; track("quote_form_start", { journey_step: "form_input" }); }
      });
    });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { setup: setup };
  if (typeof document !== "undefined") setup(document, window);
})();
