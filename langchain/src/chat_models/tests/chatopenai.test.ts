import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import {
  BaseChatMessage,
  SystemChatMessage,
  HumanChatMessage,
} from "../../schema/index.js";

function createSystemChatMessage(text: string, name?: string) {
  const msg = new SystemChatMessage(text);
  msg.name = name;
  return msg;
}

function createSampleMessages(): BaseChatMessage[] {
  // same example as in https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
  return [
    createSystemChatMessage(
      "You are a helpful, pattern-following assistant that translates corporate jargon into plain English."
    ),
    createSystemChatMessage(
      "New synergies will help drive top-line growth.",
      "example_user"
    ),
    createSystemChatMessage(
      "Things working well together will increase revenue.",
      "example_assistant"
    ),
    createSystemChatMessage(
      "Let's circle back when we have more bandwidth to touch base on opportunities for increased leverage.",
      "example_user"
    ),
    createSystemChatMessage(
      "Let's talk later when we're less busy about how to do better.",
      "example_assistant"
    ),
    new HumanChatMessage(
      "This late pivot means we don't have time to boil the ocean for the client deliverable."
    ),
  ];
}

test("getNumTokensFromMessages gpt-3.5-turbo-0301 model for sample input", async () => {
  const messages: BaseChatMessage[] = createSampleMessages();

  const chat = new ChatOpenAI({
    openAIApiKey: "dummy",
    modelName: "gpt-3.5-turbo-0301",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(127);
});

test("getNumTokensFromMessages gpt-4-0314 model for sample input", async () => {
  const messages: BaseChatMessage[] = createSampleMessages();

  const chat = new ChatOpenAI({
    openAIApiKey: "dummy",
    modelName: "gpt-4-0314",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(129);
});
