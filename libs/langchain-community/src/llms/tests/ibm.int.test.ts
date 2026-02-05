import { CallbackManager } from "@langchain/core/callbacks/manager";
import { LLMResult } from "@langchain/core/outputs";
import { StringPromptValue } from "@langchain/core/prompt_values";
import { TokenUsage } from "../../types/ibm.js";
import { WatsonxLLM, WatsonxInputLLM } from "../ibm.js";

const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;
const model = "ibm/granite-3-8b-instruct";
const modelAlias = "ibm/granite-3-8b-instruct";
const projectId = process.env.WATSONX_AI_PROJECT_ID;
const version = "2024-05-31";
const serviceUrl = process.env.WATSONX_AI_SERVICE_URL as string;
const serviceUrlGateway = process.env.WATSONX_AI_GATEWAY_URL as string;

const parameters = [
  {
    name: "projectId",
    params: (token = 5) => ({
      projectId,
      model,
      maxNewTokens: token,
      serviceUrl,
    }),
  },
  {
    name: "Model Gateway",
    params: (token = 5) => ({
      modelGateway: true,
      model: modelAlias,
      maxTokens: token,
      serviceUrl: serviceUrlGateway,
    }),
  },
];
describe.each(parameters)("Text generation for $name", ({ params }) => {
  const basicParams = params();
  describe("Test invoke method", () => {
    test("Correct value", async () => {
      const watsonXInstance = new WatsonxLLM({
        version,

        ...basicParams,
      });
      await watsonXInstance.invoke("Hello world?");
    });

    test("Overwritte params", async () => {
      const props = params(512);
      const watsonXInstance = new WatsonxLLM({
        version,

        ...props,
      });
      const res = await watsonXInstance.invoke("Hello world?", {
        parameters:
          "modelGateway" in props ? { maxTokens: 10 } : { maxNewTokens: 10 },
      });

      expect(res.length).toBeLessThan(100);
    });

    test("Invalid credentials", async () => {
      const watsonXInstance = new WatsonxLLM({
        version,

        watsonxAIAuthType: "iam",
        watsonxAIApikey: "WrongApiKey",
        watsonxAIUrl: "https://wrong.wrong/",
        ...basicParams,
      });
      await expect(watsonXInstance.invoke("Hello world?")).rejects.toThrow();
    });

    test("Wrong value", async () => {
      const watsonXInstance = new WatsonxLLM({
        version,

        ...basicParams,
      });
      // @ts-expect-error Intentionally passing wrong value
      await watsonXInstance.invoke({});
    });

    test("Stop", async () => {
      const watsonXInstance = new WatsonxLLM({
        version,

        ...basicParams,
      });
      await watsonXInstance.invoke("Hello, how are you?", {
        stop: ["Hello"],
      });
    }, 10000);

    test("Stop with timeout", async () => {
      const watsonXInstance = new WatsonxLLM({
        version,
        ...basicParams,
      });

      await expect(() =>
        watsonXInstance.invoke("Print hello world", { timeout: 10 })
      ).rejects.toThrow("Aborted");
    }, 10000);

    test("Signal in call options", async () => {
      const watsonXInstance = new WatsonxLLM({
        version,

        maxRetries: 3,
        ...basicParams,
      });
      const controllerNoAbortion = new AbortController();
      await expect(
        watsonXInstance.invoke("Print hello world", {
          signal: controllerNoAbortion.signal,
        })
      ).resolves.toBeDefined();

      const controllerToAbort = new AbortController();
      await expect(async () => {
        const ret = watsonXInstance.invoke("Print hello world", {
          signal: controllerToAbort.signal,
        });
        controllerToAbort.abort();
        return ret;
      }).rejects.toThrow("canceled");
    }, 20000);

    test("Concurenccy", async () => {
      const llm = new WatsonxLLM({
        maxConcurrency: 1,
        version,

        ...basicParams,
      });
      const res = await Promise.all([
        llm.invoke("Print hello world"),
        llm.invoke("Print hello world"),
      ]);

      expect(res).toHaveLength(2);
      expect(res).toEqual([expect.any(String), expect.any(String)]);
    });

    test("Token usage", async () => {
      process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";
      try {
        const tokenUsage: TokenUsage = {
          generated_token_count: 0,
          input_token_count: 0,
        };
        const llm = new WatsonxLLM({
          version,
          maxConcurrency: 1,

          ...params(1),
          callbacks: CallbackManager.fromHandlers({
            async handleLLMEnd(output: LLMResult) {
              const singleTokenUsage: TokenUsage | undefined =
                output.llmOutput?.tokenUsage;
              if (singleTokenUsage) {
                tokenUsage.generated_token_count +=
                  singleTokenUsage.generated_token_count;
                tokenUsage.input_token_count +=
                  singleTokenUsage.input_token_count;
              }
            },
          }),
        });
        await llm.invoke("Hello");
        expect(tokenUsage.generated_token_count).toBe(1);
        expect(tokenUsage.input_token_count).toBeLessThanOrEqual(2);
      } finally {
        process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
      }
    });

    test("Streaming mode", async () => {
      let countedTokens = 0;
      let streamedText = "";
      let usedTokens = 0;
      const llm = new WatsonxLLM({
        version,

        streaming: true,
        ...basicParams,
        callbacks: CallbackManager.fromHandlers({
          async handleLLMEnd(output) {
            usedTokens = output.llmOutput?.tokenUsage.generated_token_count;
          },
          async handleLLMNewToken(token: string) {
            countedTokens += 1;
            streamedText += token;
          },
        }),
      });

      const res = await llm.invoke("Print hello world?");
      expect(countedTokens).toBe(usedTokens);
      expect(res).toBe(streamedText);
    });
  });

  describe("Test generate methods", () => {
    test("Basic usage", async () => {
      const llm = new WatsonxLLM({
        version,

        ...basicParams,
      });
      const res = await llm.generate([
        "Print hello world!",
        "Print hello universe!",
      ]);
      expect(res.generations.length).toBe(2);
    });

    test("Stop", async () => {
      const llm = new WatsonxLLM({
        version,

        ...params(100),
        temperature: 0,
      });

      const res = await llm.generate(
        [
          "Print hello world in JavaScript!!",
          "Print hello world twice in Python!",
        ],
        {
          stop: ["hello"],
        }
      );
      expect(
        res.generations
          .map((generation) => generation.map((item) => item.text))
          .join("")
          .indexOf("world")
      ).toBe(-1);
    });

    test("Streaming mode with multiple prompts", async () => {
      const nrNewTokens = [0, 0, 0];
      const completions = ["", "", ""];
      const llm = new WatsonxLLM({
        version,

        ...basicParams,
        streaming: true,
        callbacks: CallbackManager.fromHandlers({
          async handleLLMNewToken(token: string, idx) {
            nrNewTokens[idx.prompt] += 1;
            completions[idx.prompt] += token;
          },
        }),
      });
      const res = await llm.generate([
        "Print bye bye world!",
        "Print bye bye world!",
        "Print Hello IBM!",
      ]);
      res.generations.forEach((generation, index) => {
        generation.forEach((g) => {
          expect(g.generationInfo?.generated_token_count).toBe(
            nrNewTokens[index]
          );
        });
      });
      nrNewTokens.forEach((tokens) => expect(tokens > 0).toBe(true));
      expect(res.generations.length).toBe(3);
    });

    test("Prompt value", async () => {
      const llm = new WatsonxLLM({
        version,

        ...basicParams,
      });
      const res = await llm.generatePrompt([
        new StringPromptValue("Print hello world!"),
      ]);
      for (const generation of res.generations) {
        expect(generation.length).toBe(1);
      }
    });
  });

  describe("Test stream method", () => {
    test("Basic usage", async () => {
      let countedTokens = 0;
      let streamedText = "";
      const llm = new WatsonxLLM({
        version,

        ...params(100),
        callbacks: CallbackManager.fromHandlers({
          async handleLLMNewToken(token: string) {
            countedTokens += 1;
            streamedText += token;
          },
        }),
      });
      const stream = await llm.stream("Print hello world.");
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("")).toBe(streamedText);
    });

    test("Stop", async () => {
      const llm = new WatsonxLLM({
        version,

        ...params(100),
      });

      const stream = await llm.stream("Print hello world in JavaScript!", {
        stop: ["hello"],
      });
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks.join("").indexOf("world")).toBe(-1);
    });

    test("Timeout", async () => {
      const llm = new WatsonxLLM({
        version,

        ...params(1000),
      });
      await expect(async () => {
        const stream = await llm.stream(
          "How is your day going? Be precise and tell me a lot about it/",
          {
            signal: AbortSignal.timeout(750),
          }
        );
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      }).rejects.toThrowError();
    });

    test("Signal in call options", async () => {
      const llm = new WatsonxLLM({
        version,

        ...params(10),
      });
      const controller = new AbortController();
      const stream = await llm.stream(
        "How is your day going? Be precise and tell me a lot about it",
        {
          signal: controller.signal,
        }
      );
      const chunks = [];
      let i = 0;
      await expect(async () => {
        for await (const chunk of stream) {
          i += 1;
          chunks.push(chunk);
          if (i === 5) {
            controller.abort();
          }
        }
      }).rejects.toThrow();
    });
  });

  describe("Test getNumToken method", () => {
    test("Passing correct value", async () => {
      const testProps: WatsonxInputLLM = {
        version,

        ...basicParams,
      };
      const instance = new WatsonxLLM({
        ...testProps,
      });

      if ("modelGateway" in basicParams) {
        await expect(instance.getNumTokens("Hello")).rejects.toThrow(
          /This method is not supported in model gateway/
        );
      } else {
        await expect(
          instance.getNumTokens("Hello")
        ).resolves.toBeGreaterThanOrEqual(0);
        await expect(
          instance.getNumTokens("Hello", { return_tokens: true })
        ).resolves.toBeGreaterThanOrEqual(0);
      }
    });

    test("Passing wrong value", async () => {
      const instance = new WatsonxLLM({
        version,

        ...basicParams,
      });

      // @ts-expect-error Intentionally passing wrong parameter
      await expect(instance.getNumTokens(12)).rejects.toThrowError();
      await expect(
        // @ts-expect-error Intentionally passing wrong parameter
        instance.getNumTokens(12, { wrong: "Wrong" })
      ).rejects.toThrowError();
    });
  });
});

