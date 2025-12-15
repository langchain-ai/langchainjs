/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable dot-notation */
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import { afterAll, jest } from "@jest/globals";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  transformStreamToObjectStream,
  WatsonXAI,
} from "@ibm-cloud/watsonx-ai";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { WatsonxLLM, WatsonxInputLLM, WatsonxLLMConstructor } from "../ibm.js";
import { authenticateAndSetInstance } from "../../utils/ibm.js";
import {
  WatsonxEmbeddings,
  WatsonxEmbeddingsConstructor,
} from "../../embeddings/ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};

const model = "mistralai/mistral-medium-2505";
const projectId = process.env.WATSONX_AI_PROJECT_ID || "testString";
const spaceId = process.env.WATSONX_AI_SPACE_ID || "testString";
const serviceUrl = process.env.WATSONX_AI_SERVICE_URL as string;

export function getKey<K>(key: K): K {
  return key;
}

export const testProperties = (
  instance: WatsonxLLM | WatsonxEmbeddings,
  testProps: WatsonxLLMConstructor | WatsonxEmbeddingsConstructor,
  notExTestProps?: { [key: string]: any }
) => {
  const checkProperty = <
    T extends { [key: string]: any },
    K extends { [key: string]: any }
  >(
    testProps: T,
    instance: K,
    existing = true
  ) => {
    Object.keys(testProps).forEach((key) => {
      const keys = getKey<keyof T>(key);
      type Type = Pick<T, typeof keys>;

      if (typeof testProps[key as keyof T] === "object")
        checkProperty<Type, typeof instance>(
          testProps[key as keyof T],
          instance[key],
          existing
        );
      else {
        if (existing)
          expect(instance[key as keyof K]).toBe(testProps[key as keyof T]);
        else if (instance) expect(instance[key as keyof K]).toBeUndefined();
      }
    });
  };
  checkProperty<typeof testProps, typeof instance>(testProps, instance);
  if (notExTestProps)
    checkProperty<typeof notExTestProps, typeof instance>(
      notExTestProps,
      instance,
      false
    );
};

