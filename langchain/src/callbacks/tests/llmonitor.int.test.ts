import { test } from "@jest/globals";

import { OpenAI } from "../../llms/openai.js";

import {
  ConstitutionalChain,
  ConstitutionalPrinciple,
  LLMChain,
} from "../../chains/index.js";

import { PromptTemplate } from "../../prompts/prompt.js";
import { LLMonitorHandler } from "../handlers/llmonitor.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { HumanMessage, SystemMessage } from "../../schema/index.js";
import { Calculator } from "../../tools/calculator.js";

import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";

test.skip("Test traced agent with openai functions", async () => {
  const tools = [new Calculator()];
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

  const executor = await initializeAgentExecutorWithOptions(tools, chat, {
    agentType: "openai-functions",
  });

  const result = await executor.run(
    "What is the approximate result of 78 to the power of 5?",
    {
      callbacks: [new LLMonitorHandler({ verbose: true })],
      metadata: {
        agentName: "SuperCalculator",
        userId: "test-user-id",
        userProps: {
          name: "Test User",
        },
      },
    }
  );

  console.log(result);
});

test.skip("Test traced chain with tags", async () => {
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
    {
      tags: ["test-for-tags"],
      callbacks: [new LLMonitorHandler({ verbose: true })],
    }
  );
});

test.skip("Test traced chat call with tags", async () => {
  const chat = new ChatOpenAI({
    callbacks: [new LLMonitorHandler({ verbose: true })],
  });

  const response = await chat.call([
    new HumanMessage(
      "What is a good name for a company that makes colorful socks?"
    ),
  ]);
  console.log(response.content);

  const response2 = await chat.call([
    new SystemMessage(
      "You are a helpful assistant that translates English to French."
    ),
    new HumanMessage("Translate: I love programming."),
  ]);
  console.log(response2.content);
});
