// standalone dev server — lets you poke the agent without booting next.js.
// local only, nothing deploys this (vercel runs the graph via app/api routes).
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { runPing } from "./graph";
import { startSession, submitAnswer, loadSession } from "./runner";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "requirement-clarification-agent",
    endpoints: [
      "GET  /ping",
      "POST /sessions            {raw_idea}",
      "POST /sessions/:id/answer {answer}",
      "GET  /sessions/:id",
    ],
  })
);

app.get("/ping", async (c) => {
  const result = await runPing();
  return c.json({ status: "ok", agent: result });
});

app.post("/sessions", async (c) => {
  try {
    const body = await c.req.json<{ raw_idea?: string }>();
    const result = await startSession(body.raw_idea ?? "");
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

app.post("/sessions/:id/answer", async (c) => {
  try {
    const body = await c.req.json<{ answer?: string }>();
    const result = await submitAnswer(c.req.param("id"), body.answer ?? "");
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

app.get("/sessions/:id", async (c) => {
  const snapshot = await loadSession(c.req.param("id"));
  if (!snapshot) return c.json({ error: "unknown session" }, 404);
  return c.json(snapshot);
});

const port = Number(process.env.AGENT_PORT ?? 8123);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Agent server listening on http://localhost:${info.port}`);
});
