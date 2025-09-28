/* eslint-disable no-process-env */

import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { ChatAnthropic } from "@langchain/anthropic";
import * as hub from "../index.js";
import { pull as nodePull } from "../node.js";

test("Test LangChain Hub client pushing a new repo", async () => {
  const prompt = PromptTemplate.fromTemplate(
    `You are a parrot. The current date is ${new Date().toISOString()}\n{input}`
  );
  const repoName = `${
    process.env.LANGCHAIN_HUB_USERNAME
  }/langchainjs-${new Date().getTime()}`;
  await hub.push(repoName, prompt, {
    newRepoIsPublic: false,
  });
  const pulledPrompt = await hub.pull(repoName);
  expect(await prompt.invoke({ input: "testing" })).toEqual(
    await pulledPrompt.invoke({ input: "testing" })
  );
  const pulledPromptNode = await nodePull(repoName);
  expect(await prompt.invoke({ input: "testing" })).toEqual(
    await pulledPromptNode.invoke({ input: "testing" })
  );
});

test("Test LangChain Hub client pushing a new chat template repo", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a parrot. The current date is ${new Date().toISOString()}\n{input}`
  );
  const repoName = `${
    process.env.LANGCHAIN_HUB_USERNAME
  }/langchainjs-${new Date().getTime()}`;
  await hub.push(repoName, prompt, {
    newRepoIsPublic: false,
  });
  const pulledPrompt = await hub.pull(repoName);
  expect(await prompt.invoke({ input: "testing" })).toEqual(
    await pulledPrompt.invoke({ input: "testing" })
  );
  const pulledPromptNode = await nodePull(repoName);
  expect(await prompt.invoke({ input: "testing" })).toEqual(
    await pulledPromptNode.invoke({ input: "testing" })
  );
});

test("Test LangChain Hub with a faulty mustache prompt", async () => {
  const pulledPrompt = await hub.pull("jacob/lahzo-testing");
  const res = await pulledPrompt.invoke({
    agent: { name: "testing" },
    messages: [new AIMessage("foo")],
  });
  expect(res).toEqual(
    new ChatPromptValue([
      new SystemMessage("You are a chatbot."),
      new HumanMessage("testing"),
      new AIMessage("foo"),
    ])
  );
});

test("Test LangChain Hub while loading model", async () => {
  const pulledPrompt = await hub.pull("jacob/lahzo-testing", {
    includeModel: true,
    modelClass: ChatAnthropic,
  });
  const res = await pulledPrompt.invoke({
    agent: { name: "testing" },
    messages: [new AIMessage("foo")],
  });
  expect(res).toBeInstanceOf(AIMessage);
});

test("Test LangChain Hub while loading OpenAI model with dynamic imports", async () => {
  const pulledPrompt = await nodePull("jacob/langchainjs-openai", {
    includeModel: true,
  });
  const res = await pulledPrompt.invoke({
    question: "Generate JSON",
  });
  expect(res).toBeInstanceOf(AIMessage);
  expect(typeof JSON.parse(res.content)).toEqual("object");
});

test("Test LangChain Hub while loading model with dynamic imports", async () => {
  const pulledPrompt = await nodePull("jacob/groq-test", {
    includeModel: true,
  });
  const res = await pulledPrompt.invoke({
    question:
      "Who is the current president of the USA as of today? You must use the provided tool for the latest info.",
  });
  expect(res).toBeInstanceOf(AIMessage);
  expect(res.tool_calls?.length).toEqual(1);
});

test("Test LangChain Hub while loading model with dynamic imports and structured output", async () => {
  const pulledPrompt = await nodePull("jacob/structured-output", {
    includeModel: true,
  });
  const res = await pulledPrompt.invoke({
    question:
      "Who is the current president of the USA as of today? You must use the provided tool for the latest info.",
  });
  expect(res).not.toBeInstanceOf(AIMessage);
  expect(typeof res.correctness).toBe("boolean");
});

test("Test LangChain Hub while loading model with dynamic imports and structured output with no binding", async () => {
  const pulledPrompt = await nodePull("jacob/structured-output-2", {
    includeModel: true,
  });
  const res = await pulledPrompt.invoke({
    input:
      "Who is the current president of the USA as of today? You must use the provided tool for the latest info.",
  });
  expect(res).not.toBeInstanceOf(AIMessage);
  expect(typeof res.correctness).toBe("boolean");
});

test("Test LangChain Hub while loading model not defined in a RunnableBinding", async () => {
  const promptA = await nodePull("hntrl/binding-manifest", {
    includeModel: true,
  });
  const resA = await promptA.invoke({
    question: "What's the capital of the USA?",
  });
  expect(resA).toBeInstanceOf(AIMessage);
  expect(resA.content).toBeDefined();
});
