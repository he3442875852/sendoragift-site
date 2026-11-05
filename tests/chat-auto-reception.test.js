"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
let PGlite;
try {
  ({ PGlite } = require("@electric-sql/pglite"));
} catch (_) {}
async function fixture(run) {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    for (const file of [
      "live_chat.sql",
      "chat_auto_reception.sql",
      "chat_auto_reception.sql",
    ])
      await db.exec(
        fs.readFileSync(path.join(__dirname, "../supabase", file), "utf8"),
      );
    await db.exec("update public.chat_settings set enabled=true;");
    const create = async () => {
      const id = randomUUID();
      await db.query(
        "insert into public.chat_conversations(id,token_hash,email) values($1,$2,'')",
        [id, "a".repeat(64)],
      );
      return id;
    };
    const receive = async (
      id,
      content,
      prompt = 0,
      choice = "",
      client = randomUUID(),
    ) =>
      (
        await db.query(
          "select public.sendora_chat_receive($1,$2,$3,$4,$5) as result",
          [id, client, content, choice, prompt],
        )
      ).rows[0].result;
    await run(db, create, receive);
  } finally {
    await db.close();
  }
}
test(
  "offline reception collects one optional answer at a time and persists the project summary",
  { skip: !PGlite },
  () =>
    fixture(async (db, create, receive) => {
      const id = await create();
      let result = await receive(id, "Hello");
      assert.equal(result.intake.step, 0);
      assert.equal(result.intake.mode, "collecting");
      const initial = (
        await db.query(
          "select * from public.chat_messages where role='assistant' order by seq",
        )
      ).rows[0];
      assert.match(initial.content, /automated assistant/);
      assert.match(initial.content, /Which product/);
      const answers = [
        "PU folder and pen gift sets",
        "Skip this question",
        "Small silver logo, custom box",
        "Melbourne, Australia 3000",
        "Before 20 December",
        "buyer@example.com",
      ];
      for (const [i, answer] of answers.entries()) {
        result = await receive(
          id,
          answer,
          result.intake.prompt_seq,
          i === 1 ? "skip" : "",
        );
        if (i < 5) assert.equal(result.intake.step, i + 1);
      }
      assert.equal(result.intake.mode, "completed");
      const summary = (
        await db.query("select * from public.chat_conversations where id=$1", [
          id,
        ])
      ).rows[0];
      assert.equal(summary.product, answers[0]);
      assert.equal(summary.quantity, "");
      assert.equal(summary.email, answers[5]);
      assert.equal(summary.destination, answers[3]);
      assert.equal(summary.deadline, answers[4]);
      assert.equal(summary.intake_state.answers.logo, answers[2]);
      assert.equal(summary.intake_state.answers.quantity, undefined);
      assert.equal(summary.status, "waiting");
      assert.equal(summary.last_role, "assistant");
      assert.ok(Number(summary.last_visitor_seq) < Number(summary.last_seq));
      await receive(
        id,
        "Please also consider blue packaging",
        result.intake.prompt_seq,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.chat_messages where role='assistant'",
          )
        ).rows[0].n,
        7,
      );
    }),
);
test(
  "retries and simultaneous stale answers do not duplicate or advance automated questions",
  { skip: !PGlite },
  () =>
    fixture(async (db, create, receive) => {
      const id = await create(),
        client = randomUUID();
      const first = await receive(id, "Hi", 0, "", client);
      const retried = await receive(id, "Hi", 0, "", client);
      assert.equal(retried.message.seq, first.message.seq);
      assert.equal(retried.intake.prompt_seq, first.intake.prompt_seq);
      const responses = await Promise.all([
        receive(id, "Metal pens", first.intake.prompt_seq),
        receive(id, "Silver colour", first.intake.prompt_seq),
      ]);
      assert.equal(responses[1].intake.step, 1);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.chat_messages where role='assistant'",
          )
        ).rows[0].n,
        2,
      );
      await assert.rejects(
        receive(id, "Different text", 0, "", client),
        (error) => error.code === "23505",
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.chat_messages where role='visitor'",
          )
        ).rows[0].n,
        3,
      );
    }),
);
test(
  "customers can skip all six questions, including contact, and still leave messages",
  { skip: !PGlite },
  () =>
    fixture(async (db, create, receive) => {
      const id = await create();
      let r = await receive(id, "Hi");
      for (let i = 0; i < 6; i++)
        r = await receive(
          id,
          "Skip this question",
          r.intake.prompt_seq,
          "skip",
        );
      assert.equal(r.intake.mode, "completed");
      assert.deepEqual(r.intake.answers, {});
      const row = (
        await db.query(
          "select email from public.chat_conversations where id=$1",
          [id],
        )
      ).rows[0];
      assert.equal(row.email, "");
    }),
);
test(
  "handoff keeps the partial brief and stops the bot until a human follows up",
  { skip: !PGlite },
  () =>
    fixture(async (db, create, receive) => {
      const id = await create();
      let r = await receive(id, "Hello");
      r = await receive(id, "100 welcome kits", r.intake.prompt_seq);
      r = await receive(id, "Talk to the team", r.intake.prompt_seq, "handoff");
      assert.equal(r.intake.mode, "waiting");
      assert.equal(r.intake.answers.product, "100 welcome kits");
      const n = (
        await db.query(
          "select count(*)::int as n from public.chat_messages where role='assistant'",
        )
      ).rows[0].n;
      r = await receive(
        id,
        "Can you discuss a smaller order?",
        r.intake.prompt_seq,
      );
      assert.equal(r.intake.mode, "waiting");
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.chat_messages where role='assistant'",
          )
        ).rows[0].n,
        n,
      );
    }),
);
test(
  "human replies and live agent presence prevent automated interruptions",
  { skip: !PGlite },
  () =>
    fixture(async (db, create, receive) => {
      const id = await create();
      let r = await receive(id, "Hi");
      await db.query(
        "insert into public.chat_messages(conversation_id,client_id,role,content) values($1,$2,'agent','Hello, I can help.')",
        [id, randomUUID()],
      );
      const state = (
        await db.query(
          "select intake_state from public.chat_conversations where id=$1",
          [id],
        )
      ).rows[0].intake_state;
      assert.equal(state.mode, "human");
      r = await receive(id, "We need 200 sets", r.intake.prompt_seq);
      assert.equal(r.intake.mode, "human");
      await db.exec(
        "update public.chat_settings set available_until=now()+interval '1 minute'",
      );
      const second = await create();
      r = await receive(second, "Hello");
      assert.equal(r.intake.mode, "human");
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.chat_messages where conversation_id=$1 and role='assistant'",
            [second],
          )
        ).rows[0].n,
        0,
      );
    }),
);
test(
  "the reception RPC is service-only and user input cannot choose an internal role",
  { skip: !PGlite },
  () =>
    fixture(async (db, create, receive) => {
      const id = await create();
      for (const role of ["anon", "authenticated"]) {
        await db.exec("set role " + role);
        await assert.rejects(receive(id, "Hi"), (e) => e.code === "42501");
        await assert.rejects(
          db.query("select intake_state from public.chat_conversations"),
          (e) => e.code === "42501",
        );
        await db.exec("reset role");
      }
      await db.exec("set role service_role");
      const r = await receive(id, "Hi");
      assert.equal(r.message.role, "visitor");
      await assert.rejects(
        receive(id, "x", 0, "invalid"),
        (e) => e.code === "22023",
      );
    }),
);
