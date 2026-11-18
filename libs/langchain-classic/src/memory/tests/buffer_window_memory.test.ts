import { describe, test, expect } from "vitest";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory as ChatMessageHistory } from "@langchain/core/chat_history";

import { BufferWindowMemory } from "../buffer_window_memory.js";

test("Test buffer window memory", async () => {
  const memory = new BufferWindowMemory({ k: 1 });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedString = "Human: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });

  await memory.saveContext({ foo: "bar1" }, { bar: "foo" });
  const expectedString3 = "Human: bar1\nAI: foo";
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedString3 });
});

test("Test buffer window memory return messages", async () => {
  const memory = new BufferWindowMemory({ k: 1, returnMessages: true });
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: [] });

  await memory.saveContext({ foo: "bar" }, { bar: "foo" });
  const expectedResult = [new HumanMessage("bar"), new AIMessage("foo")];
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedResult });

  await memory.saveContext({ foo: "bar1" }, { bar: "foo" });
  const expectedResult2 = [new HumanMessage("bar1"), new AIMessage("foo")];
  const result3 = await memory.loadMemoryVariables({});
  expect(result3).toStrictEqual({ history: expectedResult2 });
});

test("Test buffer window memory with pre-loaded history", async () => {
  const pastMessages = [
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
  ];
  const memory = new BufferWindowMemory({
    returnMessages: true,
    chatHistory: new ChatMessageHistory(pastMessages),
  });
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({ history: pastMessages });
});

describe("Test buffer window memory window size", () => {
  const saveTurns = async (memory: BufferWindowMemory, turns: number) => {
    for (let i = 1; i <= turns; i += 1) {
      await memory.saveContext(
        { input: `question ${i}` },
        { output: `answer ${i}` }
      );
    }
  };

  test.each([
    [0, 0],
    [1, 2],
    [2, 4],
    [4, 8],
    [10, 8],
  ])(
    "k = %i returns %i messages when 4 turns are saved",
    async (k, expectedCount) => {
      const memory = new BufferWindowMemory({ k, returnMessages: true });
      await saveTurns(memory, 4);

      const { history } = await memory.loadMemoryVariables({});
      expect(history).toHaveLength(expectedCount);
    }
  );

  test("k = 0 returns an empty string when not returning messages", async () => {
    const memory = new BufferWindowMemory({ k: 0 });
    await saveTurns(memory, 4);

    const result = await memory.loadMemoryVariables({});
    expect(result).toStrictEqual({ history: "" });
  });

  test("k = 1 returns only the last turn", async () => {
    const memory = new BufferWindowMemory({ k: 1 });
    await saveTurns(memory, 4);

    const result = await memory.loadMemoryVariables({});
    expect(result).toStrictEqual({
      history: "Human: question 4\nAI: answer 4",
    });
  });
});
