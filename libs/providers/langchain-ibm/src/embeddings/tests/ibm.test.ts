/* oxlint-disable dot-notation */
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import { vi, expect, describe, test } from "vitest";
import { WatsonxEmbeddings, WatsonxInputEmbeddings } from "../ibm.js";
import { testProperties } from "../../llms/tests/ibm.test.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};

const model = "ibm/slate-125m-english-rtrvr-v2";
const projectId = "testString";
const serviceUrl = "https://test.watsonx.ai";

describe("Embeddings unit tests", () => {
  describe("Positive tests with default mode", () => {
    test("Basic properties", () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const instance = new WatsonxEmbeddings({ ...testProps, ...fakeAuthProp });
      testProperties(instance, testProps);
    });

    test("Extended properties", () => {
      const testProps: WatsonxInputEmbeddings = {
        model,
        version: "2024-05-31",
        serviceUrl,
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
        const spy = vi.spyOn(instance["service"], "embedText");
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
      serviceUrl,
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
      serviceUrl,
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
      const spy = vi.spyOn(instance["gateway"].embeddings.completion, "create");
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
      serviceUrl,
    };
    expect(
      () =>
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        })
    ).toThrow();
  });

  test("Missing other props", async () => {
    // @ts-expect-error Intentionally passing wrong value
    const testPropsProjectId: WatsonxInputEmbeddings = {
      projectId,
    };
    expect(
      () =>
        new WatsonxEmbeddings({
          ...testPropsProjectId,
        })
    ).toThrow();
    // @ts-expect-error Intentionally passing wrong value
    const testPropsServiceUrl: WatsonxInputEmbeddings = {
      serviceUrl,
    };
    expect(
      () =>
        new WatsonxEmbeddings({
          ...testPropsServiceUrl,
        })
    ).toThrow();
    const testPropsVersion = {
      version: "2024-05-31",
    };
    expect(
      () =>
        new WatsonxEmbeddings({
          // @ts-expect-error Intentionally passing wrong props
          testPropsVersion,
        })
    ).toThrow();
  });

  test("Passing more than one id", async () => {
    const testProps = {
      model,
      version: "2024-05-31",
      serviceUrl,
      projectId,
      spaceId: "testString",
    };
    expect(
      () =>
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        })
    ).toThrow();
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
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        }),
    ).toThrow(
      /Expected exactly one of: projectId, spaceId, modelGateway. Got: projectId, modelGateway/,
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
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        }),
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
        new WatsonxEmbeddings({
          ...testProps,
          ...fakeAuthProp,
        }),
    ).toThrow(/Unexpected properties: truncateInputTokens./);
  });

  test("Invalid properties", () => {
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
        new WatsonxEmbeddings({
          ...testProps,
          ...notExTestProps,
          ...fakeAuthProp,
        })
    ).toThrow(/Unexpected properties: notExisting, notExObj./);
  });
});
