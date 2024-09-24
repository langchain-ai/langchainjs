import Anthropic from "@anthropic-ai/sdk";
import { pull } from "langchain/hub";

import { convertPromptToAnthropic } from "../utils/prompts.js";

test("basic traceable implementation", async () => {
  const prompt = await pull("jacob/joke-generator");
  const formattedPrompt = await prompt.invoke({
    topic: "cats",
  });

  const { system, messages } = convertPromptToAnthropic(formattedPrompt);

  const anthropicClient = new Anthropic();

  const anthropicResponse = await anthropicClient.messages.create({
    model: "claude-3-haiku-20240307",
    system,
    messages: messages,
    max_tokens: 1024,
    stream: false,
  });

  expect(anthropicResponse.content).toBeDefined();
});