describe("Test watsonx callbacks", () => {
  test("Single request callback", async () => {
    let callbackFlag = false;
    const service = new WatsonxLLM({
      model,
      version,
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
      projectId,
      watsonxCallbacks: {
        requestCallback(req) {
          callbackFlag = !!req;
        },
      },
    });
    const hello = await service.stream("Print hello world");
    const chunks = [];
    for await (const chunk of hello) {
      chunks.push(chunk);
    }
    expect(callbackFlag).toBe(true);
  });
  test("Single response callback", async () => {
    let callbackFlag = false;
    const service = new WatsonxLLM({
      model,
      version,
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
      projectId,
      maxNewTokens: 10,
      watsonxCallbacks: {
        responseCallback(res) {
          callbackFlag = !!res;
        },
      },
    });
    const hello = await service.stream("Print hello world");
    const chunks = [];
    for await (const chunk of hello) {
      chunks.push(chunk);
    }
    expect(callbackFlag).toBe(true);
  });
  test("Both callbacks", async () => {
    let callbackFlagReq = false;
    let callbackFlagRes = false;
    const service = new WatsonxLLM({
      model,
      version,
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
      projectId,
      maxNewTokens: 10,
      watsonxCallbacks: {
        requestCallback(req) {
          callbackFlagReq = !!req;
        },
        responseCallback(res) {
          callbackFlagRes = !!res;
        },
      },
    });
    const hello = await service.stream("Print hello world");
    const chunks = [];
    for await (const chunk of hello) {
      chunks.push(chunk);
    }
    expect(callbackFlagReq).toBe(true);
    expect(callbackFlagRes).toBe(true);
  });
  test("Multiple callbacks", async () => {
    let callbackFlagReq = false;
    let callbackFlagRes = false;
    let langchainCallback = false;

    const service = new WatsonxLLM({
      model,
      version,
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
      projectId,
      maxNewTokens: 10,
      watsonxCallbacks: {
        requestCallback(req) {
          callbackFlagReq = !!req;
        },
        responseCallback(res) {
          callbackFlagRes = !!res;
        },
      },
      callbacks: CallbackManager.fromHandlers({
        async handleLLMEnd(output) {
          expect(output.generations).toBeDefined();
          langchainCallback = !!output;
        },
      }),
    });
    const hello = await service.stream("Print hello world");
    const chunks = [];
    for await (const chunk of hello) {
      chunks.push(chunk);
    }
    expect(callbackFlagReq).toBe(true);
    expect(callbackFlagRes).toBe(true);
    expect(langchainCallback).toBe(true);
  });
});
