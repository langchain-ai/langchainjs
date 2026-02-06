/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, expect, test, describe, beforeEach } from "@jest/globals";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { BedrockEmbeddings } from "../embeddings.js";

/**
 * Creates a mock BedrockRuntimeClient whose `send` method captures the
 * command and returns a fake embedding response.
 */
function createMockClient() {
  const mockSend = jest.fn<any>().mockResolvedValue({
    body: new TextEncoder().encode(
      JSON.stringify({ embedding: [0.1, 0.2, 0.3] })
    ),
  });

  // Cast to BedrockRuntimeClient so the constructor accepts it
  const client = { send: mockSend } as unknown as BedrockRuntimeClient;
  return { client, mockSend };
}

/**
 * Extracts the parsed request body from the first call to mockSend.
 */
function getRequestBody(mockSend: jest.Mock): Record<string, unknown> {
  const command = mockSend.mock.calls[0][0];
  return JSON.parse(command.input.body);
}

describe("BedrockEmbeddings", () => {
  let client: BedrockRuntimeClient;
  let mockSend: jest.Mock;

  beforeEach(() => {
    ({ client, mockSend } = createMockClient());
  });

  test("passes modelKwargs into request body", async () => {
    const embeddings = new BedrockEmbeddings({
      model: "amazon.titan-embed-text-v2:0",
      client,
      modelKwargs: {
        normalize: true,
      },
    });

    await embeddings.embedQuery("Hello world");

    expect(getRequestBody(mockSend)).toEqual({
      inputText: "Hello world",
      normalize: true,
    });
  });

  test("passes dimensions into request body", async () => {
    const embeddings = new BedrockEmbeddings({
      model: "amazon.titan-embed-text-v2:0",
      client,
      dimensions: 512,
    });

    await embeddings.embedQuery("Hello world");

    expect(getRequestBody(mockSend)).toEqual({
      inputText: "Hello world",
      dimensions: 512,
    });
  });

  test("dimensions param takes precedence over modelKwargs.dimensions", async () => {
    const embeddings = new BedrockEmbeddings({
      model: "amazon.titan-embed-text-v2:0",
      client,
      dimensions: 512,
      modelKwargs: {
        dimensions: 1024,
        normalize: true,
      },
    });

    await embeddings.embedQuery("Hello world");

    expect(getRequestBody(mockSend)).toEqual({
      inputText: "Hello world",
      dimensions: 512,
      normalize: true,
    });
  });

  test("sends only inputText when no modelKwargs or dimensions", async () => {
    const embeddings = new BedrockEmbeddings({
      client,
    });

    await embeddings.embedQuery("Hello world");

    expect(getRequestBody(mockSend)).toEqual({
      inputText: "Hello world",
    });
  });

  test("modelKwargs with multiple custom parameters", async () => {
    const embeddings = new BedrockEmbeddings({
      model: "amazon.titan-embed-text-v2:0",
      client,
      modelKwargs: {
        normalize: true,
        embeddingTypes: ["float"],
      },
    });

    await embeddings.embedQuery("Hello world");

    expect(getRequestBody(mockSend)).toEqual({
      inputText: "Hello world",
      normalize: true,
      embeddingTypes: ["float"],
    });
  });
});
