/* eslint-disable no-process-env */
import { WatsonxEmbeddings } from "../embeddings.js";
import { testProperties } from "./utilis.js";

describe("Embeddings unit tests", () => {
  describe("Positive tests", () => {
    test("Basic properties", () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl: process.env.API_URL as string,
        projectId: process.env.PROJECT_ID,
      };
      const instance = new WatsonxEmbeddings(testProps);
      testProperties(instance, testProps);
    });

    test("Basic properties", () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl: process.env.API_URL as string,
        projectId: process.env.PROJECT_ID,
        truncate_input_tokens: 10,
        maxConcurrency: 2,
        maxRetries: 2,
        modelId: "ibm/slate-125m-english-rtrvr",
      };
      const instance = new WatsonxEmbeddings(testProps);

      testProperties(instance, testProps);
    });
  });

  describe("Negative tests", () => {
    test("Missing id", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl: process.env.API_URL as string,
      };
      expect(
        () =>
          new WatsonxEmbeddings({
            ...testProps,
          })
      ).toThrowError();
    });

    test("Missing other props", async () => {
      // @ts-expect-error Intentionally passing wrong value
      const testPropsProjectId: WatsonxInputLLM = {
        projectId: process.env.PROJECT_ID,
      };
      expect(
        () =>
          new WatsonxEmbeddings({
            ...testPropsProjectId,
          })
      ).toThrowError();
      // @ts-expect-error //Intentionally passing wrong value
      const testPropsServiceUrl: WatsonxInputLLM = {
        serviceUrl: process.env.API_URL as string,
      };
      expect(
        () =>
          new WatsonxEmbeddings({
            ...testPropsServiceUrl,
          })
      ).toThrowError();
      const testPropsVersion = {
        version: "2024-05-31",
      };
      expect(
        () =>
          new WatsonxEmbeddings({
            // @ts-expect-error Intentionally passing wrong props
            testPropsVersion,
          })
      ).toThrowError();
    });

    test("Passing more than one id", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl: process.env.API_URL as string,
        projectId: process.env.PROJECT_ID,
        spaceId: process.env.PROJECT_ID,
      };
      expect(
        () =>
          new WatsonxEmbeddings({
            ...testProps,
          })
      ).toThrowError();
    });

    test("Invalid properties", () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl: process.env.API_URL as string,
        projectId: process.env.PROJECT_ID,
      };
      const notExTestProps = {
        notExisting: 12,
        notExObj: {
          notExProp: 12,
        },
      };
      const instance = new WatsonxEmbeddings({
        ...testProps,
        ...notExTestProps,
      });

      testProperties(instance, testProps, notExTestProps);
    });
  });
});
