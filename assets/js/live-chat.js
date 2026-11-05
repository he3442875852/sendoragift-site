(function () {
  "use strict";
  if (document.getElementById("sg-chat")) return;
  var session = null,
    open = false,
    busy = false,
    cursor = 0,
    polling = false,
    unread = 0;
  var pending = null,
    challenge = "",
    challengeId,
    challengeLoading = null,
    challengeWaiter = null;
  var pollAgain = false;
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
  function $(id) {
    return document.getElementById(id);
  }
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
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    var data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Could not connect. Please try again.");
    return data;
  }
  function error(message) {
    $("sg-chat-error").textContent = message || "";
  }
  function onlineStatus(data) {
    $("sg-chat-status").textContent = data.online
      ? "Our team is online"
      : "Away · send us a message";
    $("sg-chat-status-dot").classList.toggle("online", Boolean(data.online));
    $("sg-chat-intro-text").textContent = data.online
      ? "What can we help you with today?"
      : "Send a message below. Our team will reply in this chat.";
  }
  function challengeFailed(message) {
    challenge = "";
    if (challengeWaiter) {
      challengeWaiter.reject(new Error(message));
      challengeWaiter = null;
    } else if (open) error(message);
  }
  function setupChallenge() {
    if (challengeId !== undefined) return Promise.resolve();
    if (challengeLoading) return challengeLoading;
    challengeLoading = (async function () {
      var response = await fetch("/api/turnstile-site-key");
      var config = await response.json();
      if (!response.ok || !config.siteKey)
        throw new Error("Could not connect securely. Please try again.");
      if (!window.turnstile)
        await new Promise(function (resolve, reject) {
          var script = document.createElement("script");
          script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.onload = resolve;
          script.onerror = function () {
            reject(new Error("Could not load the security check."));
          };
          document.head.appendChild(script);
        });
      if (!window.turnstile)
        throw new Error("The security check is loading. Please try again.");
      challengeId = window.turnstile.render($("sg-chat-challenge"), {
        sitekey: config.siteKey,
        action: "sendora_chat",
        theme: "light",
        appearance: "interaction-only",
        callback: function (value) {
          challenge = value;
          if (challengeWaiter) {
            challengeWaiter.resolve(value);
            challengeWaiter = null;
          }
        },
        "expired-callback": function () {
          challenge = "";
        },
        "error-callback": function () {
          challengeFailed("Connection check failed. Please try again.");
        },
      });
    })().finally(function () {
      challengeLoading = null;
    });
    return challengeLoading;
  }
  async function acquireChallenge() {
    await setupChallenge();
    if (challenge) return challenge;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (challengeWaiter) {
          challengeWaiter = null;
          reject(
            new Error(
              "Please finish the connection check, then press Send again.",
            ),
          );
        }
      }, 60000);
      challengeWaiter = {
        resolve: function (value) {
          clearTimeout(timer);
          resolve(value);
        },
        reject: function (err) {
          clearTimeout(timer);
          reject(err);
        },
      };
    });
  }
  function resetChallenge() {
    challenge = "";
    if (challengeId !== undefined && window.turnstile)
      window.turnstile.reset(challengeId);
  }
  function removePendingBubble() {
    var node = $("sg-chat-pending");
    if (node) node.remove();
  }
  function pendingBubble(failed) {
    if (!pending) return;
    removePendingBubble();
    var bubble = document.createElement("div");
    bubble.id = "sg-chat-pending";
    bubble.className = "sg-chat-message visitor pending";
    bubble.textContent = pending.content;
    var note = document.createElement("small");
    note.textContent = failed ? "Not sent · press Send to retry" : "Sending…";
    bubble.append(note);
    $("sg-chat-messages").append(bubble);
    $("sg-chat-scroll").scrollTop = $("sg-chat-scroll").scrollHeight;
  }
  function add(message) {
    if (pending && message.client_id === pending.id) removePendingBubble();
    if ($("sg-chat-msg-" + message.seq)) return;
    var bubble = document.createElement("div");
    bubble.id = "sg-chat-msg-" + message.seq;
    bubble.className = "sg-chat-message " + message.role;
    bubble.textContent = message.content;
    bubble.dataset.seq = message.seq;
    var time = document.createElement("small");
    time.textContent =
      (message.role === "agent" ? "Sendora Gift · " : "You · ") +
      new Date(message.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    bubble.append(time);
    var next =
      Array.from($("sg-chat-messages").children).find(function (node) {
        return (
          node.dataset.seq && Number(node.dataset.seq) > Number(message.seq)
        );
      }) || $("sg-chat-pending");
    $("sg-chat-messages").insertBefore(bubble, next || null);
    if (
      !open &&
      message.role === "agent" &&
      Number(message.seq) > Number(session.readSeq || 0)
    )
      unread++;
  }
  async function poll() {
    if (!session || !session.active || document.hidden) return;
    if (polling) {
      pollAgain = true;
      return;
    }
    polling = true;
    try {
      var data,
        nearBottom =
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
      if (nearBottom)
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
      if (pollAgain) {
        pollAgain = false;
        poll();
      }
    }
  }
  function refreshContact() {
    $("sg-chat-contact-toggle").hidden = !(session && session.active);
    if (session && session.contact) {
      $("sg-chat-contact-email").value = session.contact.email || "";
      $("sg-chat-contact-name").value = session.contact.name || "";
    }
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
      refreshContact();
      poll();
      if (!session || !session.active)
        setupChallenge().catch(function (e) {
          error(e.message);
        });
      $("sg-chat-input").focus();
    } else $("sg-chat-launch").focus();
  }
  async function send() {
    session.pending = pending;
    persist();
    pendingBubble(false);
    if (!session.active) {
      $("sg-chat-send").setAttribute("aria-label", "Connecting");
      var proof = await acquireChallenge();
      var tracker = window.SendoraLeadSourceTracker;
      var fields = {
        action: "start",
        challenge: proof,
        context: Object.assign(
          {},
          tracker ? tracker.getData() : { current_page: location.href },
          { language: navigator.language },
        ),
        product: document.body.getAttribute("data-inquiry-product") || "",
      };
      await request("", fields);
      session.active = true;
      persist();
      refreshContact();
      $("sg-chat-challenge").hidden = true;
    }
    var delivered = pending;
    var result = await request("", {
      action: "send",
      content: delivered.content,
      client_id: delivered.id,
    });
    add(result.message);
    removePendingBubble();
    pending = null;
    delete session.pending;
    persist();
    if ($("sg-chat-input").value.trim() === delivered.content)
      $("sg-chat-input").value = "";
    poll();
    $("sg-chat-scroll").scrollTop = $("sg-chat-scroll").scrollHeight;
  }
  function mount(status) {
    if (document.getElementById("sg-chat")) return;
    var style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/assets/live-chat.css?v=20261105-3";
    document.head.append(style);
    var root = document.createElement("aside");
    root.id = "sg-chat";
    root.setAttribute("aria-label", "Sendora Gift chat");
    root.innerHTML =
      '<button id="sg-chat-launch" aria-expanded="false" aria-controls="sg-chat-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg>Chat with us<span id="sg-chat-count" hidden></span></button><section id="sg-chat-panel" aria-labelledby="sg-chat-title" hidden><header class="sg-chat-head"><div class="sg-chat-avatar" aria-hidden="true">S</div><div class="sg-chat-heading"><strong id="sg-chat-title">Sendora Gift</strong><p class="sg-chat-status-line"><span id="sg-chat-status-dot" aria-hidden="true"></span><span id="sg-chat-status"></span></p></div><button id="sg-chat-close" aria-label="Close chat">×</button></header><div class="sg-chat-scroll" id="sg-chat-scroll"><div class="sg-chat-intro"><small>WELCOME TO SENDORA GIFT</small><p id="sg-chat-intro-text"></p></div><div id="sg-chat-messages" role="log" aria-live="polite" aria-label="Chat messages"></div></div><p id="sg-chat-error" role="status"></p><div id="sg-chat-challenge" class="sg-chat-challenge"></div><form id="sg-chat-composer"><div class="sg-chat-prompts"><button type="button" data-message="Hi, can I customize the logo?">Logo options</button><button type="button" data-message="Hi, I would like a quote.">Get a quote</button></div><div class="sg-chat-input-row"><label class="sg-chat-sr-only" for="sg-chat-input">Message</label><textarea id="sg-chat-input" maxlength="2000" rows="2" placeholder="Type a message…" required></textarea><button id="sg-chat-send" type="submit" aria-label="Send message" title="Send message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 12 16-8-5 16-3-6-8-2Z"/><path d="m12 14 8-10"/></svg></button></div><p class="sg-chat-note">Enter to send · Shift + Enter for a new line</p></form><div class="sg-chat-contact" id="sg-chat-contact" hidden><form id="sg-chat-contact-form"><p>Optional: add your email so our team can follow up after you leave.</p><label for="sg-chat-contact-email">Email (optional)</label><input id="sg-chat-contact-email" type="email" maxlength="254" autocomplete="email"><label for="sg-chat-contact-name">Name (optional)</label><input id="sg-chat-contact-name" maxlength="120" autocomplete="name"><button id="sg-chat-contact-save" class="sg-chat-save">Save contact details</button><span id="sg-chat-contact-result" role="status"></span></form></div><footer class="sg-chat-links"><button id="sg-chat-contact-toggle" type="button" aria-expanded="false" aria-controls="sg-chat-contact" hidden>Add contact (optional)</button><a id="sg-chat-wa" href="https://wa.me/8613400883682" target="_blank" rel="noopener">WhatsApp ↗</a><a href="/privacy-policy.html">Privacy</a></footer></section>';
    document.body.append(root);
    onlineStatus(status);
    refreshContact();
    if (window.SendoraLeadSourceTracker)
      $("sg-chat-wa").href = window.SendoraLeadSourceTracker.whatsapp.getUrl();
    if (pending) {
      $("sg-chat-input").value = pending.content;
      pendingBubble(true);
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
    $("sg-chat-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        $("sg-chat-composer").requestSubmit();
      }
    });
    $("sg-chat-composer").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy) return;
      var value = $("sg-chat-input").value.trim();
      if (!value) return;
      if (!session)
        session = { id: crypto.randomUUID(), secret: secret(), active: false };
      if (!pending || pending.content !== value)
        pending = { id: crypto.randomUUID(), content: value };
      busy = true;
      $("sg-chat-send").disabled = true;
      error("");
      try {
        await send();
      } catch (e) {
        pendingBubble(true);
        error(e.message + " Your message is saved here; press Send to retry.");
        if (!session.active) resetChallenge();
      } finally {
        busy = false;
        $("sg-chat-send").disabled = false;
        $("sg-chat-send").setAttribute("aria-label", "Send message");
      }
    });
    root.querySelectorAll(".sg-chat-prompts button").forEach(function (button) {
      button.addEventListener("click", function () {
        $("sg-chat-input").value = button.dataset.message;
        $("sg-chat-input").focus();
      });
    });
    $("sg-chat-contact-toggle").addEventListener("click", function () {
      var show = $("sg-chat-contact").hidden;
      $("sg-chat-contact").hidden = !show;
      this.setAttribute("aria-expanded", String(show));
      if (show) $("sg-chat-contact-email").focus();
    });
    $("sg-chat-contact-form").addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();
        if (!session || !session.active) return;
        var profile = {
          email: $("sg-chat-contact-email").value.trim(),
          name: $("sg-chat-contact-name").value.trim(),
        };
        $("sg-chat-contact-save").disabled = true;
        try {
          await request("", Object.assign({ action: "profile" }, profile));
          session.contact = profile;
          persist();
          $("sg-chat-contact-result").textContent = "Saved";
          error("");
        } catch (e) {
          $("sg-chat-contact-result").textContent = e.message;
        } finally {
          $("sg-chat-contact-save").disabled = false;
        }
      },
    );
    setInterval(function () {
      if (open) poll();
    }, 2000);
    setInterval(async function () {
      if (document.hidden) return;
      try {
        var data = await request("?action=status");
        onlineStatus(data);
        if (!data.ready)
          error("Chat is unavailable right now. Please use WhatsApp.");
        if (!open) poll();
      } catch (_) {}
    }, 15000);
    if (session && session.active) poll();
  }
  request("?action=status")
    .then(function (data) {
      if (data.ready && window.crypto && crypto.randomUUID) mount(data);
    })
    .catch(function () {});
})();
