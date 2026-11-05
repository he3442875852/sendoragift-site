"use strict";
const c = require("../lib/chat-store");
module.exports = async function (req, res) {
  try {
    if (!["GET", "POST"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return c.respond(res, 405, { ok: false });
    }
    const url = new URL(req.url, "https://www.sendoragift.com");
    if (req.method === "GET" && url.searchParams.get("action") === "status") {
      if (!c.configured())
        return c.respond(res, 200, { ok: true, ready: false, online: false });
      try {
        const settings = await c.settings();
        let aiReady = false;
        if (settings.ai_enabled) {
          const configuration = await require("../lib/chat-ai").config();
          aiReady = configuration.enabled && configuration.configured;
        }
        return c.respond(res, 200, {
          ok: true,
          ready: settings.enabled,
          ai_available: aiReady,
          online:
            settings.enabled &&
            Date.parse(settings.available_until) > Date.now(),
        });
      } catch (_) {
        return c.respond(res, 200, { ok: true, ready: false, online: false });
      }
    }
    if (req.method === "POST" && !c.sameOrigin(req))
      throw c.fail(403, "Invalid request origin.");
    if (!(await c.settings()).enabled)
      throw c.fail(
        503,
        "Website chat is offline. Please use WhatsApp or our contact form.",
      );
    const body = req.method === "POST" ? await c.readJson(req) : {};
    if (req.method === "POST" && body.action === "start") {
      const result = await c.start(req, body);
      return c.respond(res, 200, { ok: true, id: result.id });
    }
    const session = await c.visitor(req);
    if (req.method === "GET")
      return c.respond(res, 200, {
        ok: true,
        messages: await c.messages(session.id, url.searchParams.get("after")),
        status: session.status,
        intake: c.publicIntake(session.intake_state),
      });
    if (body.action === "profile") {
      await c.rate(req, "profile", 10, 60);
      await c.updateProfile(session.id, body);
      return c.respond(res, 200, { ok: true });
    }
    if (body.action !== "send") throw c.fail(400, "Unknown action.");
    await c.rate(req, "send", 60, 60);
    return c.respond(res, 200, {
      ok: true,
      ...(await c.receiveMessage(session.id, body)),
    });
  } catch (error) {
    c.errorResponse(res, error);
  }
};
