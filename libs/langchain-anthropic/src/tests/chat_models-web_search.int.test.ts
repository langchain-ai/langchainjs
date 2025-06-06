import { test, expect } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "../chat_models.js";

const model = new ChatAnthropic({
  model: "claude-3-5-sonnet-20241022",
  temperature: 0,
}).bindTools([
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 1,
  },
]);

test("Web search single turn", async () => {
  const result = await model.invoke([
    new HumanMessage("What is Claude Shannon's birth date?"),
  ]);

  expect(result).toBeInstanceOf(AIMessage);
  expect(
    result.tool_calls?.find((tc) => tc.name === "web_search")
  ).toBeTruthy();
}, 30000);

test("Web search multi-turn conversation", async () => {
  const firstResponse = await model.invoke([
    new HumanMessage("What is Claude Shannon's birth date?"),
  ]);

  const secondResponse = await model.invoke([
    new HumanMessage("What is Claude Shannon's birth date?"),
    firstResponse,
    new HumanMessage("What year did he die?"),
  ]);

  expect(firstResponse).toBeInstanceOf(AIMessage);
  expect(secondResponse).toBeInstanceOf(AIMessage);
}, 45000);

test("Web search with unusual query", async () => {
  const result = await model.invoke([
    new HumanMessage("What is the population of Mars?"),
  ]);

  expect(result).toBeInstanceOf(AIMessage);
  expect(result.content).toBeDefined();
}, 30000);
