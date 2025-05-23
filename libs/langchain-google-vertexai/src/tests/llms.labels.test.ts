import { test, expect } from "@jest/globals";
import { VertexAI } from "../llms.js";

// Define a minimal local type for the parts of GoogleAbstractedClientOps we need
interface MinimalClientOps {
  data?: { labels?: Record<string, string>; [key: string]: any };
  // Add other fields from GoogleAbstractedClientOps if they become necessary for the mock
}

test("VertexAI (LLM) should pass labels to the API call", async () => {
  const llm = new VertexAI({
    model: "gemini-pro", // Assuming gemini-pro can be used by VertexAI LLM too
  });

  const labels = {
    "user-id": "llm-user-456",
    "session-id": "llm-session-xyz",
  };

  const clientRequestSpy = jest.spyOn(
    (llm as any).connection.client,
    "request"
  );

  // Mock a basic successful LLM response to allow 'invoke' to complete
  // The LLM typically expects a simpler text response structure via Gemini API
  clientRequestSpy.mockResolvedValueOnce({
    data: {
      candidates: [
        {
          content: { parts: [{ text: "mocked LLM response" }], role: "model" },
          finishReason: "STOP",
          index: 0,
          safetyRatings: [],
        },
      ],
      promptFeedback: { safetyRatings: [] },
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      }
    },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as any);

  await llm.invoke("A simple prompt for LLM", {
    labels,
  });

  expect(clientRequestSpy).toHaveBeenCalled();

  const requestOptions = clientRequestSpy.mock.calls[0][0] as MinimalClientOps;
  expect(requestOptions.data?.labels).toEqual(labels);

  clientRequestSpy.mockRestore();
});
