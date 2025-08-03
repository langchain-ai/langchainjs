import Anthropic from "@anthropic-ai/sdk";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { convertPromptToAnthropic } from "../utils/prompts.js";

test("Convert hub prompt to Anthropic payload and invoke", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a world class comedian"],
    ["human", "Tell me a joke about {topic}"],
  ]);
  const formattedPrompt = await prompt.invoke({
    topic: "cats",
  });

  const { system, messages } = convertPromptToAnthropic(formattedPrompt);

  const anthropicClient = new Anthropic();

  const anthropicResponse = await anthropicClient.messages.create({
    model: "claude-3-haiku-20240307",
    system,
    messages,
    max_tokens: 1024,
    stream: false,
  });

  expect(anthropicResponse.content).toBeDefined();
});
