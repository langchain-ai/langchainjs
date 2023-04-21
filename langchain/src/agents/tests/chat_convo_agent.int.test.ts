/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BufferMemory } from "../../memory/index.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { WebBrowser } from "../../tools/webbrowser.js";

test("Run conversational agent with memory", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const tools = [new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
    memory: new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "input",
    }),
  });
  console.log("Loaded agent.");

  const input0 = `"how is your day going?"`;

  const result0 = await executor.call({ input: input0 });

  console.log(`Got output ${result0.output}`);

  const input1 = `"whats is 9 to the 2nd power?"`;

  const result1 = await executor.call({ input: input1 });

  console.log(`Got output ${result1.output}`);

  const input2 = `"whats is that result divided by 10?"`;

  const result2 = await executor.call({ input: input2 });

  console.log(`Got output ${result2.output}`);
});

test.only("Run conversational2 agent with memory", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const tools = [
    new Calculator(),
    new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description2",
    verbose: true,
    memory: new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "input",
    }),
    // returnIntermediateSteps: true,
  });
  console.log("Loaded agent.");

  const input = `"What is the word of the day on https://www.merriam-webster.com/word-of-the-day. What is the square root the number of letters"`;

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);

  // cant test this because memory
  //     input values have multiple keys, memory only supported when one key currently: output,intermediateSteps
  // expect(result.intermediateSteps.length).toEqual(2);
  // expect(result.intermediateSteps[0].action.tool).toEqual("web-browser");
  // expect(result.intermediateSteps[1].action.tool).toEqual("calculator");
});
