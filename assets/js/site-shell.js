(function () {
  "use strict";
  function setup(header, doc, host) {
    var button = header.querySelector("[data-site-menu-toggle]");
    var nav = header.querySelector("[data-site-nav]");
    if (!button || !nav) return;
    var menus = Array.from(header.querySelectorAll ? header.querySelectorAll("[data-nav-group]") : []);
    function closeGroups(except) {
      menus.forEach(function (menu) { if (menu !== except) menu.open = false; });
    }
    function setOpen(open, returnFocus) {
      button.setAttribute("aria-expanded", String(open));
      if (open) header.setAttribute("data-menu-open", "");
      else header.removeAttribute("data-menu-open");
      if (!open) closeGroups();
      if (returnFocus) button.focus();
    }
    button.hidden = false;
    header.classList.add("site-shell-enhanced");
    button.addEventListener("click", function () { setOpen(button.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (event) { if (event.target.closest("a")) setOpen(false); });
    menus.forEach(function (menu) {
      menu.addEventListener("toggle", function () { if (menu.open) closeGroups(menu); });
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var active = menus.find(function (menu) { return menu.open; });
      if (active) { closeGroups(); active.querySelector("summary").focus(); }
      else if (button.getAttribute("aria-expanded") === "true") setOpen(false, true);
    });
    doc.addEventListener("click", function (event) { if (!header.contains(event.target)) setOpen(false); });
    if (typeof host.matchMedia === "function") {
      var narrow = host.matchMedia("(max-width: 960px)");
      if (typeof narrow.addEventListener === "function") narrow.addEventListener("change", function () { setOpen(false); });
    }
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { setup: setup };
  if (typeof document !== "undefined") document.querySelectorAll("[data-site-header]").forEach(function (header) { setup(header, document, window); });
})();
