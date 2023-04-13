/* eslint-disable no-process-env */
import { expect, test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { loadAgent } from "../load.js";
import { AgentExecutor, Tool } from "../index.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutor } from "../initialize.js";
import { WebBrowser } from "../../tools/webbrowser.js";

test("Run agent from hub", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-babbage-001" });
  const tools: Tool[] = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];
  const agent = await loadAgent(
    "lc://agents/zero-shot-react-description/agent.json",
    { llm: model, tools }
  );
  const executor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });
  const res = await executor.call({
    input:
      "Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?",
  });
  console.log(res);
}, 30000);

test("Run agent locally", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-babbage-001" });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description"
  );
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
}, 30000);

test("Run tool web-browser", async () => {
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
    new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
  ];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description"
  );
  console.log("Loaded agent.");

  const input = `What is the word of the day on merriam webster`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);

  expect(result.intermediateSteps.length).toEqual(1);
  expect(result.intermediateSteps[0].action.tool).toEqual("web-browser");
  expect(result.output).not.toEqual("");
}, 30000);
