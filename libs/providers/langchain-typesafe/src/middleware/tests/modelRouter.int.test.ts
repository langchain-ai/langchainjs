import { expect, test } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { modelRouterMiddleware } from "../modelRouter.js";

const CHOICES = {
  fast: { model: "openai:gpt-5-mini", criteria: "Simple, well-scoped tasks." },
  powerful: { model: "openai:gpt-5", criteria: "Complex tasks requiring deeper reasoning." },
};

async function route(text: string) {
  // No classifierOptions: the real key comes from TYPESAFE_API_KEY.
  const mw = modelRouterMiddleware({
    choices: CHOICES,
    instructions: "Choose the least costly model suited to the task.",
  });
  const update = await mw.beforeAgent!(
    { messages: [new HumanMessage(text)] } as never, {} as never
  );
  return (update as { modelRoute: { choice: string; probabilities: Record<string, number> } }).modelRoute;
}

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
    route("Design a Byzantine-fault-tolerant consensus protocol and prove safety."),
  ]);
  expect(simple.probabilities.fast).toBeGreaterThan(hard.probabilities.fast);
});
