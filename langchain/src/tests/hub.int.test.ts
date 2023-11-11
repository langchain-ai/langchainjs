/* eslint-disable no-process-env */

import * as hub from "../hub.js";
import { PromptTemplate } from "../prompts/prompt.js";

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
  expect(prompt.invoke({ input: "testing" })).toEqual(
    pulledPrompt.invoke({ input: "testing" })
  );
});
