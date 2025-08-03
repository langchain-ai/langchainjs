/* eslint-disable no-process-env */
import { ChatOpenAI } from "@langchain/openai";
import { SerpAPI } from "../../../util/testing/tools/serpapi.js";
import { Calculator } from "../../../util/testing/tools/calculator.js";
import { PlanAndExecuteAgentExecutor } from "../agent_executor.js";

test.skip("Run agent on a simple input", async () => {
  const tools = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({
    temperature: 0,
    model: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = await PlanAndExecuteAgentExecutor.fromLLMAndTools({
    llm: model,
    tools,
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await executor.call({
    input: `What is 80 raised to the second power?`,
  });

  // console.log({ result });
});

test.skip("Run agent", async () => {
  const tools = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({
    temperature: 0,
    model: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = await PlanAndExecuteAgentExecutor.fromLLMAndTools({
    llm: model,
    tools,
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await executor.call({
    input: `Who is the current president of the United States? What is their current age raised to the second power?`,
  });

  // console.log({ result });
});

// TODO: Improve prompt to store compressed context to support this input
test.skip("Run agent with a sequential math problem", async () => {
  const tools = [new Calculator()];
  const model = new ChatOpenAI({
    temperature: 0,
    model: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = await PlanAndExecuteAgentExecutor.fromLLMAndTools({
    llm: model,
    tools,
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await executor.call({
    input: `In a dance class of 20 students, 20% enrolled in contemporary dance, 25% of the remaining enrolled in jazz dance, and the rest enrolled in hip-hop dance. What percentage of the entire students enrolled in hip-hop dance?`,
  });

  // console.log(result);
});

test.skip("Should run agent with no tools", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    model: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = await PlanAndExecuteAgentExecutor.fromLLMAndTools({
    llm: model,
    tools: [],
  });

  await executor.call({
    input: `Who is the current president of the United States? What is their current age raised to the second power?`,
  });
});
