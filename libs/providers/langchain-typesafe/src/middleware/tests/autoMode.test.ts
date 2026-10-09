import { describe, expect, test, vi } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { fakeModel } from "@langchain/core/testing";
import { createAgent, MiddlewareError } from "langchain";
import * as z from "zod/v4";

import {
  autoModeMiddleware,
  buildRiskState,
  renderBlockedMessage,
} from "../autoMode.js";
import { TypeSafeError } from "../../index.js";

/**
 * A `vi.fn()` classifier transport, injected via the public `fetch`
 * option rather than stubbed onto the global.
 *
 * Injection is the house style for provider tests here (openai, anthropic
 * and deepseek all do it) and it mutates no global, so nothing leaks
 * between tests and there is no teardown to forget. Being a `vi.fn()`
 * means "was the classifier called?" and "what went on the wire?" are
 * standard mock assertions instead of hand-rolled callbacks.
 *
 * A fresh Response per call: a body can only be read once, and a shared
 * instance fails the second call with "body already used".
 */
function stubFetch(noul: number) {
  return vi.fn(
    async (_url: unknown, _init?: { body?: string }) =>
      new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers: { is_risky: { type: "noul", noul } },
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  );
}

function opts(fetchMock: ReturnType<typeof stubFetch>) {
  return { apiKey: "test-key", fetch: fetchMock as unknown as typeof fetch };
}

/** The classifier request body of the Nth call. */
function sentState(fetchMock: ReturnType<typeof stubFetch>, call = 0) {
  const init = fetchMock.mock.calls[call]?.[1];
  if (typeof init?.body !== "string") {
    throw new Error("no classifier request body was captured");
  }
  return (JSON.parse(init.body) as { state: Record<string, unknown> }).state;
}

const RUN_SQL_DESCRIPTION = "Execute SQL against the primary database.";

/** A real bound tool — args and description are the middleware's own. */
function makeRunSqlTool(onCall: (args: { query: string }) => void = () => {}) {
  return tool(
    (args: { query: string }) => {
      onCall(args);
      return `ran: ${args.query}`;
    },
    {
      name: "run_sql",
      description: RUN_SQL_DESCRIPTION,
      schema: z.object({ query: z.string() }),
    }
  );
}

