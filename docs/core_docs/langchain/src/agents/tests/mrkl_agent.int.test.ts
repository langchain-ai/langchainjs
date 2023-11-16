/* eslint-disable no-process-env */
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { DynamicTool } from "../../tools/dynamic.js";

test("Run agent locally with GPT-3.5", async () => {
  const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-3.5-turbo" });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
    new DynamicTool({
      name: "foo",
      description: "Some other tool that does foo",
      func: async () => "bar",
    }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
  });

  const input = `What is the weather like in Washington DC?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
});

test("Run agent locally with GPT-4", async () => {
  const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-4" });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
    new DynamicTool({
      name: "foo",
      description: "Some other tool that does foo",
      func: async () => "bar",
    }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
  });

  const input = `What is the weather like in Washington DC?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
});
