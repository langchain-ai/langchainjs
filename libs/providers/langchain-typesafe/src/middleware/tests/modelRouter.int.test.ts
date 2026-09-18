import { describe, expect, test } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { modelRouterMiddleware } from "../modelRouter.js";

/**
 * `BeforeAgentHook` (langchain's `types.ts`) is a union of a bare handler
 * function and `{ hook, canJumpTo? }`, so `mw.beforeAgent!(...)` is not
 * directly callable — unlike `WrapToolCallHook`, which is a bare function
 * type. Unwrap either shape and invoke the underlying handler.
 */
function callBeforeAgent(
  mw: { beforeAgent?: unknown },
  state: unknown,
  runtime: unknown
) {
  const hook = mw.beforeAgent as
    | ((s: unknown, r: unknown) => Promise<unknown>)
    | { hook: (s: unknown, r: unknown) => Promise<unknown> };
  return typeof hook === "function"
    ? hook(state, runtime)
    : hook.hook(state, runtime);
}

const CHOICES = {
  fast: { model: "openai:gpt-5-mini", criteria: "Simple, well-scoped tasks." },
  powerful: {
    model: "openai:gpt-5",
    criteria: "Complex tasks requiring deeper reasoning.",
  },
};

async function route(text: string) {
  // No classifierOptions: the real key comes from TYPESAFE_API_KEY.
  const mw = modelRouterMiddleware({
    choices: CHOICES,
    instructions: "Choose the least costly model suited to the task.",
  });
  const update = await callBeforeAgent(
    mw,
    { messages: [new HumanMessage(text)] } as never,
    {} as never
  );
  return (
    update as {
      modelRoute: { choice: string; probabilities: Record<string, number> };
    }
  ).modelRoute;
}

describe.skipIf(!process.env.TYPESAFE_API_KEY)(
  "modelRouterMiddleware against the live TypeSafe API",
  () => {
    test("a trivial task routes to the cheap model", async () => {
      const a = await route("What is 2+2?");
      expect(a.choice).toBe("fast");
      expect(a.probabilities.fast).toBeGreaterThan(a.probabilities.powerful);
    });

    test("a hard task routes to the capable model", async () => {
      const a = await route(
        "Design a distributed consensus protocol tolerating Byzantine faults, and prove safety."
      );
      expect(a.choice).toBe("powerful");
      expect(a.probabilities.powerful).toBeGreaterThan(a.probabilities.fast);
    });

    test("the two tasks separate decisively", async () => {
      const [simple, hard] = await Promise.all([
        route("What is 2+2?"),
        route(
          "Design a Byzantine-fault-tolerant consensus protocol and prove safety."
        ),
      ]);
      expect(simple.probabilities.fast).toBeGreaterThan(
        hard.probabilities.fast
      );
    });
  }
);