describe("autoModeMiddleware", () => {
  test("allows a call below the threshold: the real tool executes", async () => {
    let executed = false;
    const runSql = makeRunSqlTool(() => {
      executed = true;
    });
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      classifierOptions: opts(stubFetch(0.03)),
    });
    const model = fakeModel()
      .respondWithTools([
        { name: "run_sql", args: { query: "SELECT 1" }, id: "call_1" },
      ])
      .respond(new AIMessage("Done."));
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    const result = await agent.invoke({
      messages: [new HumanMessage("Clean up the old records.")],
    });
    expect(executed).toBe(true);
    const toolMessage = result.messages.find(ToolMessage.isInstance);
    expect(toolMessage?.content).toBe("ran: SELECT 1");
    expect(toolMessage?.status).toBe("success");
  });

  test("accepts a tool OBJECT in `tools`, not just a name", async () => {
    // `tools` takes `string | { name: string }` so a bound tool can be
    // passed straight through. Only the object form reads `.name`, so a
    // regression there would silently watch nothing and allow every call.
    let executed = false;
    const runSql = makeRunSqlTool(() => {
      executed = true;
    });
    const mw = autoModeMiddleware({
      tools: [runSql],
      classifierOptions: opts(stubFetch(0.99)),
    });
    const model = fakeModel()
      .respondWithTools([
        { name: "run_sql", args: { query: "DROP DATABASE x;" }, id: "call_1" },
      ])
      .respond(new AIMessage("I can't run that."));
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    await agent.invoke({ messages: [new HumanMessage("clean up")] });
    expect(executed).toBe(false);
  });

  test("blocks at or above the threshold WITHOUT invoking the real tool", async () => {
    let executed = false;
    const runSql = makeRunSqlTool(() => {
      executed = true;
    });
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      classifierOptions: opts(stubFetch(0.99)),
    });
    const model = fakeModel()
      .respondWithTools([
        {
          name: "run_sql",
          args: { query: "DROP DATABASE production;" },
          id: "call_1",
        },
      ])
      .respond(new AIMessage("I can't run that."));
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    const result = await agent.invoke({
      messages: [new HumanMessage("Clean up the old records.")],
    });
    expect(executed).toBe(false);
    const toolMessage = result.messages.find(ToolMessage.isInstance);
    expect(toolMessage?.status).toBe("error");
    expect(toolMessage?.tool_call_id).toBe("call_1");
    expect(toolMessage?.content).toContain("run_sql");
    expect(toolMessage?.content).toContain("0.99");
  });

  test("wires a custom blockedMessage through a real tool call, even for a $-metachar tool name", async () => {
    // `String.replace` with a STRING replacement expands `$&`/`` $` ``/`$'`/
    // `$n`, and this tool name carries one. The exhaustive case lives on
    // `renderBlockedMessage`'s own tests below; this proves the real
    // ToolNode/wrapToolCall plumbing doesn't mangle such a name either.
    const weirdName = "$`";
    let executed = false;
    const weirdTool = tool(
      () => {
        executed = true;
        return "ok";
      },
      { name: weirdName, description: "A tool.", schema: z.object({}) }
    );
    const mw = autoModeMiddleware({
      tools: [weirdName],
      blockedMessage: "{tool_name} blocked, {tool_name} again ({probability}).",
      classifierOptions: opts(stubFetch(0.99)),
    });
    const model = fakeModel()
      .respondWithTools([{ name: weirdName, args: {}, id: "call_2" }])
      .respond(new AIMessage("ok"));
    const agent = createAgent({ model, tools: [weirdTool], middleware: [mw] });
    const result = await agent.invoke({
      messages: [new HumanMessage("hi")],
    });
    expect(executed).toBe(false);
    const toolMessage = result.messages.find(ToolMessage.isInstance);
    expect(toolMessage?.content).toBe("$` blocked, $` again (0.99).");
  });

  test("blocks exactly AT the threshold (>=, not >)", async () => {
    let executed = false;
    const runSql = makeRunSqlTool(() => {
      executed = true;
    });
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      classifierOptions: opts(stubFetch(0.5)),
    });
    const model = fakeModel()
      .respondWithTools([{ name: "run_sql", args: { query: "q" }, id: "c1" }])
      .respond(new AIMessage("blocked"));
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    await agent.invoke({ messages: [new HumanMessage("hi")] });
    expect(executed).toBe(false);
  });

  test("skips classification entirely for an unlisted tool", async () => {
    let executed = false;
    const runSql = makeRunSqlTool(() => {
      executed = true;
    });
    const fetchMock = stubFetch(0.99);
    const mw = autoModeMiddleware({
      tools: ["other_tool"],
      classifierOptions: opts(fetchMock),
    });
    const model = fakeModel()
      .respondWithTools([
        { name: "run_sql", args: { query: "SELECT 1" }, id: "c1" },
      ])
      .respond(new AIMessage("done"));
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    await agent.invoke({ messages: [new HumanMessage("hi")] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(executed).toBe(true);
  });

  test("forwards the bounded transcript and the REAL tool's description to the classifier", async () => {
    // The window-slicing and tool_description-omission RULES are
    // `buildRiskState`'s own tests below. What only a real agent proves is
    // that `request.tool?.description` — the bound tool's actual
    // description, not a hand-passed argument — reaches the wire.
    const fetchMock = stubFetch(0.01);
    const many = Array.from(
      { length: 40 },
      (_, i) => new HumanMessage(`m${i}`)
    );
    const runSql = makeRunSqlTool();
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      classifierOptions: opts(fetchMock),
    });
    const model = fakeModel()
      .respondWithTools([
        {
          name: "run_sql",
          args: { query: "DROP DATABASE production;" },
          id: "call_1",
        },
      ])
      .respond(new AIMessage("done"));
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    await agent.invoke({ messages: many });
    const seen = sentState(fetchMock);
    expect((seen.messages as unknown[]).length).toBe(30);
    expect(seen.tool_call).toEqual({
      id: "call_1",
      name: "run_sql",
      args: { query: "DROP DATABASE production;" },
    });
    expect(seen.tool_description).toBe(RUN_SQL_DESCRIPTION);
  });

  test("fails closed: a classifier error propagates, WRAPPED in MiddlewareError, and the tool does not run", async () => {
    const boom = (async () => {
      throw new Error("transport down");
    }) as unknown as typeof fetch;
    let executed = false;
    const runSql = makeRunSqlTool(() => {
      executed = true;
    });
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      classifierOptions: { apiKey: "test-key", fetch: boom, maxRetries: 0 },
    });
    const model = fakeModel().respondWithTools([
      { name: "run_sql", args: { query: "q" }, id: "c1" },
    ]);
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    const error = await agent
      .invoke({ messages: [new HumanMessage("hi")] })
      .catch((e: unknown) => e);
    expect(executed).toBe(false);
    // The asymmetry documented on `autoModeMiddleware`: the agent wraps
    // wrapToolCall errors in MiddlewareError, so a `TypeSafeError.isInstance`
    // check on the caught error itself fails and callers must read `.cause`.
    expect(MiddlewareError.isInstance(error)).toBe(true);
    expect(TypeSafeError.isInstance(error)).toBe(false);
    expect(TypeSafeError.isInstance((error as { cause?: unknown }).cause)).toBe(
      true
    );
  });

  test("null classifies on instructions alone", async () => {
    const fetchMock = stubFetch(0.01);
    const runSql = makeRunSqlTool();
    const mw = autoModeMiddleware({
      tools: ["run_sql"],
      criteria: null,
      classifierOptions: opts(fetchMock),
    });
    const model = fakeModel()
      .respondWithTools([{ name: "run_sql", args: { query: "q" }, id: "c1" }])
      .respond(new AIMessage("done"));
    const agent = createAgent({ model, tools: [runSql], middleware: [mw] });
    await agent.invoke({ messages: [new HumanMessage("hi")] });
    const init = fetchMock.mock.calls[0]?.[1];
    if (typeof init?.body !== "string") throw new Error("no body captured");
    const { questions } = JSON.parse(init.body) as {
      questions: Record<string, Record<string, unknown>>;
    };
    expect("criteria" in questions.is_risky).toBe(false);
    expect(questions.is_risky.instructions).toBeTypeOf("string");
  });
});

