/* eslint-disable dot-notation */
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import { jest } from "@jest/globals";
import { testProperties } from "../../llms/tests/ibm.test.js";
import { WatsonxEmbeddings, WatsonxInputEmbeddings } from "../ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};

const model = "ibm/slate-125m-english-rtrvr-v2";
const projectId = process.env.WATSONX_AI_PROJECT_ID || "testString";
const serviceUrl = process.env.WATSONX_AI_SERVICE_URL as string;

describe("Embeddings unit tests", () => {
  describe("Positive tests with default mode", () => {
    test("Basic properties", () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId,
      };
      const instance = new WatsonxEmbeddings({ ...testProps, ...fakeAuthProp });
      testProperties(instance, testProps);
    });

    test("Basic properties", () => {
      const testProps: WatsonxInputEmbeddings = {
        model,
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId,
        truncateInputTokens: 10,
        maxConcurrency: 2,
        maxRetries: 2,
      };
      const instance = new WatsonxEmbeddings({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });
    test("Choosing correct function to invoke embeddings", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        projectId,
      };

      const instance = new WatsonxEmbeddings({ ...testProps, ...fakeAuthProp });
      if (instance["service"]) {
        const spy = jest.spyOn(instance["service"], "embedText");
        const embedding = [1, 2, 3, 4, 5];
        spy.mockResolvedValue({
          result: {
            model_id: "",
            results: [{ embedding }],
            created_at: "",
            input_token_count: 0,
          },
          status: 200,
          statusText: "OK",
          headers: {},
        });
        const res = await instance.embedQuery("hello");
        expect(res).toBe(embedding);
        spy.mockClear();
      } else throw new Error("Service is undefined.");
    });
  });
});

describe("Positive tests with model gateway", () => {
  test("Basic properties", () => {
    const testProps = {
      model,
      version: "2024-05-31",
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      modelGateway: true,
    };
    const instance = new WatsonxEmbeddings({ ...testProps, ...fakeAuthProp });
    testProperties(instance, testProps);
    expect(instance["gateway"]).toBeInstanceOf(Gateway);
  });

  test("Extended properties", () => {
    const testProps = {
      model,
      version: "2024-05-31",
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      maxConcurrency: 2,
      maxRetries: 2,
      modelGateway: true,
      modelGatewayKwargs: {
        encodingFormat: "",
      },
    };
    const instance = new WatsonxEmbeddings({ ...testProps, ...fakeAuthProp });

    testProperties(instance, testProps);
  });

  test("Choosing correct function to invoke embeddings", async () => {
    const testProps = {
      version: "2024-05-31",
      serviceUrl,
      model,
      modelGateway: true,
    };

    const instance = new WatsonxEmbeddings({ ...testProps, ...fakeAuthProp });
    if (instance["gateway"]) {
      const spy = jest.spyOn(
        instance["gateway"].embeddings.completion,
        "create"
      );
      const embedding = [1, 2, 3, 4, 5];
      spy.mockResolvedValue({
        result: {
          data: [{ embedding, index: 0, object: "embedding" }],
          model: "",
          object: "",
        },
        status: 200,
        statusText: "OK",
        headers: {},
      });
      const res = await instance.embedQuery("hello");
      expect(res).toBe(embedding);
      spy.mockClear();
    } else throw new Error("Gateway is undefined.");
  });
});

describe("Negative tests", () => {
  test("Missing id", async () => {
    const testProps = {
      model,
      version: "2024-05-31",
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
    };
    expect(
      () =>
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        })
    ).toThrowError();
  });

  test("Missing other props", async () => {
    // @ts-expect-error Intentionally passing wrong value
    const testPropsProjectId: WatsonxInputLLM = {
      projectId,
    };
    expect(
      () =>
        new WatsonxEmbeddings({
          ...testPropsProjectId,
        })
    ).toThrowError();
    // @ts-expect-error //Intentionally passing wrong value
    const testPropsServiceUrl: WatsonxInputLLM = {
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
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
      model,
      version: "2024-05-31",
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      projectId,
      spaceId: process.env.WATSONX_AI_PROJECT_ID || "testString",
    };
    expect(
      () =>
        new WatsonxEmbeddings({
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
        // @ts-expect-error Pasing wrong props with modelGateway
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        })
    ).toThrow(
      /Expected exactly one of: projectId, spaceId, modelGateway. Got: projectId, modelGateway/
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
        // @ts-expect-error Pasing wrong props with projectid
        new WatsonxEmbeddings({
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
      truncateInputTokens: true,
    };
    expect(
      () =>
        // @ts-expect-error Pasing wrong props with modelGateway
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        })
    ).toThrow(/Unexpected properties: truncateInputTokens./);
  });

  test("Invalid properties", () => {
    const testProps = {
      model,
      version: "2024-05-31",
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
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
        new WatsonxEmbeddings({
          ...testProps,
          ...notExTestProps,
          ...fakeAuthProp,
        })
    ).toThrow(/Unexpected properties: notExisting, notExObj./);
  });
});
