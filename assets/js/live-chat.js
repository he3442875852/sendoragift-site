(function () {
  "use strict";
  if (document.getElementById("sg-chat")) return;
  var session = null,
    open = false,
    busy = false,
    cursor = 0,
    polling = false,
    unread = 0,
    challenge = "",
    challengeId,
    challengeLoading = false,
    pending = null;
  try {
    session = JSON.parse(
      localStorage.getItem("sendora_chat_session") || "null",
    );
  } catch (_) {}
  if (
    session &&
    (!/^[a-f0-9-]{36}$/.test(session.id) ||
      !/^[a-f0-9]{64}$/.test(session.secret))
  )
    session = null;
  if (session && session.pending) pending = session.pending;
  function persist() {
    try {
      localStorage.setItem("sendora_chat_session", JSON.stringify(session));
    } catch (_) {}
  }
  function secret() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (x) {
      return x.toString(16).padStart(2, "0");
    }).join("");
  }
  async function request(path, body) {
    var response = await fetch("/api/chat" + path, {
      method: body ? "POST" : "GET",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        session
          ? {
              Authorization: "Bearer " + session.secret,
              "X-Chat-Session": session.id,
            }
          : {},
      ),
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.message || "Please try again.");
    return data;
  }
  function $(id) {
    return document.getElementById(id);
  }
  function error(value) {
    $("sg-chat-error").textContent = value || "";
  }
  function onlineStatus(data) {
    $("sg-chat-status").textContent = data.online
      ? "Our team is online"
      : "Leave a message · we will reply here";
  }
  async function setupChallenge() {
    if (challengeLoading || challengeId !== undefined) return;
    challengeLoading = true;
    try {
      var response = await fetch("/api/turnstile-site-key");
      var config = await response.json();
      if (!response.ok || !config.siteKey)
        throw new Error(
          "Security check unavailable. Please use our contact form.",
        );
      if (!window.turnstile) {
        await new Promise(function (resolve, reject) {
          var script = document.createElement("script");
          script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      // Another form may be loading the same Cloudflare client.
      if (!window.turnstile)
        throw new Error("Security check is loading. Please reopen chat.");
      challengeId = window.turnstile.render($("sg-chat-challenge"), {
        sitekey: config.siteKey,
        action: "sendora_chat",
        theme: "light",
        callback: function (value) {
          challenge = value;
        },
        "expired-callback": function () {
          challenge = "";
        },
        "error-callback": function () {
          challenge = "";
          error(
            "Security check failed. Please try again or use our contact form.",
          );
        },
      });
    } catch (e) {
      error(e.message || "Could not load the security check.");
    } finally {
      challengeLoading = false;
    }
  }
  function resetChallenge() {
    challenge = "";
    if (challengeId !== undefined && window.turnstile)
      window.turnstile.reset(challengeId);
  }
  function add(message) {
    if ($("sg-chat-msg-" + message.seq)) return;
    var bubble = document.createElement("div");
    bubble.id = "sg-chat-msg-" + message.seq;
    bubble.className = "sg-chat-message " + message.role;
    bubble.textContent = message.content;
    var time = document.createElement("small");
    time.textContent =
      (message.role === "agent" ? "Sendora Gift · " : "You · ") +
      new Date(message.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    bubble.append(time);
    var next = Array.from($("sg-chat-messages").children).find(function (node) {
      return Number(node.dataset.seq) > Number(message.seq);
    });
    bubble.dataset.seq = message.seq;
    $("sg-chat-messages").insertBefore(bubble, next || null);
    if (
      !open &&
      message.role === "agent" &&
      Number(message.seq) > Number(session.readSeq || 0)
    )
      unread++;
  }
  async function poll() {
    if (!session || !session.active || polling || document.hidden) return;
    polling = true;
    try {
      var data,
        wasNearBottom =
          $("sg-chat-scroll").scrollHeight -
            $("sg-chat-scroll").scrollTop -
            $("sg-chat-scroll").clientHeight <
          100;
      do {
        data = await request("?after=" + cursor);
        data.messages.forEach(function (message) {
          add(message);
          cursor = Math.max(cursor, Number(message.seq));
        });
      } while (data.messages.length === 100);
      if (wasNearBottom)
        $("sg-chat-scroll").scrollTop = $("sg-chat-scroll").scrollHeight;
      $("sg-chat-count").hidden = !unread;
      $("sg-chat-count").textContent = unread;
      if (open) {
        session.readSeq = cursor;
        persist();
      }
    } catch (e) {
      error(e.message);
    } finally {
      polling = false;
    }
  }
  function showConversation() {
    $("sg-chat-start").hidden = true;
    $("sg-chat-conversation").hidden = false;
    $("sg-chat-composer").hidden = false;
    if (pending) $("sg-chat-input").value = pending.content;
  }
  function toggle(value) {
    open = value;
    $("sg-chat-panel").hidden = !open;
    $("sg-chat-launch").setAttribute("aria-expanded", String(open));
    if (open) {
      unread = 0;
      $("sg-chat-count").hidden = true;
      if (session) {
        session.readSeq = cursor;
        persist();
      }
      if (session && session.active) {
        showConversation();
        poll();
        $("sg-chat-input").focus();
      } else {
        setupChallenge();
        $("sg-chat-email").focus();
      }
    } else $("sg-chat-launch").focus();
  }
  async function sendPending() {
    session.pending = pending;
    persist();
    var result = await request("", {
      action: "send",
      content: pending.content,
      client_id: pending.id,
    });
    add(result.message);
    pending = null;
    delete session.pending;
    persist();
    $("sg-chat-input").value = "";
    poll();
    $("sg-chat-scroll").scrollTop = $("sg-chat-scroll").scrollHeight;
  }
  function mount(status) {
    var style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/assets/live-chat.css?v=20261105-2";
    document.head.append(style);
    var root = document.createElement("aside");
    root.id = "sg-chat";
    root.setAttribute("aria-label", "Sendora Gift chat");
    root.innerHTML =
      '<button id="sg-chat-launch" aria-expanded="false" aria-controls="sg-chat-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg>Talk to our team<span id="sg-chat-count" hidden></span></button><section id="sg-chat-panel" aria-labelledby="sg-chat-title" hidden><header class="sg-chat-head"><div><strong id="sg-chat-title">Let’s plan your gifts.</strong><p id="sg-chat-status"></p></div><button id="sg-chat-close" aria-label="Close chat">×</button></header><div class="sg-chat-scroll" id="sg-chat-scroll"><form id="sg-chat-start"><p class="sg-chat-welcome">Tell us what you have in mind.</p><p class="sg-chat-muted">Share your product ideas and requirements. Leave your email so we can follow up if you leave the page.</p><label for="sg-chat-email">Work email *</label><input id="sg-chat-email" name="email" type="email" maxlength="254" autocomplete="email" required><div class="sg-chat-fields"><div><label for="sg-chat-name">Your name</label><input id="sg-chat-name" name="name" autocomplete="name" maxlength="120"></div><div><label for="sg-chat-company">Company</label><input id="sg-chat-company" name="company" autocomplete="organization" maxlength="160"></div><div><label for="sg-chat-product">Product / gift set</label><input id="sg-chat-product" name="product" maxlength="160"></div><div><label for="sg-chat-quantity">Quantity</label><input id="sg-chat-quantity" name="quantity" maxlength="160"></div></div><label for="sg-chat-first">Your message *</label><textarea id="sg-chat-first" name="message" maxlength="2000" placeholder="Products, logo, packaging, destination or event date…" required></textarea><div id="sg-chat-challenge" class="sg-chat-challenge"></div><button class="sg-chat-primary" id="sg-chat-start-send">Send message</button><p class="sg-chat-privacy">Your details, message and browsing source help us respond to your request. <a href="/privacy-policy.html">Privacy policy</a></p></form><div id="sg-chat-conversation" hidden><p class="sg-chat-muted">Messages are saved to this chat. To share artwork, use <a href="/contact/">our inquiry form</a> or WhatsApp.</p><div id="sg-chat-messages" role="log" aria-live="polite" aria-label="Chat messages"></div></div></div><p id="sg-chat-error" role="status"></p><form id="sg-chat-composer" hidden><div class="sg-chat-prompts"><button type="button">Logo customization</button><button type="button">Packaging options</button><button type="button">Request a quote</button></div><label for="sg-chat-input">Message</label><textarea id="sg-chat-input" maxlength="2000" required placeholder="Type your message…"></textarea><button class="sg-chat-primary" id="sg-chat-send">Send</button></form><footer class="sg-chat-links"><a id="sg-chat-wa" href="https://wa.me/8613400883682" target="_blank" rel="noopener">Continue on WhatsApp ↗</a><a href="/contact/">Send an inquiry ↗</a></footer></section>';
    document.body.append(root);
    onlineStatus(status);
    if (window.SendoraLeadSourceTracker) {
      $("sg-chat-wa").href = window.SendoraLeadSourceTracker.whatsapp.getUrl();
      var initial = window.SendoraLeadSourceTracker.getData();
      $("sg-chat-product").value =
        initial.product_direction ||
        document.body.getAttribute("data-inquiry-product") ||
        "";
    }
    $("sg-chat-launch").addEventListener("click", function () {
      toggle(!open);
    });
    $("sg-chat-close").addEventListener("click", function () {
      toggle(false);
    });
    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && open) toggle(false);
    });
    $("sg-chat-start").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy) return;
      if (!challenge) {
        error("Please complete the security check first.");
        setupChallenge();
        return;
      }
      busy = true;
      $("sg-chat-start-send").disabled = true;
      error("");
      try {
        if (!session) {
          session = {
            id: crypto.randomUUID(),
            secret: secret(),
            active: false,
          };
          persist();
        }
        var fields = {
          action: "start",
          challenge: challenge,
          context: Object.assign(
            {},
            window.SendoraLeadSourceTracker
              ? window.SendoraLeadSourceTracker.getData()
              : { current_page: location.href },
            { language: navigator.language },
          ),
        };
        ["email", "name", "company", "product", "quantity"].forEach(
          function (key) {
            fields[key] = $("sg-chat-" + key).value.trim();
          },
        );
        await request("", fields);
        session.active = true;
        pending = {
          id: crypto.randomUUID(),
          content: $("sg-chat-first").value.trim(),
        };
        session.pending = pending;
        persist();
        showConversation();
        $("sg-chat-input").value = pending.content;
        await sendPending();
        poll();
      } catch (e) {
        error(e.message);
        resetChallenge();
      } finally {
        busy = false;
        $("sg-chat-start-send").disabled = false;
      }
    });
    $("sg-chat-composer").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy) return;
      var value = $("sg-chat-input").value.trim();
      if (!value) return;
      if (!pending || pending.content !== value)
        pending = { id: crypto.randomUUID(), content: value };
      busy = true;
      $("sg-chat-send").disabled = true;
      error("");
      try {
        await sendPending();
      } catch (e) {
        error(
          e.message +
            " Your message has not been confirmed; press Send to retry.",
        );
      } finally {
        busy = false;
        $("sg-chat-send").disabled = false;
      }
    });
    root.querySelectorAll(".sg-chat-prompts button").forEach(function (button) {
      button.addEventListener("click", function () {
        $("sg-chat-input").value =
          "I would like to discuss " + button.textContent.toLowerCase() + ".";
        $("sg-chat-input").focus();
      });
    });
    setInterval(function () {
      if (open) poll();
    }, 6000);
    setInterval(async function () {
      if (document.hidden) return;
      try {
        var data = await request("?action=status");
        onlineStatus(data);
        if (!data.ready)
          error(
            "Website chat is currently unavailable. Please use WhatsApp or our inquiry form.",
          );
        if (!open) poll();
      } catch (_) {}
    }, 30000);
    if (session && session.active) {
      showConversation();
      poll();
    }
  }
  request("?action=status")
    .then(function (data) {
      if (data.ready && window.crypto && crypto.randomUUID) mount(data);
    })
    .catch(function () {});
})();
