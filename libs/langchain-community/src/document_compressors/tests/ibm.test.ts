/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { WatsonxRerank, WatsonxInputRerank } from "../ibm.js";

function getKey<K>(key: K): K {
  return key;
}
const testProperties = (
  instance: WatsonxRerank,
  testProps: WatsonxInputRerank,
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
const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};
describe("Embeddings unit tests", () => {
  describe("Positive tests", () => {
    test("Basic properties", () => {
      const testProps = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const instance = new WatsonxRerank({ ...testProps, ...fakeAuthProp });
      testProperties(instance, testProps);
    });

    test("Basic properties", () => {
      const testProps: WatsonxInputRerank = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
        truncateInputTokens: 10,
        maxConcurrency: 2,
        maxRetries: 2,
        returnOptions: {
          topN: 5,
          inputs: false,
        },
      };
      const instance = new WatsonxRerank({ ...testProps, ...fakeAuthProp });
      testProperties(instance, testProps);
    });
  });

  describe("Negative tests", () => {
    test("Missing id", async () => {
      const testProps = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrowError();
    });

    test("Missing other props", async () => {
      // @ts-expect-error Intentionally passing wrong value
      const testPropsProjectId: WatsonxInputLLM = {
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testPropsProjectId,
          })
      ).toThrowError();
      // @ts-expect-error //Intentionally passing wrong value
      const testPropsServiceUrl: WatsonxInputLLM = {
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testPropsServiceUrl,
          })
      ).toThrowError();
      const testPropsVersion = {
        version: "2024-05-31",
      };
      expect(
        () =>
          new WatsonxRerank({
            // @ts-expect-error Intentionally passing wrong props
            testPropsVersion,
          })
      ).toThrowError();
    });

    test("Passing more than one id", async () => {
      const testProps = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
        spaceId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrowError();
    });

    test("Invalid properties", () => {
      const testProps = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
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
      const instance = new WatsonxRerank({
        ...testProps,
        ...notExTestProps,
        ...fakeAuthProp,
      });

      testProperties(instance, testProps, notExTestProps);
    });
  });
});
