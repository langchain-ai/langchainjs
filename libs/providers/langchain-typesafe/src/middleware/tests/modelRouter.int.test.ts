import { describe, expect, test } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { createAgent } from "langchain";
import { modelRouterMiddleware } from "../modelRouter.js";

/**
 * Drives a real agent so the run exercises the composition layer, not just
 * the classifier. The per-route models are FAKE — only the classification
 * itself is live, which is what these tests probe.
 */
async function route(text: string) {
  const fastModel = fakeModel().respond(new AIMessage("fast reply"));
  const powerfulModel = fakeModel().respond(new AIMessage("powerful reply"));
  // No classifierOptions: the real key comes from TYPESAFE_API_KEY.
  const mw = modelRouterMiddleware({
    choices: {
      fast: { model: fastModel, criteria: "Simple, well-scoped tasks." },
      powerful: {
        model: powerfulModel,
        criteria: "Complex tasks requiring deeper reasoning.",
      },
    },
    instructions: "Choose the least costly model suited to the task.",
  });
  const agent = createAgent({
    model: fakeModel(),
    tools: [],
    middleware: [mw],
  });
  const result = await agent.invoke({ messages: [new HumanMessage(text)] });
  return {
    modelRoute: result.modelRoute as {
      choice: string;
      probabilities: Record<string, number>;
    },
    fastCalls: fastModel.callCount,
    powerfulCalls: powerfulModel.callCount,
  };
}

describe.skipIf(!process.env.TYPESAFE_API_KEY)(
  "modelRouterMiddleware against the live TypeSafe API",
  () => {
    test("a trivial task routes to the cheap model", async () => {
      const r = await route("What is 2+2?");
      expect(r.modelRoute.choice).toBe("fast");
      expect(r.modelRoute.probabilities.fast).toBeGreaterThan(
        r.modelRoute.probabilities.powerful
      );
      // Proves wrapModelCall actually ran the "fast" model, not just that
      // `modelRoute` holds the winning label.
      expect(r.fastCalls).toBe(1);
      expect(r.powerfulCalls).toBe(0);
    });

    test("a hard task routes to the capable model", async () => {
      const r = await route(
        "Design a distributed consensus protocol tolerating Byzantine faults, and prove safety."
      );
      expect(r.modelRoute.choice).toBe("powerful");
      expect(r.modelRoute.probabilities.powerful).toBeGreaterThan(
        r.modelRoute.probabilities.fast
      );
      expect(r.powerfulCalls).toBe(1);
      expect(r.fastCalls).toBe(0);
    });

    test("the two tasks separate decisively", async () => {
      const [simple, hard] = await Promise.all([
        route("What is 2+2?"),
        route(
          "Design a Byzantine-fault-tolerant consensus protocol and prove safety."
        ),
      ]);
      expect(simple.modelRoute.probabilities.fast).toBeGreaterThan(
        hard.modelRoute.probabilities.fast
      );
    });
  }
);