describe("LLM unit tests", () => {
  describe("Positive tests with default mode", () => {
    test("Test authentication function", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("Test basic properties after init", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Test basic properties after init", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        idOrName: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Test methods after init", () => {
      const testProps: WatsonxInputLLM = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const instance = new WatsonxLLM({
        ...testProps,
        ...fakeAuthProp,
      });
      expect(instance.getNumTokens).toBeDefined();
      expect(instance._generate).toBeDefined();
      expect(instance._streamResponseChunks).toBeDefined();
      expect(instance.invocationParams).toBeDefined();
    });

    test("Test properties after init", async () => {
      const testProps: WatsonxInputLLM = {
        version: "2024-05-31",
        serviceUrl,
        projectId,
        model,
        maxNewTokens: 100,
        decodingMethod: "sample",
        lengthPenalty: { decay_factor: 1, start_index: 1 },
        minNewTokens: 10,
        randomSeed: 1,
        stopSequence: ["hello"],
        temperature: 0.1,
        timeLimit: 10000,
        topK: 1,
        topP: 1,
        repetitionPenalty: 1,
        truncateInputTokens: 1,
        returnOptions: {
          input_text: true,
          generated_tokens: true,
          input_tokens: true,
          token_logprobs: true,
          token_ranks: true,
          top_n_tokens: 2,
        },
        includeStopSequence: false,
        maxRetries: 3,
        maxConcurrency: 3,
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Calling correct method regarding the mode without streaming", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        temperature: 0.1,
        topP: 1,
        projectId,
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });
      if (instance["service"]) {
        const spy = jest.spyOn(instance["service"], "generateText");
        spy.mockResolvedValue({
          status: 200,
          headers: {},
          statusText: "OK",
          result: {
            model_id: model,
            created_at: "",
            results: [{ generated_text: "hello", stop_reason: "finish" }],
          },
        });
        const res = await instance.invoke("hello");
        expect(res).toBe("hello");
        spy.mockClear();
      } else throw new Error("Something wrong with instance");
    });
    test("Calling correct method regarding the mode with streaming", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        temperature: 0.1,
        topP: 1,
        projectId,
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });
      const chunk: WatsonXAI.TextGenResponse = {
        model_id: "",
        created_at: "",
        results: [{ generated_text: "hello", stop_reason: "finish" }],
      };
      if (instance["service"]) {
        const spy = jest.spyOn(instance["service"], "generateTextStream");
        const stream = [
          `id: 1\nevent: message\ndata: ${JSON.stringify(chunk)}\n\n`,
          `id: 2\nevent: message\ndata: ${JSON.stringify(chunk)}\n\n`,
        ][Symbol.iterator]();

        const transform = await transformStreamToObjectStream<
          WatsonXAI.ObjectStreamed<WatsonXAI.TextGenResponse>
        >({
          result: stream,
        });

        spy.mockResolvedValue(transform);
        const res = await instance.stream("hello");
        expect(res).toBeInstanceOf(IterableReadableStream<AIMessageChunk>);
        spy.mockClear();
      } else throw new Error("Service is not set");
    });
  });
  describe("Positive tests with model gateway", () => {
    test("Authenticate", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        modelGateway: true,
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
      expect(instance["gateway"]).toBeInstanceOf(Gateway);
    });

    test("Test properties after init", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        temperature: 0.1,
        topP: 1,
        maxRetries: 3,
        maxConcurrency: 3,
        maxTokens: 10,
        modelGateway: true,
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Test override properties with invocationParams", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        temperature: 0.1,

        topP: 1,
        modelGateway: true,
      };
      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);

      const props = instance.invocationParams({
        parameters: {
          temperature: 0.1,
          topP: 2,
        },
      });
      expect(props).toEqual({
        temperature: 0.1,
        topP: 2,
      });
    });

    test("Calling correct method in modelGateway mode", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        temperature: 0.1,
        topP: 1,
        modelGateway: true,
        streaming: false,
      };

      const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });
      if (instance["gateway"]) {
        const spy = jest.spyOn(instance["gateway"].completion, "create");

        spy.mockResolvedValue({
          status: 200,
          headers: {},
          statusText: "OK",
          result: {
            id: "",
            object: "chat.completion",
            created: 1752142071,
            model,
            choices: [
              {
                index: 0,
                text: " Hello! AI stands for",

                finish_reason: "length",
              },
            ],
            usage: {
              prompt_tokens: 9,
              completion_tokens: 5,
              total_tokens: 14,
            },
            system_fingerprint: "",
            cached: false,
          },
        });

        const res = await instance.invoke("hello");
        expect(typeof res).toBe("string");
        spy.mockClear();
      } else throw new Error("Gateway is not set");
    });
  });
  describe("Negative tests", () => {
    test("Missing id", async () => {
      const testProps: WatsonxInputLLM = {
        model,
        version: "2024-05-31",
        serviceUrl,
      };
      expect(
        () =>
          new WatsonxLLM({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(
        /Expected exactly one of: spaceId, projectId, idOrName, modelGateway./
      );
    });
    test("Missing other props", async () => {
      // @ts-expect-error Intentionally passing not enough parameters
      const testPropsProjectId: WatsonxInputLLM = {
        projectId,
      };

      expect(
        () =>
          new WatsonxLLM({
            ...testPropsProjectId,
            ...fakeAuthProp,
          })
      ).toThrowError();
      const testPropsVersion = {
        version: "2024-05-31",
      };
      expect(
        () =>
          new WatsonxLLM({
            // @ts-expect-error Intentionally passing wrong type of an object
            testPropsVersion,
          })
      ).toThrowError();
    });

    test("Passing more than one id", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
        spaceId,
      };
      expect(
        () =>
          new WatsonxLLM({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrowError();
    });
    test("Id with modelGateway", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
        modelGateway: true,
      };
      expect(
        () =>
          // @ts-expect-error Passing wrong props with modelGateway
          new WatsonxLLM({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(
        /Expected exactly one of: spaceId, projectId, idOrName, modelGateway. Got: projectId, modelGateway/
      );
    });
    test("projectId with invalid props", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
        modelGatewayKwargs: {},
      };
      expect(
        () =>
          // @ts-expect-error Passing wrong props with projectId
          new WatsonxLLM({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(/Unexpected properties: modelGatewayKwargs./);
    });
    test("modelGateway with invalid props", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        modelGateway: true,
        timeLimit: 10,
      };
      expect(
        () =>
          // @ts-expect-error Passing wrong props with modelGateway
          new WatsonxLLM({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(/Unexpected properties: timeLimit./);
    });
    test("Not existing property passed", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const notExTestProps = {
        notExisting: 12,
        notExObj: {
          notExProp: 12,
        },
      };
      expect(
        () =>
          new WatsonxLLM({
            ...testProps,
            ...notExTestProps,
            ...fakeAuthProp,
          })
      ).toThrow(/Unexpected properties: notExisting, notExObj./);
    });
  });
  describe("AbortSignal parameter passing", () => {
    const testProps = {
      model: "ibm/granite-3-8b-instruct",
      version: "2025-01-17",
      serviceUrl: "https://test.watsonx.ai",
      projectId: "test-project-id",
    };
    const instance = new WatsonxLLM({ ...testProps, ...fakeAuthProp });
    test("Signal passed to textChat() with projectId", async () => {
      const mockResponse = {
        results: [
          {
            generated_text: "",
          },
        ],
      };
      const spy = jest
        .spyOn(instance["service"], "generateText")
        .mockResolvedValue({ result: mockResponse } as any);

      const controller = new AbortController();
      await instance.invoke("test", { signal: controller.signal });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
        undefined
      );

      spy.mockRestore();
    });

    test("Signal passed to deploymentsTextChat() with idOrName", async () => {
      const mockResponse = {
        results: [
          {
            generated_text: "",
          },
        ],
      };
      const spy = jest
        .spyOn(instance["service"], "generateText")
        .mockResolvedValue({ result: mockResponse } as any);
      const controller = new AbortController();
      await instance.invoke("test", { signal: controller.signal });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
        undefined
      );

      spy.mockRestore();
    });

    test("Signal passed to textChatStream() with projectId", async () => {
      async function* mockStream() {
        yield { data: { results: [{ generated_text: "" }], model_id: "" } };
      }

      const spy = jest
        .spyOn(instance["service"], "generateTextStream")
        .mockResolvedValue(mockStream() as any);

      const controller = new AbortController();
      const stream = await instance.stream("test", {
        signal: controller.signal,
      });

      for await (const _chunk of stream) {
        /* consume stream */
      }

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
        undefined
      );

      spy.mockRestore();
    });

    test("Signal passed to deploymentsTextChatStream() with idOrName", async () => {
      async function* mockStream() {
        yield { data: { results: [{ generated_text: "" }], model_id: "" } };
      }

      const spy = jest
        .spyOn(instance["service"], "generateTextStream")
        .mockResolvedValue(mockStream() as any);

      const controller = new AbortController();
      const stream = await instance.stream("test", {
        signal: controller.signal,
      });

      for await (const _chunk of stream) {
        /* consume stream */
      }

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
        undefined
      );

      spy.mockRestore();
    });
  });
});
