import { test, expect } from "@jest/globals";
import { EventStreamCodec } from "@smithy/eventstream-codec";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";
import { Bedrock } from "../bedrock.js";
import { CallbackManager } from "../../callbacks/index.js";

test("Test Bedrock LLM: ai21", async () => {
  const region = "us-east-1";
  const model = "ai21.j2-grande-instruct";
  const prompt = "What is your name?";
  const answer = "Hello! My name is Claude.";

  const bedrock = new Bedrock({
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
        `{"prompt":"${prompt}","maxTokens":20,"temperature":0}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        resolve({
          status: 200,
          body: {
            getReader: () => buildResponse(answer, "data.text"),
          },
        });
      });
    },
  });

  const res = await bedrock.call(prompt);
  expect(typeof res).toBe("string");
  expect(res).toBe(answer);
}, 5000);

test("Test Bedrock LLM: anthropic", async () => {
  const region = "us-east-1";
  const model = "anthropic.model";
  const prompt = "What is your name?";
  const answer = "Hello! My name is Claude.";

  const bedrock = new Bedrock({
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
        `{"prompt":"${prompt}","max_tokens_to_sample":20,"temperature":0}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        resolve({
          status: 200,
          body: {
            getReader: () => buildResponse(answer, "completion"),
          },
        });
      });
    },
  });

  const res = await bedrock.call(prompt);
  expect(typeof res).toBe("string");
  expect(res).toBe(answer);
}, 5000);

test("Test Bedrock LLM: amazon", async () => {
  const region = "us-east-1";
  const model = "amazon.model";
  const prompt = "What is your name?";
  const answer = "Hello! My name is Claude.";

  const bedrock = new Bedrock({
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
        '{"inputText":"What is your name?","textGenerationConfig":{"maxTokenCount":20,"temperature":0}}'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        resolve({
          status: 200,
          body: {
            getReader: () => buildResponse(answer, "outputText"),
          },
        });
      });
    },
  });

  const res = await bedrock.call(prompt);
  expect(typeof res).toBe("string");
  expect(res).toBe(answer);
}, 5000);

test("Test Bedrock LLM: other model", async () => {
  const region = "us-east-1";
  const model = "other.model";

  async function tryInstantiateModel() {
    // eslint-disable-next-line no-new
    new Bedrock({
      maxTokens: 20,
      region,
      model,
      async fetchFn(
        _input: RequestInfo | URL,
        _init?: RequestInit | undefined
      ): Promise<Response> {
        throw new Error("fetch() must never be called for unknown models!");
      },
    });
  }
  await expect(tryInstantiateModel).rejects.toThrowError(
    "Unknown model: 'other.model', only these are supported: ai21,anthropic,amazon"
  );
}, 5000);

test("Test Bedrock LLM: no-region-specified", async () => {
  const model = "other.model";

  async function tryInstantiateModel() {
    // eslint-disable-next-line no-new
    new Bedrock({
      maxTokens: 20,
      model,
      async fetchFn(
        _input: RequestInfo | URL,
        _init?: RequestInit | undefined
      ): Promise<Response> {
        throw new Error("fetch() must never be called in this case!");
      },
    });
  }
  await expect(tryInstantiateModel).rejects.toThrowError(
    "Unknown model: 'other.model', only these are supported: ai21,anthropic,amazon"
  );
}, 5000);

test("Test Bedrock LLM: streaming callback handler", async () => {
  const region = "us-east-1";
  const model = "amazon.model";
  const prompt = "What is your name?";
  const answer = "Hello! My name is Claude.";

  const tokens: string[] = [];
  const callbackManager = CallbackManager.fromHandlers({
    async handleLLMNewToken(token: string) {
      tokens.push(token);
    },
  });

  const bedrock = new Bedrock({
    maxTokens: 200,
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
        `{"inputText":"${prompt}","textGenerationConfig":{"maxTokenCount":200,"temperature":0}}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        resolve({
          status: 200,
          body: {
            getReader: () => buildResponse(answer, "outputText"),
          },
        });
      });
    },
    callbackManager,
  });

  const res = await bedrock.call(prompt);
  expect(typeof res).toBe("string");
  expect(res).toBe(answer);
  expect(tokens.join("")).toBe(answer);
}, 5000);

test("Test Bedrock LLM: stream method", async () => {
  const region = "us-east-1";
  const model = "ai21.j2-grande-instruct";
  const prompt = "What is your name?";

  const bedrock = new Bedrock({
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
        `{"prompt":"${prompt}","maxTokens":20,"temperature":0}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        resolve({
          status: 200,
          body: {
            getReader: () => buildResponse("some response text", "data.text"),
          },
        });
      });
    },
  });

  const stream = await bedrock.stream(prompt);

  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThanOrEqual(1);
  console.log(chunks.join(""));
}, 5000);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setValue(object: any, path: string, value: any) {
  const objectWithValue = object;
  const [currentKey, ...restOfPath] = path.split(".");

  if (restOfPath.length === 0) {
    objectWithValue[currentKey] = value;
    return objectWithValue;
  }

  if (!Object.keys(objectWithValue).includes(currentKey)) {
    objectWithValue[currentKey] = {};
  }

  objectWithValue[currentKey] = setValue(
    objectWithValue[currentKey],
    restOfPath.join("."),
    value
  );
  return objectWithValue;
}

function buildResponse(tokens: string, keys = "outputText") {
  const body = setValue({}, keys, tokens);
  const bytes = JSON.stringify({
    bytes: Buffer.from(JSON.stringify(body)).toString("base64"),
  });
  const event = new EventStreamCodec(toUtf8, fromUtf8).encode({
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

  return mockReader;
}

test("Test Bedrock LLM: custom endpoint url", async () => {
  const region = "us-east-1";
  const model = "ai21.j2-grande-instruct";
  const prompt = "What is your name?";
  const answer = "Hello! My name is Claude.";
  const endpointUrl = "custom.endpoint.awsamazon.com";

  const bedrock = new Bedrock({
    maxTokens: 20,
    region,
    model,
    endpointUrl,
    async fetchFn(
      input: RequestInfo | URL,
      init?: RequestInit | undefined
    ): Promise<Response> {
      expect(input).toBeInstanceOf(URL);
      expect((input as URL).href).toBe(
        `https://${endpointUrl}/model/${model}/invoke-with-response-stream`
      );
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        host: endpointUrl,
        accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(init?.body).toBe(
        `{"prompt":"${prompt}","maxTokens":20,"temperature":0}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any>((resolve) => {
        resolve({
          status: 200,
          body: {
            getReader: () => buildResponse(answer, "data.text"),
          },
        });
      });
    },
  });

  const res = await bedrock.call(prompt);
  expect(typeof res).toBe("string");
  expect(res).toBe(answer);
}, 5000);
