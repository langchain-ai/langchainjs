/* oxlint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
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
const serviceUrl = "https://test.watsonx.ai";

describe("Document compressor unit tests", () => {
  describe("Positive tests", () => {
    test("Basic properties", () => {
      const testProps = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl,
        projectId: "testString",
      };
      const instance = new WatsonxRerank({ ...testProps, ...fakeAuthProp });
      testProperties(instance, testProps);
    });

    test("Extended properties", () => {
      const testProps: WatsonxInputRerank = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl,
        projectId: "testString",
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
        serviceUrl,
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow();
    });

    test("Missing other props", async () => {
      // @ts-expect-error Intentionally passing wrong value
      const testPropsProjectId: WatsonxInputRerank = {
        projectId: "testString",
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testPropsProjectId,
          })
      ).toThrow();
      // @ts-expect-error Intentionally passing wrong value
      const testPropsServiceUrl: WatsonxInputRerank = {
        serviceUrl,
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testPropsServiceUrl,
          })
      ).toThrow();
      const testPropsVersion = {
        version: "2024-05-31",
      };
      expect(
        () =>
          new WatsonxRerank({
            // @ts-expect-error Intentionally passing wrong props
            testPropsVersion,
          })
      ).toThrow();
    });

    test("Passing more than one id", async () => {
      const testProps = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl,
        projectId: "testString",
        spaceId: "testString",
      };
      expect(
        () =>
          new WatsonxRerank({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow();
    });

    test("Invalid properties are stored but not validated", () => {
      const testProps = {
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        version: "2024-05-31",
        serviceUrl,
        projectId: "testString",
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
