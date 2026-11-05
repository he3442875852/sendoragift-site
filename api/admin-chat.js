"use strict";
const { isAuthorized } = require("../lib/admin-auth");
const c = require("../lib/chat-store");
module.exports = async function (req, res) {
  try {
    if (!isAuthorized(req)) throw c.fail(401, "请先登录后台。");
    if (!["GET", "POST", "PATCH"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST, PATCH");
      return c.respond(res, 405, { ok: false });
    }
    if (req.method !== "GET" && !c.sameOrigin(req))
      throw c.fail(403, "Invalid request origin.");
    const url = new URL(req.url, "https://www.sendoragift.com");
    if (req.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        if (!c.uuid(id)) throw c.fail(400, "Invalid conversation.");
        return c.respond(res, 200, {
          ok: true,
          messages: await c.messages(id, url.searchParams.get("after")),
        });
      }
      const params = new URLSearchParams({
        select:
          "id,name,company,email,product,quantity,destination,deadline,intake_state,context,status,notes,last_seq,last_visitor_seq,admin_read_seq,last_message,last_role,created_at,updated_at",
        order: "updated_at.desc,id.desc",
        limit: "100",
      });
      const offset = url.searchParams.get("offset") || "0";
      if (!/^\d{1,6}$/.test(offset)) throw c.fail(400, "Invalid offset.");
      params.set("offset", offset);
      return c.respond(res, 200, {
        ok: true,
        conversations: await c.db("chat_conversations?" + params),
        settings: await c.settings(),
      });
    }
    const body = await c.readJson(req);
    if (body.action === "settings") {
      const patch = {};
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (typeof body.online === "boolean")
        patch.available_until = body.online
          ? new Date(Date.now() + 75000).toISOString()
          : null;
      if (!Object.keys(patch).length) throw c.fail(400, "Invalid settings.");
      return c.respond(res, 200, {
        ok: true,
        settings: (await c.db("chat_settings?id=eq.true", "PATCH", patch))[0],
      });
    }
    if (!c.uuid(body.id)) throw c.fail(400, "Invalid conversation.");
    if (body.action === "reply")
      return c.respond(res, 200, {
        ok: true,
        message: await c.sendMessage(body.id, "agent", body),
      });
    const patch = {};
    if (body.action === "update") {
      if (["active", "waiting", "closed"].includes(body.status))
        patch.status = body.status;
      if (typeof body.notes === "string")
        patch.notes = body.notes.trim().slice(0, 3000);
    } else if (body.action === "read") {
      if (!Number.isSafeInteger(body.seq) || body.seq < 0)
        throw c.fail(400, "Invalid read cursor.");
      // A stale browser tab cannot move the shared read marker backwards.
      const rows = await c.db(
        "chat_conversations?id=eq." +
          body.id +
          "&admin_read_seq=lt." +
          body.seq +
          "&last_seq=gte." +
          body.seq,
        "PATCH",
        { admin_read_seq: body.seq },
      );
      return c.respond(res, 200, { ok: true, updated: rows.length > 0 });
    }
    if (!Object.keys(patch).length) throw c.fail(400, "Unknown action.");
    const rows = await c.db(
      "chat_conversations?id=eq." + body.id,
      "PATCH",
      patch,
    );
    return c.respond(res, 200, { ok: true, updated: rows.length > 0 });
  } catch (error) {
    c.errorResponse(res, error);
  }
};
