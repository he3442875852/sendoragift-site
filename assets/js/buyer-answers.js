(function () {
  "use strict";

  function revealLinkedAnswer() {
    var id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch (_) {
      return;
    }
    if (!id) return;
    var answer = document.getElementById(id);
    if (!answer || !answer.matches("details.buyer-answer")) return;
    answer.open = true;
    answer.scrollIntoView({ block: "start" });
  }

  window.addEventListener("hashchange", revealLinkedAnswer);
  revealLinkedAnswer();
})();
