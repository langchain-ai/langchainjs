/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import WatsonxAiMlVml_v1 from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { ChatWatsonx, ChatWatsonxInput, WatsonxCallParams } from "../ibm.js";
import { authenticateAndSetInstance } from "../../utils/ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};
export function getKey<K>(key: K): K {
  return key;
}
export const testProperties = (
  instance: ChatWatsonx,
  testProps: ChatWatsonxInput,
  notExTestProps?: { [key: string]: any }
) => {
  const checkProperty = <T extends { [key: string]: any }>(
    testProps: T,
    instance: T,
    existing = true
  ) => {
    Object.keys(testProps).forEach((key) => {
      const keys = getKey<keyof T>(key);
      type Type = Pick<T, typeof keys>;

      if (typeof testProps[key as keyof T] === "object")
        checkProperty<Type>(testProps[key as keyof T], instance[key], existing);
      else {
        if (existing)
          expect(instance[key as keyof T]).toBe(testProps[key as keyof T]);
        else if (instance) expect(instance[key as keyof T]).toBeUndefined();
      }
    });
  };
  checkProperty<typeof testProps>(testProps, instance);
  if (notExTestProps)
    checkProperty<typeof notExTestProps>(notExTestProps, instance, false);
};

describe("LLM unit tests", () => {
  describe("Positive tests", () => {
    test("Test authentication function", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(WatsonxAiMlVml_v1);
    });

    test("Test basic properties after init", async () => {
      const testProps = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Test methods after init", () => {
      const testProps: ChatWatsonxInput = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const instance = new ChatWatsonx({
        ...testProps,
        ...fakeAuthProp,
      });
      expect(instance.getNumTokens).toBeDefined();
      expect(instance._generate).toBeDefined();
      expect(instance._streamResponseChunks).toBeDefined();
      expect(instance.invocationParams).toBeDefined();
    });

    test("Test properties after init", async () => {
      const testProps: WatsonxCallParams & ChatWatsonxInput = {
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
        model: "ibm/granite-13b-chat-v2",
        maxTokens: 100,
        temperature: 0.1,
        timeLimit: 10000,
        topP: 1,
        maxRetries: 3,
        maxConcurrency: 3,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });
  });

  describe("Negative tests", () => {
    test("Missing id", async () => {
      const testProps: ChatWatsonxInput = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      };
      expect(
        () =>
          new ChatWatsonx({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrowError();
    });

    test("Missing other props", async () => {
      // @ts-expect-error Intentionally passing not enough parameters
      const testPropsProjectId: ChatWatsonxInput = {
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };

      expect(
        () =>
          new ChatWatsonx({
            ...testPropsProjectId,
            ...fakeAuthProp,
          })
      ).toThrowError();
      // @ts-expect-error Intentionally passing not enough parameters
      const testPropsServiceUrl: ChatWatsonxInput = {
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      };
      expect(
        () =>
          new ChatWatsonx({
            ...testPropsServiceUrl,
            ...fakeAuthProp,
          })
      ).toThrowError();
      const testPropsVersion = {
        version: "2024-05-31",
      };
      expect(
        () =>
          new ChatWatsonx({
            // @ts-expect-error Intentionally passing wrong type of an object
            testPropsVersion,
          })
      ).toThrowError();
    });

    test("Passing more than one id", async () => {
      const testProps: ChatWatsonxInput = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
        spaceId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      expect(
        () =>
          new ChatWatsonx({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrowError();
    });

    test("Not existing property passed", async () => {
      const testProps = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const notExTestProps = {
        notExisting: 12,
        notExObj: {
          notExProp: 12,
        },
      };
      const instance = new ChatWatsonx({
        ...testProps,
        ...notExTestProps,
        ...fakeAuthProp,
      });
      testProperties(instance, testProps, notExTestProps);
    });
  });
});
