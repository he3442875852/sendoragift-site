(function () {
  "use strict";

  function setup(form) {
    if (form.hasAttribute("data-multistep-ready")) return;
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

    function validateStep(index) {
      var controls = steps[index].querySelectorAll("input, select, textarea");
      for (var i = 0; i < controls.length; i += 1) {
        if (typeof controls[i].checkValidity === "function" && !controls[i].checkValidity()) {
          show(index, false);
          var details = controls[i].closest("details");
          if (details) details.open = true;
          controls[i].reportValidity();
          return false;
        }
      }
      return true;
    }

    function validateSubmission(event) {
      if (current !== steps.length - 1) {
        event.preventDefault();
        if (validateStep(current)) show(current + 1, true);
        return;
      }
      for (var index = 0; index < steps.length; index += 1) {
        if (!validateStep(index)) {
          event.preventDefault();
          return;
        }
      }
    }

    form.addEventListener("click", function (event) {
      var next = event.target.closest("[data-step-next]");
      var back = event.target.closest("[data-step-back]");
      if (next) {
        if (validateStep(current)) show(current + 1, true);
      } else if (back) {
        show(current - 1, true);
      }
    });

    form.addEventListener("sendora:quote-reset", function () {
      show(0, false);
    });
    form.addEventListener("reset", function () { show(0, false); });
    form.addEventListener("sendora:quote-validate", validateSubmission);

    form.addEventListener("submit", function (event) {
      // The protection handler validates through the cancelable event before sending.
      // This listener also keeps the stepper usable when that handler is unavailable.
      if (!event.defaultPrevented) validateSubmission(event);
    });

    // Native whole-form validation cannot focus required controls in hidden steps.
    // Only the enhanced stepper opts out; its gate still checks every step before POST.
    form.noValidate = true;
    form.setAttribute("data-multistep-ready", "");
    show(0, false);
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-multistep-form]"), setup);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { setup: setup };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})();
