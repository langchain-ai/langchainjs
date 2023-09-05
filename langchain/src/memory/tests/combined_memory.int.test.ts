import { test, expect } from "@jest/globals";
import { BufferMemory } from "../buffer_memory.js";
import { CombinedMemory } from "../combined_memory.js";
import { ConversationSummaryMemory } from "../summary.js";
import { OpenAI } from "../../llms/openai.js";
import { AIMessage, HumanMessage, SystemMessage } from "../../schema/index.js";

test("Test combined memory", async () => {
  // buffer memory
  const bufferMemory = new BufferMemory({
    memoryKey: "chat_history_lines",
    inputKey: "input",
  });

  // summary memory
  const conversationSummaryMemory = new ConversationSummaryMemory({
    llm: new OpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      verbose: true,
    }),
    inputKey: "input",
  });

  const memory = new CombinedMemory({
    memories: [bufferMemory, conversationSummaryMemory],
  });

  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ chat_history_lines: "", history: "" });

  await memory.saveContext({ input: "bar" }, { output: "foo" });
  const expectedString = "Human: bar\nAI: foo";
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);

  expect(result2.chat_history_lines).toStrictEqual(expectedString);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    chat_history_lines: "",
    history: "",
  });
});

test("Test combined memory return messages", async () => {
  // buffer memory
  const conv_memory = new BufferMemory({
    memoryKey: "chat_history_lines",
    inputKey: "input",
    returnMessages: true,
  });

  // summary memory
  const summary_memory = new ConversationSummaryMemory({
    llm: new OpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      verbose: true,
    }),
    inputKey: "input",
    returnMessages: true,
  });

  const memory = new CombinedMemory({
    memories: [conv_memory, summary_memory],
  });

  const result1 = await memory.loadMemoryVariables({});
  console.log("result1", result1);
  expect(result1).toStrictEqual({
    chat_history_lines: [],
    history: [new SystemMessage("")],
  });

  await memory.saveContext({ input: "bar" }, { output: "foo" });
  const expectedResult = [new HumanMessage("bar"), new AIMessage("foo")];
  const result2 = await memory.loadMemoryVariables({});
  console.log("result2", result2);

  expect(result2.chat_history_lines).toStrictEqual(expectedResult);

  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({
    chat_history_lines: [],
    history: [new SystemMessage("")],
  });
});
