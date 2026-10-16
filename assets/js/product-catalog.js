(function () {
  "use strict";

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function validKind(value) {
    return value === "sets" || value === "single" ? value : "all";
  }

  function matches(item, kind, query) {
    if (validKind(kind) !== "all" && item.kind !== kind) return false;
    var text = normalize(item.text);
    return normalize(query).split(/\s+/).every(function (word) {
      return text.indexOf(word) !== -1 || (word.length > 3 && word.endsWith("s") && text.indexOf(word.slice(0, -1)) !== -1);
    });
  }

  function setup(root, host) {
    var controls = root.querySelector("[data-catalog-controls]");
    var search = root.querySelector("[data-catalog-search]");
    var status = root.querySelector("[data-catalog-status]");
    var empty = root.querySelector("[data-catalog-empty]");
    var buttons = Array.from(root.querySelectorAll("[data-catalog-kind]"));
    var cards = Array.from(root.querySelectorAll("[data-catalog-item]"));
    var groups = Array.from(root.querySelectorAll("[data-catalog-group]"));
    if (!controls || !search || !status || !empty || !cards.length) return;
    var kind = validKind(new URLSearchParams(host.location.search).get("type"));

    function apply() {
      var count = 0;
      cards.forEach(function (card) {
        card.hidden = !matches({ kind: card.dataset.productKind, text: card.dataset.search }, kind, search.value);
        if (!card.hidden) count += 1;
      });
      groups.forEach(function (group) {
        group.hidden = !cards.some(function (card) { return group.contains(card) && !card.hidden; });
      });
      buttons.forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.catalogKind === kind)); });
      status.textContent = count + (count === 1 ? " product direction" : " product directions") + (search.value.trim() ? " match your search" : " available");
      empty.hidden = count !== 0;
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        kind = validKind(button.dataset.catalogKind);
        apply();
        try {
          var url = new URL(host.location.href);
          if (kind === "all") url.searchParams.delete("type");
          else url.searchParams.set("type", kind);
          host.history.replaceState(null, "", url.href);
        } catch (_) { /* Filtering remains usable when history is unavailable. */ }
      });
    });
    search.addEventListener("input", apply);
    root.querySelectorAll("[data-catalog-reset]").forEach(function (button) {
      button.addEventListener("click", function () {
        search.value = "";
        var all = buttons.find(function (button) { return button.dataset.catalogKind === "all"; });
        if (all) all.click();
        else { kind = "all"; apply(); }
        search.focus();
      });
    });
    host.addEventListener("popstate", function () {
      kind = validKind(new URLSearchParams(host.location.search).get("type"));
      apply();
    });
    controls.hidden = false;
    apply();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { matches: matches, validKind: validKind, setup: setup };
  if (typeof document !== "undefined") document.querySelectorAll("[data-product-catalog]").forEach(function (root) { setup(root, window); });
})();
