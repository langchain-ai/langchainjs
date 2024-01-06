import { test, expect } from "@jest/globals";
import { FakeLLM, FakeChatModel } from "@langchain/core/utils/testing";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  createOpenAIFunctionsAgent,
  createOpenAIToolsAgent,
  createReactAgent,
  createStructuredChatAgent,
  createXmlAgent,
} from "../index.js";
import { Calculator } from "../../tools/calculator.js";

const tools = [new Calculator()];

test("can initialize createStructuredChatAgent", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `{tools} {tool_names}`],
    ["human", "{input} {agent_scratchpad}"],
  ]);
  const llm = new FakeLLM({});
  const agent = await createStructuredChatAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createOpenAIFunctionsAgent works", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `{tools} {tool_names}`],
    ["human", "{input} {agent_scratchpad}"],
  ]);
  const llm = new FakeChatModel({});
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createOpenAIToolsAgent works", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `{tools} {tool_names}`],
    ["human", "{input} {agent_scratchpad}"],
  ]);
  const llm = new FakeChatModel({});
  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createXmlAgent works", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `{tools} {tool_names}`],
    ["human", "{input} {agent_scratchpad}"],
  ]);
  const llm = new FakeLLM({});
  const agent = await createXmlAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createReactAgent works", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `{tools} {tool_names}`],
    ["human", "{input} {agent_scratchpad}"],
  ]);
  const llm = new FakeLLM({});
  const agent = await createReactAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});
