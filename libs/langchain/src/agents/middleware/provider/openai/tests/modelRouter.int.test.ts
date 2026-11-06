import { describe, it, expect } from "vitest";
import { OpenAIDecisions } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { openAIModelRouterMiddleware } from "../modelRouter.js";
import { createAgent } from "../../../../index.js";
import { FakeToolCallingModel } from "../../../../tests/utils.js";

describe("openAIModelRouterMiddleware", () => {
  it.each([
    { task: "What is 2 + 2?", route: "fast" },
    {
      task: "Design a Byzantine fault tolerant consensus protocol and prove its safety and liveness properties.",
      route: "powerful",
    },
  ])(
    "routes $route tasks with a live classification",
    async ({ task, route }) => {
      const agent = createAgent({
        model: new FakeToolCallingModel(),
        middleware: [
          openAIModelRouterMiddleware({
            model: new OpenAIDecisions("gpt-6-luna"),
            instructions: "Choose the least costly model suited to the task.",
            choices: {
              fast: {
                model: new FakeToolCallingModel(),
                criteria: "Simple, quick tasks.",
              },
              powerful: {
                model: new FakeToolCallingModel(),
                criteria: "Complex tasks requiring deep reasoning.",
              },
            },
          }),
        ],
      });

      const result = await agent.invoke({ messages: [new HumanMessage(task)] });

      expect(result.modelRoute?.choice).toBe(route);
    }
  );
});
