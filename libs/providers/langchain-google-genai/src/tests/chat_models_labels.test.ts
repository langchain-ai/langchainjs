import { test, jest, expect } from "@jest/globals";

test("ChatGoogleGenerativeAI passes labels to getGenerativeModel", async () => {
  const mockGetGenerativeModel = jest.fn();

  // @ts-ignore
  jest.unstable_mockModule("@google/generative-ai", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actual: any = await jest.requireActual("@google/generative-ai");
    return {
      ...actual,
      GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
      })),
    };
  });

  // Dynamic import to ensure mock is applied
  const { ChatGoogleGenerativeAI } = await import("../chat_models.js");

  const labels = { env: "development"};
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-pro",
    labels: labels,
    apiKey: "test-api-key",
  });

  // Verify getGenerativeModel was called with the correct arguments
  expect(mockGetGenerativeModel).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "gemini-pro",
      labels: labels,
    }),
    expect.anything()
  );
});
