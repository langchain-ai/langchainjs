/* eslint-disable no-process-env */
import * as uuid from "uuid";
import { test } from "@jest/globals";

import { LangChainTracer } from "../handlers/tracer_langchain.js";
import { OpenAI } from "../../llms/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";
import { HumanMessage } from "../../schema/index.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { Serialized } from "../../load/serializable.js";
import {
  ConstitutionalChain,
  ConstitutionalPrinciple,
  LLMChain,
} from "../../chains/index.js";
import { PromptTemplate } from "../../prompts/prompt.js";

const serialized: Serialized = {
  lc: 1,
  type: "constructor",
  id: ["test"],
  kwargs: {},
};

test("Test LangChain V2 tracer", async () => {
  const tracer = new LangChainTracer({
    projectName: `JS Int Test - ${uuid.v4()}`,
  });
  const chainRunId = uuid.v4();
  const toolRunId = uuid.v4();
  const llmRunId = uuid.v4();
  const chatRunId = uuid.v4();
  await tracer.handleChainStart(serialized, { foo: "bar" }, chainRunId);
  await tracer.handleToolStart(serialized, "test", toolRunId, chainRunId);
  await tracer.handleLLMStart(serialized, ["test"], llmRunId, toolRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
  await tracer.handleChatModelStart(
    serialized,
    [[new HumanMessage("I'm a human.")]],
    chatRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, chatRunId);
  await tracer.handleToolEnd("output", toolRunId);
  const llmRunId2 = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], llmRunId2, chainRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId2);
  await tracer.handleChainEnd({ foo: "bar" }, chainRunId);

  const llmRunId3 = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], llmRunId3);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId3);
});

test("Test traced chain with tags", async () => {
  const llm = new OpenAI();
  const qaPrompt = new PromptTemplate({
    template: "Q: {question} A:",
    inputVariables: ["question"],
  });

  const qaChain = new LLMChain({
    llm,
    prompt: qaPrompt,
  });

  const constitutionalChain = ConstitutionalChain.fromLLM(llm, {
    tags: ["only-in-root-chain"],
    chain: qaChain,
    constitutionalPrinciples: [
      new ConstitutionalPrinciple({
        critiqueRequest: "Tell me if this answer is good.",
        revisionRequest: "Give a better answer.",
      }),
    ],
  });

  await constitutionalChain.call(
    {
      question: "What is the meaning of life?",
    },
    [new LangChainTracer()],
    ["test-for-tags"]
  );
});

test("Test Traced Agent with concurrency", async () => {
  process.env.LANGCHAIN_TRACING_V2 = "true";
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
    verbose: true,
  });

  const input = `What is 24,678,987 raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const [resultA, resultB, resultC] = await Promise.all([
    executor.call({ input }, { tags: ["test"], metadata: { a: "b" } }),
    executor.call({ input }, { tags: ["test"], metadata: { a: "b" } }),
    executor.call({ input }, { tags: ["test"], metadata: { a: "b" } }),
  ]);

  console.log(`Got output ${resultA.output}`);
  console.log(`Got output ${resultB.output}`);
  console.log(`Got output ${resultC.output}`);
});

test("Test Traced Agent with chat model", async () => {
  process.env.LANGCHAIN_TRACING_V2 = "true";
  const model = new ChatOpenAI({ temperature: 0, metadata: { e: "f" } });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
    verbose: true,
    metadata: { c: "d" },
  });

  const input = `What is 24,678,987 raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const [resultA, resultB, resultC] = await Promise.all([
    executor.call({ input }, { tags: ["test"], metadata: { a: "b" } }),
    executor.call({ input }, { tags: ["test"], metadata: { a: "b" } }),
    executor.call({ input }, { tags: ["test"], metadata: { a: "b" } }),
  ]);

  console.log(`Got output ${resultA.output}`);
  console.log(`Got output ${resultB.output}`);
  console.log(`Got output ${resultC.output}`);
});
