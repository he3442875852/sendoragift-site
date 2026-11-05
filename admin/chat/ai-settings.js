(function () {
  "use strict";
  var $ = function (id) {
      return document.getElementById(id);
    },
    loaded = false;
  async function request(body) {
    var token = "";
    try {
      token = sessionStorage.getItem("sendora_admin_token") || "";
    } catch (_) {}
    var response = await fetch("/api/admin-chat-ai", {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        token ? { Authorization: "Bearer " + token } : {},
      ),
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    var data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "AI 设置暂时无法保存，请重试。");
    return body && body.action === "test" ? data : data.ai;
  }
  function state(value) {
    $("aiConfigState").textContent = value.configured
      ? value.enabled
        ? "AI 已开启 · 人工离线时自动回复"
        : "密钥已配置 · AI 未开启"
      : "尚未配置 AI 密钥 · 当前继续使用预设问题接待";
    $("aiEnabled").checked = value.enabled;
    $("aiModel").value = value.model;
    $("aiDailyLimit").value = value.daily_limit;
  }
  $("aiSettingsToggle").addEventListener("click", async function () {
    var show = $("aiSettingsPanel").hidden;
    $("aiSettingsPanel").hidden = !show;
    this.setAttribute("aria-expanded", String(show));
    if (show && !loaded)
      try {
        state(await request());
        loaded = true;
      } catch (e) {
        $("aiConfigState").textContent = e.message;
      }
  });
  $("aiSettingsForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    $("aiSettingsSave").disabled = true;
    $("aiSettingsResult").textContent = "正在保存…";
    try {
      var key = $("aiApiKey").value.trim();
      state(
        await request({
          action: "save",
          enabled: $("aiEnabled").checked,
          key,
          model: $("aiModel").value.trim(),
          daily_limit: Number($("aiDailyLimit").value),
        }),
      );
      $("aiApiKey").value = "";
      loaded = true;
      $("aiSettingsResult").textContent =
        "已保存。开启后，可在网站聊天中发送一条新消息测试。";
    } catch (e) {
      $("aiSettingsResult").textContent = e.message;
    } finally {
      $("aiSettingsSave").disabled = false;
    }
  });
  $("aiSettingsTest").addEventListener("click", async function () {
    this.disabled = true;
    $("aiSettingsResult").textContent = "正在测试 AI 连接…";
    try {
      var result = await request({ action: "test" });
      $("aiSettingsResult").textContent = "连接成功。测试回复：" + result.reply;
    } catch (e) {
      $("aiSettingsResult").textContent = e.message;
    } finally {
      this.disabled = false;
    }
  });
})();
