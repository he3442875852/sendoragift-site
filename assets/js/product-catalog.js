(function () {
  "use strict";

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function validKind(value) {
    return value === "sets" || value === "single" ? value : "all";
  }

  function validOccasion(value) {
    return ["workplace", "clients", "events", "sports", "travel"].includes(value) ? value : "all";
  }

  function matches(item, kind, query, occasion) {
    if (validKind(kind) !== "all" && item.kind !== kind) return false;
    if (validOccasion(occasion) !== "all" && String(item.occasions || "").split(/\s+/).indexOf(occasion) === -1) return false;
    var text = normalize(item.text);
    return normalize(query).split(/\s+/).every(function (word) {
      return text.indexOf(word) !== -1 || (word.length > 3 && word.endsWith("s") && text.indexOf(word.slice(0, -1)) !== -1);
    });
  }

  function setup(root, host) {
    var controls = root.querySelector("[data-catalog-controls]");
    var search = root.querySelector("[data-catalog-search]");
    var occasionSelect = root.querySelector("[data-catalog-occasion]");
    var status = root.querySelector("[data-catalog-status]");
    var empty = root.querySelector("[data-catalog-empty]");
    var buttons = Array.from(root.querySelectorAll("[data-catalog-kind]"));
    var cards = Array.from(root.querySelectorAll("[data-catalog-item]"));
    var groups = Array.from(root.querySelectorAll("[data-catalog-group]"));
    if (!controls || !search || !status || !empty || !cards.length) return;
    var params = new URLSearchParams(host.location.search);
    var kind = validKind(params.get("type"));
    var occasion = validOccasion(params.get("occasion"));
    if (occasionSelect) occasionSelect.value = occasion;
    search.value = (params.get("q") || "").slice(0, 100);

    function apply() {
      var count = 0;
      cards.forEach(function (card) {
        card.hidden = !matches({ kind: card.dataset.productKind, text: card.dataset.search, occasions: card.dataset.occasions }, kind, search.value, occasion);
        if (!card.hidden) count += 1;
      });
      groups.forEach(function (group) {
        group.hidden = !cards.some(function (card) { return group.contains(card) && !card.hidden; });
      });
      buttons.forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.catalogKind === kind)); });
      status.textContent = count + (count === 1 ? " product direction" : " product directions") + (search.value.trim() || occasion !== "all" ? (count === 1 ? " matches your filters" : " match your filters") : " available");
      empty.hidden = count !== 0;
    }

    function saveFilters() {
      try {
        var url = new URL(host.location.href);
        if (kind === "all") url.searchParams.delete("type");
        else url.searchParams.set("type", kind);
        if (occasion === "all") url.searchParams.delete("occasion");
        else url.searchParams.set("occasion", occasion);
        if (search.value.trim()) url.searchParams.set("q", search.value.trim());
        else url.searchParams.delete("q");
        host.history.replaceState(null, "", url.href);
      } catch (_) { /* Search remains usable when history is unavailable. */ }
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        kind = validKind(button.dataset.catalogKind);
        apply();
        saveFilters();
      });
    });
    search.addEventListener("input", function () { apply(); saveFilters(); });
    if (occasionSelect) occasionSelect.addEventListener("change", function () {
      occasion = validOccasion(occasionSelect.value);
      apply(); saveFilters();
    });
    root.querySelectorAll("[data-catalog-reset]").forEach(function (button) {
      button.addEventListener("click", function () {
        search.value = "";
        occasion = "all";
        if (occasionSelect) occasionSelect.value = "all";
        var all = buttons.find(function (button) { return button.dataset.catalogKind === "all"; });
        if (all) all.click();
        else { kind = "all"; apply(); }
        search.focus();
      });
    });
    host.addEventListener("popstate", function () {
      var restored = new URLSearchParams(host.location.search);
      kind = validKind(restored.get("type"));
      occasion = validOccasion(restored.get("occasion"));
      if (occasionSelect) occasionSelect.value = occasion;
      search.value = (restored.get("q") || "").slice(0, 100);
      apply();
    });
    controls.hidden = false;
    apply();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { matches: matches, validKind: validKind, validOccasion: validOccasion, setup: setup };
  if (typeof document !== "undefined") document.querySelectorAll("[data-product-catalog]").forEach(function (root) { setup(root, window); });
})();
