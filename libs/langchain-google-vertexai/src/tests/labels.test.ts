import { test, expect } from "@jest/globals";
import { ChatVertexAI } from "../chat_models.js";

// Define a minimal local type for the parts of GoogleAbstractedClientOps we need
interface MinimalClientOps {
  data?: { labels?: Record<string, string>; [key: string]: any };
  // Add other fields from GoogleAbstractedClientOps if they become necessary for the mock
}

test("ChatVertexAI should pass labels to the API call", async () => {
  const chatModel = new ChatVertexAI({
    model: "gemini-pro",
    // No longer injecting a mock client directly
  });

  const labels = {
    "user-id": "123",
    "session-id": "abc",
  };

  // Spy on the request method of the internal client
  // The actual path to 'request' might be deeper depending on client structure
  // (chatModel as any).connection.client is the GAuthClient instance
  const clientRequestSpy = jest.spyOn(
    (chatModel as any).connection.client,
    "request"
  );

  // Mock a basic successful response to allow 'invoke' to complete
  clientRequestSpy.mockResolvedValueOnce({
    data: {
      candidates: [
        {
          content: { parts: [{ text: "mocked response" }], role: "model" },
          finishReason: "STOP",
          index: 0,
          safetyRatings: [],
        },
      ],
      promptFeedback: { safetyRatings: [] },
      usageMetadata: { // Add usageMetadata to avoid potential errors if the model expects it
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      }
    },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as any); // Cast as any to satisfy the spy's expected return type if complex

  await chatModel.invoke("hello", {
    labels,
  });

  // Assert that the spy was called
  expect(clientRequestSpy).toHaveBeenCalled();

  // Assert that the mock client's request record contains the labels
  // The request options are the first argument to client.request
  const requestOptions = clientRequestSpy.mock.calls[0][0] as MinimalClientOps;
  // The actual data payload within GoogleAbstractedClientOps is under the 'data' property, which is 'unknown'
  // We expect it to be an object with a 'labels' field for this test.
  expect(requestOptions.data?.labels).toEqual(labels);

  // Restore the spy to avoid affecting other tests
  clientRequestSpy.mockRestore();
});
