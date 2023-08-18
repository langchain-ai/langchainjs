import { test, expect } from "@jest/globals";
import { Bedrock } from "../bedrock.js";

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
        `https://bedrock.${region}.amazonaws.com/model/${model}/invoke`
      );
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        host: `bedrock.${region}.amazonaws.com`,
        accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(init?.body).toBe(`{"prompt":"${prompt}"}`);
      return new Promise<Response>((resolve) => {
        resolve(
          new Response(`{"completions":[{"data":{"text":"${answer}"}}]}`, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
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
        `https://bedrock.${region}.amazonaws.com/model/${model}/invoke`
      );
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        host: `bedrock.${region}.amazonaws.com`,
        accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(init?.body).toBe(
        `{"prompt":"${prompt}","max_tokens_to_sample":50}`
      );
      return new Promise<Response>((resolve) => {
        resolve(
          new Response(`{"completion":"${answer}"}`, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
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
        `https://bedrock.${region}.amazonaws.com/model/${model}/invoke`
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
      return new Promise<Response>((resolve) => {
        resolve(
          new Response(`{"results":[{"outputText":"${answer}"}]}`, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
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
