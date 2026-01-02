import { describe, expect, it, vi } from "vitest";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { BedrockEmbeddings } from "../embeddings.js";

describe("BedrockEmbeddings", () => {
  const baseConstructorArgs = {
    region: "us-east-1",
    credentials: {
      secretAccessKey: "test-secret-key",
      accessKeyId: "test-access-key",
    },
  };

  describe("Nova embedding model support", () => {
    it("should use messages format for Nova embedding models", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            embedding: [0.1, 0.2, 0.3],
          })
        ),
      });

      const mockClient = {
        send: mockSend,
      } as unknown as BedrockRuntimeClient;

      const embeddings = new BedrockEmbeddings({
        ...baseConstructorArgs,
        model: "amazon.nova-embed-text-v1",
        client: mockClient,
      });

      const result = await embeddings.embedQuery("Hello world");

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandArg = mockSend.mock.calls[0][0];
      const requestBody = JSON.parse(commandArg.input.body);

      // Nova models should use messages format
      expect(requestBody).toHaveProperty("messages");
      expect(requestBody.messages).toEqual([
        {
          role: "user",
          content: [
            {
              text: "Hello world",
            },
          ],
        },
      ]);
      expect(requestBody).not.toHaveProperty("inputText");
    });

    it("should use messages format for Nova models with regional prefix", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            embedding: [0.1, 0.2, 0.3],
          })
        ),
      });

      const mockClient = {
        send: mockSend,
      } as unknown as BedrockRuntimeClient;

      const embeddings = new BedrockEmbeddings({
        ...baseConstructorArgs,
        model: "us.amazon.nova-embed-text-v1",
        client: mockClient,
      });

      await embeddings.embedQuery("Hello world");

      const commandArg = mockSend.mock.calls[0][0];
      const requestBody = JSON.parse(commandArg.input.body);

      // Nova models should use messages format regardless of regional prefix
      expect(requestBody).toHaveProperty("messages");
      expect(requestBody).not.toHaveProperty("inputText");
    });

    it("should use inputText format for Titan embedding models", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            embedding: [0.4, 0.5, 0.6],
          })
        ),
      });

      const mockClient = {
        send: mockSend,
      } as unknown as BedrockRuntimeClient;

      const embeddings = new BedrockEmbeddings({
        ...baseConstructorArgs,
        model: "amazon.titan-embed-text-v1",
        client: mockClient,
      });

      const result = await embeddings.embedQuery("Hello world");

      expect(result).toEqual([0.4, 0.5, 0.6]);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandArg = mockSend.mock.calls[0][0];
      const requestBody = JSON.parse(commandArg.input.body);

      // Titan models should use inputText format
      expect(requestBody).toHaveProperty("inputText");
      expect(requestBody.inputText).toBe("Hello world");
      expect(requestBody).not.toHaveProperty("messages");
    });

    it("should use inputText format for Titan V2 embedding models", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            embedding: [0.4, 0.5, 0.6],
          })
        ),
      });

      const mockClient = {
        send: mockSend,
      } as unknown as BedrockRuntimeClient;

      const embeddings = new BedrockEmbeddings({
        ...baseConstructorArgs,
        model: "amazon.titan-embed-text-v2:0",
        client: mockClient,
      });

      await embeddings.embedQuery("Hello world");

      const commandArg = mockSend.mock.calls[0][0];
      const requestBody = JSON.parse(commandArg.input.body);

      // Titan models should use inputText format
      expect(requestBody).toHaveProperty("inputText");
      expect(requestBody).not.toHaveProperty("messages");
    });

    it("should use default Titan model when no model is specified", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            embedding: [0.1, 0.2],
          })
        ),
      });

      const mockClient = {
        send: mockSend,
      } as unknown as BedrockRuntimeClient;

      const embeddings = new BedrockEmbeddings({
        ...baseConstructorArgs,
        client: mockClient,
      });

      expect(embeddings.model).toBe("amazon.titan-embed-text-v1");

      await embeddings.embedQuery("Test");

      const commandArg = mockSend.mock.calls[0][0];
      const requestBody = JSON.parse(commandArg.input.body);

      // Default Titan model should use inputText format
      expect(requestBody).toHaveProperty("inputText");
      expect(requestBody).not.toHaveProperty("messages");
    });

    it("should replace newlines in text before embedding", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            embedding: [0.1, 0.2, 0.3],
          })
        ),
      });

      const mockClient = {
        send: mockSend,
      } as unknown as BedrockRuntimeClient;

      const embeddings = new BedrockEmbeddings({
        ...baseConstructorArgs,
        model: "amazon.nova-embed-text-v1",
        client: mockClient,
      });

      await embeddings.embedQuery("Hello\nworld\ntest");

      const commandArg = mockSend.mock.calls[0][0];
      const requestBody = JSON.parse(commandArg.input.body);

      // Newlines should be replaced with spaces
      expect(requestBody.messages[0].content[0].text).toBe("Hello world test");
    });

    it("should embed multiple documents", async () => {
      const mockSend = vi
        .fn()
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(
            JSON.stringify({
              embedding: [0.1, 0.2],
            })
          ),
        })
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(
            JSON.stringify({
              embedding: [0.3, 0.4],
            })
          ),
        });

      const mockClient = {
        send: mockSend,
      } as unknown as BedrockRuntimeClient;

      const embeddings = new BedrockEmbeddings({
        ...baseConstructorArgs,
        model: "amazon.nova-embed-text-v1",
        client: mockClient,
      });

      const result = await embeddings.embedDocuments(["Doc 1", "Doc 2"]);

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