describe("buildRiskState", () => {
  test("slices the transcript to the last 30 messages", () => {
    const many = Array.from(
      { length: 35 },
      (_, i) => new HumanMessage(`m${i}`)
    );
    const state = buildRiskState(many, { name: "t", args: {} });
    expect(state.messages).toEqual(many.slice(-30));
  });

  test("omits tool_description when absent or empty, keeps it otherwise", () => {
    expect(buildRiskState([], { name: "t", args: {} })).not.toHaveProperty(
      "tool_description"
    );
    expect(buildRiskState([], { name: "t", args: {} }, "")).not.toHaveProperty(
      "tool_description"
    );
    expect(buildRiskState([], { name: "t", args: {} }, "desc")).toHaveProperty(
      "tool_description",
      "desc"
    );
  });

  test("maps a missing tool-call id to null, keeps a real one", () => {
    const withoutId = buildRiskState([], { name: "t", args: {} }).tool_call as {
      id: unknown;
    };
    expect(withoutId.id).toBeNull();
    const withId = buildRiskState([], { id: "abc", name: "t", args: {} })
      .tool_call as { id: unknown };
    expect(withId.id).toBe("abc");
  });
});

describe("renderBlockedMessage", () => {
  test("fills {tool_name} and {probability} to two decimals", () => {
    expect(
      renderBlockedMessage("{tool_name} @ {probability}", "run_sql", 0.5)
    ).toBe("run_sql @ 0.50");
  });

  test("substitutes every occurrence using FUNCTION replacements, never expanding a $-metachar tool name", () => {
    // A STRING replacement would expand `$&`, `` $` ``, `$'` and `$n` inside
    // this name; only a function replacement inserts it literally. Two
    // `{tool_name}` occurrences also checks `replaceAll`, not just the first.
    const weirdName = "$&$`$'$1";
    const out = renderBlockedMessage(
      "{tool_name} blocked, {tool_name} again ({probability}).",
      weirdName,
      0.99
    );
    expect(out).toBe(`${weirdName} blocked, ${weirdName} again (0.99).`);
  });
});
