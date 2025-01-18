/* eslint-disable no-process-env */

import { ChatPromptTemplate } from "@langchain/core/prompts";
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
