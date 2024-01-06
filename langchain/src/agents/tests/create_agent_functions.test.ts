import { test, expect } from "@jest/globals";
import { ChatOpenAI, OpenAI } from "@langchain/openai";
import type {
  ChatPromptTemplate,
  PromptTemplate,
} from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { pull } from "../../hub.js";
import {
  createOpenAIFunctionsAgent,
  createReactAgent,
  createStructuredChatAgent,
  createXmlAgent,
} from "../index.js";
import { ChatAnthropic } from "../../chat_models/anthropic.js";

const tools = [new TavilySearchResults({ maxResults: 1 })];

test("createStructuredChatAgent works", async () => {
  const prompt = await pull<ChatPromptTemplate>(
    "hwchase17/structured-chat-agent"
  );
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });
  const agent = await createStructuredChatAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createOpenAIFunctionsAgent works", async () => {
  const prompt = await pull<ChatPromptTemplate>(
    "hwchase17/openai-functions-agent"
  );
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createOpenAIToolsAgent works", async () => {
  const prompt = await pull<ChatPromptTemplate>(
    "hwchase17/structured-chat-agent"
  );
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });
  const agent = await createStructuredChatAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createXmlAgent works", async () => {
  const prompt = await pull<PromptTemplate>("hwchase17/xml-agent-convo");
  const llm = new ChatAnthropic({
    modelName: "claude-2.1",
    temperature: 0,
  });
  const agent = await createXmlAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});

test("createReactAgent works", async () => {
  const prompt = await pull<PromptTemplate>("hwchase17/react");
  const llm = new OpenAI({
    modelName: "gpt-3.5-turbo-instruct",
    temperature: 0,
  });
  const agent = await createReactAgent({
    llm,
    tools,
    prompt,
  });
  const serializedAgent = agent.toJSON();
  expect(serializedAgent).toMatchSnapshot();
});
