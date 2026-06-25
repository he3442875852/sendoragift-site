(function () {
  document.documentElement.classList.add("js");

  const header = document.querySelector("[data-home-header]");
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("home-nav");

  function setHeaderState() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  function closeMenu() {
    if (!header || !toggle) return;
    header.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    if (!header || !toggle) return;
    const nextState = !header.classList.contains("nav-open");
    header.classList.toggle("nav-open", nextState);
    toggle.setAttribute("aria-expanded", String(nextState));
  }

  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  if (toggle) {
    toggle.addEventListener("click", toggleMenu);
  }

  if (nav) {
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  document.querySelectorAll(".faq-list details").forEach(function (item) {
    const summary = item.querySelector("summary");
    if (!summary) return;
    summary.setAttribute("aria-expanded", String(item.open));
    item.addEventListener("toggle", function () {
      summary.setAttribute("aria-expanded", String(item.open));
    });
  });

  const revealItems = document.querySelectorAll(".section-reveal");
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach(function (item) {
    observer.observe(item);
  });
})();
