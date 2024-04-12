import { test, expect } from "@jest/globals";
import { AIMessage } from "../../messages/ai.js";
import { HumanMessage } from "../../messages/human.js";
import { SystemMessage } from "../../messages/system.js";
import { ChatPromptTemplate } from "../chat.js";

test("Test creating a chat prompt template from role string messages", async () => {
  const template = ChatPromptTemplate.fromMessages(
    [
      ["system", "You are a helpful AI bot. Your name is {{name}}."],
      ["human", "Hello, how are you doing?"],
      ["ai", "I'm doing well, thanks!"],
      ["human", "{{userInput}}"],
    ],
    {
      templateFormat: "mustache",
      validateTemplate: false,
    }
  );

  const messages = await template.formatMessages({
    name: "Bob",
    userInput: "What is your name?",
  });

  expect(messages).toEqual([
    new SystemMessage({
      content: "You are a helpful AI bot. Your name is Bob.",
    }),
    new HumanMessage({
      content: "Hello, how are you doing?",
    }),
    new AIMessage({
      content: "I'm doing well, thanks!",
    }),
    new HumanMessage({
      content: "What is your name?",
    }),
  ]);
});
