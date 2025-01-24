/* eslint-disable no-process-env */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import * as hub from "../hub.js";

test("Test LangChain Hub client pushing a new repo", async () => {
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
