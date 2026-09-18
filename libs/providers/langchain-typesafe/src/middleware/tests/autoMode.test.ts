import { describe, expect, test } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { autoModeMiddleware } from "../autoMode.js";

/** Fresh Response per call — see the note in modelRouter.test.ts. */
function stubFetch(noul: number, capture?: (body: { state?: unknown }) => void): typeof fetch {
  return (async (_url: unknown, init?: { body?: string }) => {
    if (capture && typeof init?.body === "string") capture(JSON.parse(init.body));
    return new Response(
      JSON.stringify({
        model: "jev-1.13.0",
        answers: { is_risky: { type: "noul", noul } },
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;
}

function opts(noul: number, capture?: (body: { state?: unknown }) => void) {
  return { apiKey: "test-key", fetch: stubFetch(noul, capture) };
}

const REQ = {
  toolCall: { id: "call_1", name: "run_sql", args: { query: "DROP DATABASE production;" } },
  tool: { name: "run_sql", description: "Execute SQL against the primary database." },
  state: { messages: [new HumanMessage("Clean up the old records.")] },
} as never;

describe("autoModeMiddleware", () => {
  test("allows a call below the threshold and invokes the handler", async () => {
    const mw = autoModeMiddleware({ tools: ["run_sql"], classifierOptions: opts(0.03) });
    let called = false;
    const out = await mw.wrapToolCall!(REQ, async () => { called = true; return "ok" as never; });
    expect(called).toBe(true);
    expect(out).toBe("ok");
  });

  test("blocks at or above the threshold WITHOUT invoking the handler", async () => {
    const mw = autoModeMiddleware({ tools: ["run_sql"], classifierOptions: opts(0.99) });
    let called = false;
    const out = await mw.wrapToolCall!(REQ, async () => { called = true; return "ok" as never; });
    expect(called).toBe(false);
    const msg = out as { content: string; status: string; tool_call_id: string };
    expect(msg.status).toBe("error");
    expect(msg.tool_call_id).toBe("call_1");
    expect(msg.content).toContain("run_sql");
    expect(msg.content).toContain("0.99");
  });

  test("blocks exactly AT the threshold (>=, not >)", async () => {
    const mw = autoModeMiddleware({ tools: ["run_sql"], threshold: 0.2, classifierOptions: opts(0.2) });
    let called = false;
    await mw.wrapToolCall!(REQ, async () => { called = true; return "ok" as never; });
    expect(called).toBe(false);
  });

  test("skips classification entirely for an unlisted tool", async () => {
    let classified = false;
    const mw = autoModeMiddleware({
      tools: ["other_tool"],
      classifierOptions: opts(0.99, () => { classified = true; }),
    });
    let called = false;
    await mw.wrapToolCall!(REQ, async () => { called = true; return "ok" as never; });
    expect(classified).toBe(false);
    expect(called).toBe(true);
  });

  test("sends a bounded window, the tool call and the description", async () => {
    let seen: Record<string, unknown> = {};
    const many = Array.from({ length: 40 }, (_, i) => new HumanMessage(`m${i}`));
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      classifierOptions: opts(0.01, (b) => { seen = b.state as Record<string, unknown>; }),
    });
    await mw.wrapToolCall!({ ...(REQ as object), state: { messages: many } } as never,
      async () => "ok" as never);
    expect((seen.messages as unknown[]).length).toBe(30);
    expect(seen.tool_call).toEqual({
      id: "call_1", name: "run_sql", args: { query: "DROP DATABASE production;" },
    });
    expect(seen.tool_description).toBe("Execute SQL against the primary database.");
  });

  test("fails closed: a classifier error propagates and the tool does not run", async () => {
    const boom = (async () => { throw new Error("transport down"); }) as unknown as typeof fetch;
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      classifierOptions: { apiKey: "test-key", fetch: boom, maxRetries: 0 },
    });
    let called = false;
    await expect(
      mw.wrapToolCall!(REQ, async () => { called = true; return "ok" as never; })
    ).rejects.toThrow();
    expect(called).toBe(false);
  });

  test("rejects an empty tools list and an out-of-range threshold", () => {
    expect(() => autoModeMiddleware({ tools: [], classifierOptions: opts(0) })).toThrow(/at least one/i);
    expect(() => autoModeMiddleware({ tools: ["t"], threshold: 1.5, classifierOptions: opts(0) }))
      .toThrow(/threshold/i);
  });
});
