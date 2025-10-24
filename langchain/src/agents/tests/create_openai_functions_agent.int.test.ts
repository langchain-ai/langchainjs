/** eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "../../util/testing/tools/tavily_search.js";
import { pull } from "../../hub/index.js";
import { AgentExecutor, createOpenAIFunctionsAgent } from "../index.js";

const tools = [new TavilySearchResults({ maxResults: 1 })];

test("createOpenAIFunctionsAgent works", async () => {
  const prompt = await pull<ChatPromptTemplate>(
    "hwchase17/openai-functions-agent"
  );
  const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    temperature: 0,
  });
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  const input = "what is LangChain?";
  const result = await agentExecutor.invoke({
    input,
  });

  // console.log(result);

  expect(result.input).toBe(input);
  expect(typeof result.output).toBe("string");
  // Length greater than 10 because any less than that would warrant
  // an investigation into why such a short generation was returned.
  expect(result.output.length).toBeGreaterThan(10);
});

test("createOpenAIFunctionsAgent can stream log", async () => {
  const prompt = await pull<ChatPromptTemplate>(
    "hwchase17/openai-functions-agent"
  );
  const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    temperature: 0,
    streaming: true,
  });
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  const input = "tell me a short story.";
  const logStream = await agentExecutor.streamLog({
    input,
  });

  const chunks = [];
  let firstChunkTime;
  for await (const chunk of logStream) {
    if (!firstChunkTime) {
      firstChunkTime = new Date().getTime();
    }
    // console.log(chunk);
    chunks.push(chunk);
  }

  if (!firstChunkTime) {
    throw new Error("firstChunkTime was not set.");
  }

  // console.log(chunks.length);
  // console.log();
  // console.log(
  //   "Time to complete after first chunk:",
  //   new Date().getTime() - firstChunkTime
  // );

  // console.log(chunks.length);
  expect(chunks.length).toBeGreaterThan(1);
});
