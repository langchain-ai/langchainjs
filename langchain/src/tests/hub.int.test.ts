import * as hub from "../hub.js";
import { PromptTemplate } from "../prompts/prompt.js";

test("Test LangChain Hub client pushing a new repo", async () => {
  const prompt = PromptTemplate.fromTemplate(
    `You are a parrot. The current date is ${new Date().toISOString()}\n{input}`
  );
  const repoName = `${
    process.env.LANGCHAIN_HUB_USERNAME
  }/langchainjs-${new Date().getTime()}`;
  await hub.push(repoName, prompt);
  const pulledPrompt = await hub.pull<PromptTemplate>(repoName);
  expect(prompt.format({ input: "testing" })).toEqual(
    pulledPrompt.format({ input: "testing" })
  );
});
