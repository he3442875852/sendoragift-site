(function () {
  "use strict";
  var $ = function (id) {
      return document.getElementById(id);
    },
    token = "",
    signedIn = false,
    online = false,
    filter = "all",
    items = [],
    selected = null,
    seq = 0,
    loading = false,
    reading = false,
    replyBusy = false,
    settings = {},
    drafts = {},
    retries = {};
  try {
    token = sessionStorage.getItem("sendora_admin_token") || "";
  } catch (_) {}
  var snippets = {
    welcome:
      "Hi, thank you for contacting Sendora Gift. What products or gift sets are you looking for?",
    requirements:
      "Could you share the products, quantity, logo requirements, delivery country and required date? We can then recommend suitable options.",
    logo: "Could you send your logo or artwork? You can share it through our inquiry form or WhatsApp, and we can prepare a mockup for review.",
    shipping:
      "Please share your delivery address and postal code so we can check shipping options and costs.",
    followup:
      "Hi, just following up on your gift project. Have there been any updates to the quantity, product selection or event date?",
  };
  function el(tag, cls, value) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function formatDate(value, short) {
    return new Date(value).toLocaleString(
      "zh-CN",
      short
        ? { month: "2-digit", day: "2-digit" }
        : {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          },
    );
  }
  function authLost() {
    signedIn = false;
    online = false;
    $("app").hidden = true;
    $("login").hidden = false;
  }
  async function api(path, body, method) {
    var res = await fetch(path, {
      method: method || (body ? "POST" : "GET"),
      headers: Object.assign(
        { "Content-Type": "application/json" },
        token ? { Authorization: "Bearer " + token } : {},
      ),
      credentials: "same-origin",
      cache: "no-store",
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    var data = await res.json();
    if (res.status === 401) {
      token = "";
      try {
        sessionStorage.removeItem("sendora_admin_token");
      } catch (_) {}
      authLost();
    }
    if (!res.ok) throw new Error(data.message || "请求失败，请重试。");
    return data;
  }
  function unread(item) {
    return Number(item.last_visitor_seq) > Number(item.admin_read_seq);
  }
  function renderList() {
    var query = $("search").value.trim().toLowerCase(),
      visible = items.filter(function (item) {
        return (
          (filter === "all" ||
            (filter === "unread" && unread(item)) ||
            item.status === filter) &&
          (!query ||
            [
              item.name,
              item.company,
              item.email,
              item.product,
              item.last_message,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query))
        );
      });
    var list = $("conversationList");
    list.replaceChildren();
    visible.forEach(function (item) {
      var card = el(
          "button",
          "conversation-card" + (unread(item) ? " has-unread" : ""),
        ),
        top = el("div", "card-top"),
        info = el("div");
      card.type = "button";
      card.setAttribute("aria-current", String(selected === item.id));
      info.append(
        el("div", "card-name", item.name || item.email),
        el("div", "card-product", item.company || item.product || "网站访客"),
      );
      top.append(
        el(
          "span",
          "avatar",
          (item.name || item.email || "?").slice(0, 1).toUpperCase(),
        ),
        info,
        el("span", "card-date", formatDate(item.updated_at, true)),
      );
      card.append(
        top,
        el("p", "card-preview", item.last_message || "会话已建立，等待消息"),
      );
      if (unread(item)) card.append(el("span", "unread-dot"));
      card.addEventListener("click", function () {
        select(item.id);
      });
      list.append(card);
    });
    $("inboxEmpty").hidden = visible.length > 0;
    $("total").textContent = items.length;
    $("unreadCount").textContent = items.filter(unread).length;
    $("activeCount").textContent = items.filter(function (x) {
      return x.status === "active";
    }).length;
    $("waitingCount").textContent = items.filter(function (x) {
      return x.status === "waiting";
    }).length;
    document.title =
      (items.some(unread) ? "● " : "") + "在线沟通工作台 | Sendora Gift";
  }
  function showSettings() {
    var ready = settings.enabled;
    $("serviceState").textContent = ready
      ? "网站聊天已启用 · 客户在网页中发消息，你在这里回复"
      : "网站聊天尚未启用 · 开启后访客可看到聊天入口";
    $("enable").hidden = false;
    $("enable").textContent = ready ? "停用网站聊天" : "启用网站聊天";
    $("presence").disabled = !ready;
    $("presence").setAttribute("aria-pressed", String(online));
    $("presence").querySelector("span").textContent = online
      ? "本窗口接待中"
      : "开始接待";
  }
  async function load(more) {
    if (loading || !signedIn) return;
    loading = true;
    try {
      var data = await api(
        "/api/admin-chat" + (more ? "?offset=" + items.length : ""),
      );
      if (more) {
        var ids = new Set(
          items.map(function (x) {
            return x.id;
          }),
        );
        items = items.concat(
          data.conversations.filter(function (x) {
            return !ids.has(x.id);
          }),
        );
      } else {
        var updated = new Map(
          data.conversations.map(function (x) {
            return [x.id, x];
          }),
        );
        items = data.conversations.concat(
          items.filter(function (x) {
            return !updated.has(x.id);
          }),
        );
      }
      settings = data.settings;
      $("more").hidden = data.conversations.length < 100;
      showSettings();
      renderList();
      $("globalError").textContent = "";
    } catch (e) {
      $("globalError").textContent =
        e.message +
        " 如尚未初始化聊天数据表，请先运行 supabase/live_chat.sql。";
      $("serviceState").textContent = "尚未连接聊天数据库";
    } finally {
      loading = false;
    }
  }
  function detail(dl, label, value, link) {
    var dd = el("dd", "", value || "未提供");
    if (link && value) {
      try {
        var u = new URL(value);
        if (
          u.protocol === "https:" &&
          ["sendoragift.com", "www.sendoragift.com"].includes(u.hostname)
        ) {
          var a = el("a", "", u.pathname);
          a.href = u.href;
          a.target = "_blank";
          a.rel = "noopener";
          dd.replaceChildren(a);
        }
      } catch (_) {}
    }
    dl.append(el("dt", "", label), dd);
  }
  function fillDetails(item) {
    $("detailEmpty").hidden = true;
    $("detailContent").hidden = false;
    ["contactDetails", "buyingDetails", "sourceDetails"].forEach(function (id) {
      $(id).replaceChildren();
    });
    var contact = $("contactDetails"),
      buy = $("buyingDetails"),
      source = $("sourceDetails"),
      ctx = item.context || {};
    detail(
      contact,
      "姓名 / 公司",
      [item.name, item.company].filter(Boolean).join(" / "),
    );
    detail(contact, "联系邮箱", item.email);
    detail(
      contact,
      "地区 / 语言",
      [ctx.country, ctx.language].filter(Boolean).join(" / "),
    );
    detail(buy, "产品", item.product);
    detail(buy, "数量", item.quantity);
    detail(
      buy,
      "目的地 / 日期",
      [item.destination, item.deadline].filter(Boolean).join(" / "),
    );
    detail(source, "来源", ctx.source_type);
    detail(source, "当前页面", ctx.current_page, true);
    detail(source, "首次入口", ctx.first_landing_page, true);
    detail(
      source,
      "UTM",
      [ctx.utm_source, ctx.utm_campaign, ctx.utm_term]
        .filter(Boolean)
        .join(" / "),
    );
    detail(source, "浏览记录", ctx.page_history);
    $("notes").value = item.notes || "";
    $("notesResult").textContent = "";
  }
  async function select(id) {
    if (selected === id) return;
    if (selected) drafts[selected] = $("reply").value;
    selected = id;
    seq = 0;
    var item = items.find(function (x) {
      return x.id === id;
    });
    $("noSelection").hidden = true;
    $("threadContent").hidden = false;
    $("messages").replaceChildren();
    $("customerName").textContent = item.name || item.email;
    $("customerSubtitle").textContent = [item.company, item.product]
      .filter(Boolean)
      .join(" · ");
    $("conversationStatus").value = item.status;
    $("reply").value = drafts[id] || "";
    $("replyError").textContent = "";
    fillDetails(item);
    renderList();
    await readMessages();
  }
  function addMessage(message) {
    if ($("admin-message-" + message.seq)) return;
    var row = el("article", "message " + message.role);
    row.id = "admin-message-" + message.seq;
    row.append(
      el(
        "p",
        "message-meta",
        (message.role === "agent" ? "Sendora Gift" : "客户") +
          " · " +
          formatDate(message.created_at),
      ),
      el("div", "message-body", message.content),
    );
    var next = Array.from($("messages").children).find(function (node) {
      return Number(node.dataset.seq) > Number(message.seq);
    });
    row.dataset.seq = message.seq;
    $("messages").insertBefore(row, next || null);
  }
  async function readMessages() {
    if (reading || !selected || !signedIn || document.hidden) return;
    reading = true;
    var id = selected,
      nearBottom =
        $("messages").scrollHeight -
          $("messages").scrollTop -
          $("messages").clientHeight <
        100;
    try {
      var data;
      do {
        data = await api("/api/admin-chat?id=" + id + "&after=" + seq);
        if (selected !== id) return;
        data.messages.forEach(function (message) {
          addMessage(message);
          seq = Math.max(seq, Number(message.seq));
        });
      } while (data.messages.length === 100);
      if (nearBottom) $("messages").scrollTop = $("messages").scrollHeight;
      if (seq) {
        await api("/api/admin-chat", { action: "read", id: id, seq: seq });
        var item = items.find(function (x) {
          return x.id === id;
        });
        if (item) item.admin_read_seq = seq;
        renderList();
      }
    } catch (e) {
      if (selected === id) $("replyError").textContent = e.message;
    } finally {
      reading = false;
      if (selected !== id) readMessages();
    }
  }
  async function presence(value) {
    await api("/api/admin-chat", { action: "settings", online: value });
    online = value;
    showSettings();
  }
  $("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    $("loginButton").disabled = true;
    try {
      var result = await api("/api/admin-auth", {
        password: $("password").value,
      });
      token = result.token || "";
      if (token)
        try {
          sessionStorage.setItem("sendora_admin_token", token);
        } catch (_) {}
      $("password").value = "";
      signedIn = true;
      $("login").hidden = true;
      $("app").hidden = false;
      await load();
    } catch (e) {
      $("loginError").textContent = e.message;
    } finally {
      $("loginButton").disabled = false;
    }
  });
  $("logout").addEventListener("click", async function () {
    if (online) await presence(false).catch(function () {});
    await api("/api/admin-auth", null, "DELETE").catch(function () {});
    token = "";
    try {
      sessionStorage.removeItem("sendora_admin_token");
    } catch (_) {}
    authLost();
  });
  $("presence").addEventListener("click", async function () {
    try {
      await presence(!online);
    } catch (e) {
      $("globalError").textContent = e.message;
    }
  });
  $("enable").addEventListener("click", async function () {
    try {
      var result = await api("/api/admin-chat", {
        action: "settings",
        enabled: !settings.enabled,
        online: false,
      });
      settings = result.settings;
      online = false;
      showSettings();
    } catch (e) {
      $("globalError").textContent = e.message;
    }
  });
  $("refresh").addEventListener("click", function () {
    load();
    readMessages();
  });
  $("search").addEventListener("input", renderList);
  $("more").addEventListener("click", function () {
    load(true);
  });
  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(function (x) {
        x.setAttribute("aria-pressed", String(x === button));
      });
      renderList();
    });
  });
  $("snippet").addEventListener("change", function () {
    if (this.value) {
      $("reply").value = snippets[this.value];
      this.value = "";
      $("reply").focus();
    }
  });
  $("replyForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (replyBusy || !selected) return;
    var content = $("reply").value.trim(),
      id = selected;
    if (!content) return;
    var pending = retries[id];
    if (!pending || pending.content !== content)
      pending = retries[id] = {
        client_id: crypto.randomUUID(),
        content: content,
      };
    replyBusy = true;
    $("sendReply").disabled = true;
    $("replyError").textContent = "";
    try {
      var data = await api("/api/admin-chat", {
        action: "reply",
        id: id,
        content: content,
        client_id: pending.client_id,
      });
      delete retries[id];
      drafts[id] = "";
      if (selected === id) {
        addMessage(data.message);
        $("reply").value = "";
        $("messages").scrollTop = $("messages").scrollHeight;
        readMessages();
      }
      load();
    } catch (e) {
      $("replyError").textContent = e.message + " 消息尚未确认发送，请重试。";
    } finally {
      replyBusy = false;
      $("sendReply").disabled = false;
    }
  });
  $("reply").addEventListener("keydown", function (event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      $("replyForm").requestSubmit();
    }
  });
  $("conversationStatus").addEventListener("change", async function () {
    var id = selected,
      status = this.value;
    try {
      await api("/api/admin-chat", {
        action: "update",
        id: id,
        status: status,
      });
      var item = items.find(function (x) {
        return x.id === id;
      });
      item.status = status;
      renderList();
    } catch (e) {
      $("globalError").textContent = e.message;
    }
  });
  $("notesForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var id = selected,
      notes = $("notes").value;
    $("saveNotes").disabled = true;
    try {
      await api("/api/admin-chat", { action: "update", id: id, notes: notes });
      var item = items.find(function (x) {
        return x.id === id;
      });
      if (item) item.notes = notes;
      if (selected === id) $("notesResult").textContent = "已保存，仅后台可见";
    } catch (e) {
      $("notesResult").textContent = e.message;
    } finally {
      $("saveNotes").disabled = false;
    }
  });
  setInterval(function () {
    if (!document.hidden) {
      load();
      readMessages();
    }
  }, 10000);
  setInterval(function () {
    if (signedIn && online && !document.hidden)
      presence(true).catch(function (e) {
        $("globalError").textContent = "在线状态更新失败：" + e.message;
      });
  }, 25000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && signedIn) {
      load();
      readMessages();
      if (online) presence(true).catch(function () {});
    }
  });
  api("/api/admin-auth")
    .then(function () {
      signedIn = true;
      $("login").hidden = true;
      $("app").hidden = false;
      load();
    })
    .catch(authLost);
})();
