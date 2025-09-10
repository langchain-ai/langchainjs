/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatMessage } from "@langchain/core/messages";

import { ChatGroq, messageToGroqRole } from "../chat_models.js";

test("Serialization", () => {
  const model = new ChatGroq({
    apiKey: "foo",
    model: "llama-3.3-70b-versatile",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","groq","ChatGroq"],"kwargs":{"api_key":{"lc":1,"type":"secret","id":["GROQ_API_KEY"]},"model":"llama-3.3-70b-versatile"}}`
  );
});

test("messageToGroqRole", () => {
  // Test generic messages (ChatMessage type = "generic") with valid roles
  // These test the extractGenericMessageCustomRole path
  const genericUser = new ChatMessage("Hello, world!", "user");
  expect(messageToGroqRole(genericUser)).toBe("user");

  const genericAssistant = new ChatMessage("Hello, world!", "assistant");
  expect(messageToGroqRole(genericAssistant)).toBe("assistant");

  const genericSystem = new ChatMessage("Hello, world!", "system");
  expect(messageToGroqRole(genericSystem)).toBe("system");

  const genericFunction = new ChatMessage("Hello, world!", "function");
  expect(messageToGroqRole(genericFunction)).toBe("function");

  // Test generic message with tool role - should throw via extractGenericMessageCustomRole
  const genericTool = new ChatMessage("Hello, world!", "tool");
  expect(() => messageToGroqRole(genericTool)).toThrow(
    'Unsupported message role: tool. Expected "system", "assistant", "user", or "function"'
  );

  // Test generic message with invalid role - should throw via extractGenericMessageCustomRole
  const genericInvalid = new ChatMessage("Invalid message", "invalid");
  expect(() => messageToGroqRole(genericInvalid)).toThrow(
    'Unsupported message role: invalid. Expected "system", "assistant", "user", or "function"'
  );

  // Test generic message with custom role that's not supported
  const genericCustom = new ChatMessage("Custom message", "custom-role");
  expect(() => messageToGroqRole(genericCustom)).toThrow(
    'Unsupported message role: custom-role. Expected "system", "assistant", "user", or "function"'
  );
});
