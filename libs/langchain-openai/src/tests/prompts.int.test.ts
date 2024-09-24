import OpenAI from "openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { convertPromptToOpenAI } from "../utils/prompts.js";

test("Convert hub prompt to OpenAI payload and invoke", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a world class comedian"],
    ["human", "Tell me a joke about {topic}"],
  ]);
  const formattedPrompt = await prompt.invoke({
    topic: "cats",
  });

  const { messages } = convertPromptToOpenAI(formattedPrompt);

  const openAIClient = new OpenAI();

  const openAIResponse = await openAIClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  expect(openAIResponse.choices.length).toBeGreaterThan(0);
});
