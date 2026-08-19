(function () {
  "use strict";

  function setup(form) {
    var steps = Array.prototype.slice.call(form.querySelectorAll("[data-form-step]"));
    var progress = Array.prototype.slice.call(form.querySelectorAll(".form-progress li"));
    if (steps.length < 2) return;

    var current = 0;
    form.classList.add("is-multistep");

    function show(index, focusHeading) {
      current = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach(function (step, stepIndex) {
        step.hidden = stepIndex !== current;
      });
      progress.forEach(function (item, itemIndex) {
        if (itemIndex === current) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      });
      form.setAttribute("data-current-step", String(current + 1));
      if (focusHeading) {
        var legend = steps[current].querySelector("legend");
        if (legend) {
          legend.setAttribute("tabindex", "-1");
          legend.focus();
        }
      }
    }

    function validateCurrentStep() {
      var controls = steps[current].querySelectorAll("input, select, textarea");
      for (var i = 0; i < controls.length; i += 1) {
        if (typeof controls[i].reportValidity === "function" && !controls[i].reportValidity()) return false;
      }
      return true;
    }

    form.addEventListener("click", function (event) {
      var next = event.target.closest("[data-step-next]");
      var back = event.target.closest("[data-step-back]");
      if (next) {
        if (validateCurrentStep()) show(current + 1, true);
      } else if (back) {
        show(current - 1, true);
      }
    });

    form.addEventListener("sendora:quote-reset", function () {
      show(0, false);
    });

    form.addEventListener("submit", function (event) {
      if (current !== steps.length - 1) {
        event.preventDefault();
        if (validateCurrentStep()) show(current + 1, true);
      }
    });

    show(0, false);
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-multistep-form]"), setup);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
