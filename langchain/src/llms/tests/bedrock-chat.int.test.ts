import { test, expect } from "@jest/globals";
import { EventStreamMarshaller } from "@aws-sdk/eventstream-marshaller";
import { fromUtf8, toUtf8 } from "@aws-sdk/util-utf8-universal";
import { BedrockChat } from "../bedrock-chat.js";
import { CallbackManager } from "../../callbacks/index.js";

test("Test BedrockChat LLM: streaming", async () => {
  const marshaller = new EventStreamMarshaller(toUtf8, fromUtf8);

  const region = "us-east-1";
  const model = "amazon.model";
  const streaming = true;

  const tokens: string[] = [];
  const callbackManager = CallbackManager.fromHandlers({
    async handleLLMNewToken(token: string) {
      tokens.push(token);
    },
  });

  const prompt = "What is your name?";
  const answer = "Hello! My name is Claude.";

  const body = JSON.stringify({ outputText: answer });
  const bytes = JSON.stringify({ bytes: Buffer.from(body).toString("base64") });
  const event = marshaller.marshall({
    headers: {
      ":event-type": { type: "string", value: "chunk" },
      ":content-type": { type: "string", value: "application/json" },
      ":message-type": { type: "string", value: "event" },
    },
    body: Uint8Array.from(Buffer.from(bytes)),
  });

  let chunkIter = 0;
  const mockReader = {
    read: async () => {
      if (chunkIter === 0) {
        chunkIter += 1;
        return {
          done: false,
          value: event,
        };
      } else {
        chunkIter += 1;
        return {
          done: true,
        };
      }
    },
  };

  const bedrock = new BedrockChat({
    maxTokens: 20,
    region,
    model,
    async fetchFn(
      input: RequestInfo | URL,
      init?: RequestInit | undefined
    ): Promise<Response> {
      expect(input).toBeInstanceOf(URL);
      expect((input as URL).href).toBe(
        `https://bedrock.${region}.amazonaws.com/model/${model}/invoke-with-response-stream`
      );
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        host: `bedrock.${region}.amazonaws.com`,
        accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(init?.body).toBe(
        '{"inputText":"What is your name?","textGenerationConfig":{}}'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        resolve({
          status: 200,
          body: {
            getReader: () => mockReader,
          },
        });
      });
    },
    streaming,
    callbackManager,
  });

  const res = await bedrock.call(prompt);
  expect(typeof res).toBe("string");
  expect(res).toBe(answer);

  expect(tokens.join("")).toBe(answer);
}, 5000);
