import { test, expect } from "@jest/globals";
import { ChatVertexAI } from "../chat_models.js";
import { MockClient } from "@langchain/google-common/src/tests/mock.ts";

test("ChatVertexAI should pass labels to the API call", async () => {
  const mockClient = new MockClient();
  const chatModel = new ChatVertexAI({
    model: "gemini-pro",
    // We need to force the client to be the mock client for testing purposes.
    // This is a bit of a hack, ideally there would be a cleaner way to inject mocks.
    // For now, we'll cast the chatModel to access the protected connection property.
    // In a real scenario, testing lower-level components or refactoring for dependency injection would be better.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: mockClient as any,
  });

  const labels = {
    "user-id": "123",
    "session-id": "abc",
  };

  await chatModel.invoke("hello", {
    labels,
  });

  // Assert that the mock client's request record contains the labels
  // The request format is based on the Gemini API request structure
  expect(mockClient.record.opts.data.labels).toEqual(labels);
});
