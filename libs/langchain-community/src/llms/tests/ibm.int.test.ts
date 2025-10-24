/* eslint-disable no-process-env */
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { LLMResult } from "@langchain/core/outputs";
import { StringPromptValue } from "@langchain/core/prompt_values";
import { TokenUsage } from "../../types/ibm.js";
import { WatsonxLLM, WatsonxInputLLM } from "../ibm.js";

const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

describe("Text generation", () => {
  describe("Test invoke method", () => {
    test("Correct value", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
      });
      await watsonXInstance.invoke("Hello world?");
    });

    test("Overwritte params", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
      });
      await watsonXInstance.invoke("Hello world?", {
        parameters: { maxNewTokens: 10 },
      });
    });

    test("Invalid projectId", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: "Test wrong value",
      });
      await expect(watsonXInstance.invoke("Hello world?")).rejects.toThrow();
    });

    test("Invalid credentials", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: "Test wrong value",
        watsonxAIAuthType: "iam",
        watsonxAIApikey: "WrongApiKey",
        watsonxAIUrl: "https://wrong.wrong/",
      });
      await expect(watsonXInstance.invoke("Hello world?")).rejects.toThrow();
    });

    test("Wrong value", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
      });
      // @ts-expect-error Intentionally passing wrong value
      await watsonXInstance.invoke({});
    });

    test("Stop", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
      });
      await watsonXInstance.invoke("Hello, how are you?", {
        stop: ["Hello"],
      });
    }, 5000);

    test("Stop with timeout", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: "sdadasdas" as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 5,
        maxRetries: 3,
      });

      await expect(() =>
        watsonXInstance.invoke("Print hello world", { timeout: 10 })
      ).rejects.toThrowError("AbortError");
    }, 5000);

    test("Signal in call options", async () => {
      const watsonXInstance = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 5,
        maxRetries: 3,
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
      }).rejects.toThrowError("AbortError");
    }, 5000);

    test("Concurenccy", async () => {
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        maxConcurrency: 1,
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
      });
      await Promise.all([
        model.invoke("Print hello world"),
        model.invoke("Print hello world"),
      ]);
    });

    test("Token usage", async () => {
      process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";
      try {
        const tokenUsage: TokenUsage = {
          generated_token_count: 0,
          input_token_count: 0,
        };
        const model = new WatsonxLLM({
          model: "ibm/granite-3-8b-instruct",
          version: "2024-05-31",
          maxNewTokens: 1,
          maxConcurrency: 1,
          serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
          projectId: process.env.WATSONX_AI_PROJECT_ID,
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
        await model.invoke("Hello");
        expect(tokenUsage.generated_token_count).toBe(1);
        expect(tokenUsage.input_token_count).toBe(1);
      } finally {
        process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
      }
    });

    test("Streaming mode", async () => {
      let countedTokens = 0;
      let streamedText = "";
      let usedTokens = 0;
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 5,
        streaming: true,

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

      const res = await model.invoke("Print hello world?");
      expect(countedTokens).toBe(usedTokens);
      expect(res).toBe(streamedText);
    });
  });

  describe("Test generate methods", () => {
    test("Basic usage", async () => {
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 5,
      });
      const res = await model.generate([
        "Print hello world!",
        "Print hello universe!",
      ]);
      expect(res.generations.length).toBe(2);
    });

    test("Stop", async () => {
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 100,
      });

      const res = await model.generate(
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
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 5,
        streaming: true,
        callbacks: CallbackManager.fromHandlers({
          async handleLLMNewToken(token: string, idx) {
            nrNewTokens[idx.prompt] += 1;
            completions[idx.prompt] += token;
          },
        }),
      });
      const res = await model.generate([
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
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 5,
      });
      const res = await model.generatePrompt([
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
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 100,
        callbacks: CallbackManager.fromHandlers({
          async handleLLMNewToken(token: string) {
            countedTokens += 1;
            streamedText += token;
          },
        }),
      });
      const stream = await model.stream("Print hello world.");
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("")).toBe(streamedText);
    });

    test("Stop", async () => {
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 100,
      });

      const stream = await model.stream("Print hello world in JavaScript!", {
        stop: ["hello"],
      });
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks.join("").indexOf("world")).toBe(-1);
    });

    test("Timeout", async () => {
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 1000,
      });
      await expect(async () => {
        const stream = await model.stream(
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
      const model = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxNewTokens: 1000,
      });
      const controller = new AbortController();
      await expect(async () => {
        const stream = await model.stream(
          "How is your day going? Be precise and tell me a lot about it",
          {
            signal: controller.signal,
          }
        );
        const chunks = [];
        let i = 0;
        for await (const chunk of stream) {
          i += 1;
          chunks.push(chunk);
          if (i === 5) {
            controller.abort();
          }
        }
      }).rejects.toThrowError();
    });
  });

  describe("Test getNumToken method", () => {
    test("Passing correct value", async () => {
      const testProps: WatsonxInputLLM = {
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
      };
      const instance = new WatsonxLLM({
        ...testProps,
      });
      await expect(
        instance.getNumTokens("Hello")
      ).resolves.toBeGreaterThanOrEqual(0);
      await expect(
        instance.getNumTokens("Hello", { return_tokens: true })
      ).resolves.toBeGreaterThanOrEqual(0);
    });

    test("Passing wrong value", async () => {
      const testProps: WatsonxInputLLM = {
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        maxRetries: 3,
      };
      const instance = new WatsonxLLM({
        ...testProps,
      });

      // @ts-expect-error Intentionally passing wrong parameter
      await expect(instance.getNumTokens(12)).rejects.toThrowError();
      await expect(
        // @ts-expect-error Intentionally passing wrong parameter
        instance.getNumTokens(12, { wrong: "Wrong" })
      ).rejects.toThrowError();
    });
  });

  describe("Test watsonx callbacks", () => {
    test("Single request callback", async () => {
      let callbackFlag = false;
      const service = new WatsonxLLM({
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
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
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
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
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
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
        model: "ibm/granite-3-8b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
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
});
