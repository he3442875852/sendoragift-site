"use strict";
const { isAuthorized } = require("../lib/admin-auth");
const c = require("../lib/chat-store");
const ai = require("../lib/chat-ai");
module.exports = async function (req, res) {
  try {
    if (!isAuthorized(req)) throw c.fail(401, "请先登录后台。");
    if (!["GET", "POST"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return c.respond(res, 405, { ok: false });
    }
    if (req.method === "GET")
      return c.respond(res, 200, {
        ok: true,
        ai: ai.publicConfig(await ai.config()),
      });
    if (!c.sameOrigin(req)) throw c.fail(403, "Invalid request origin.");
    await c.rate(req, "ai-config", 12, 60);
    const body = await c.readJson(req),
      current = await ai.config();
    if (body.action === "test") {
      if (!current.configured) throw c.fail(400, "请先保存 API 密钥。");
      await c.rate(req, "ai-test", 2, 60);
      const day = new Date(Date.now() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      if (
        !(await c.db("rpc/sendora_chat_rate_limit", "POST", {
          p_key: "ai:daily:" + day,
          p_limit: current.daily_limit,
          p_seconds: 86400,
        }))
      )
        throw c.fail(429, "今天的 AI 调用上限已用完。");
      try {
        const answer = await ai.generate(current, [
          {
            role: "visitor",
            content: "Can you customize a logo on a metal pen?",
          },
        ]);
        return c.respond(res, 200, { ok: true, reply: answer.reply });
      } catch (_) {
        throw c.fail(
          503,
          "连接测试失败：请检查 API 密钥、账户余额和模型权限。",
        );
      }
    }
    if (body.action !== "save") throw c.fail(400, "Unknown action.");
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const model =
      typeof body.model === "string" ? body.model.trim() : current.model;
    if (key && (!/^sk-[A-Za-z0-9_-]{15,}$/.test(key) || key.length > 600))
      throw c.fail(400, "请填写有效的 OpenAI API 密钥。");
    if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model))
      throw c.fail(400, "请填写有效的模型名称。");
    if (
      typeof body.enabled !== "boolean" ||
      !Number.isInteger(body.daily_limit) ||
      body.daily_limit < 1 ||
      body.daily_limit > 200
    )
      throw c.fail(400, "每日回复上限须为 1–200。");
    if (body.enabled && !key && !current.configured)
      throw c.fail(400, "请先配置 API 密钥再开启 AI 接待。");
    const patch = {
      ai_enabled: body.enabled,
      ai_model: model,
      ai_daily_limit: body.daily_limit,
    };
    if (key) patch.ai_key_ciphertext = ai.encrypt(key);
    await c.db("chat_settings?id=eq.true&select=ai_enabled", "PATCH", patch);
    return c.respond(res, 200, {
      ok: true,
      ai: {
        enabled: body.enabled,
        configured: Boolean(key || current.configured),
        model,
        daily_limit: body.daily_limit,
      },
    });
  } catch (error) {
    c.errorResponse(res, error);
  }
};
