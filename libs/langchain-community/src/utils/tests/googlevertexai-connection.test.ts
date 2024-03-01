import { describe, expect, it, jest } from "@jest/globals";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { GoogleVertexAILLMConnection } from "../googlevertexai-connection.js";

describe("GoogleVertexAILLMConnection", () => {
  it("should correctly build the url when useGooglePublishedModel param is not provided", async () => {
    const connection = new GoogleVertexAILLMConnection(
      {
        model: "text-bison",
      },
      new AsyncCaller({}),
      {
        request: jest.fn(),
        getProjectId: async () => "fake_project_id",
      },
      false
    );

    const streamingConnection = new GoogleVertexAILLMConnection(
      {
        model: "text-bison",
      },
      new AsyncCaller({}),
      {
        request: jest.fn(),
        getProjectId: async () => "fake_project_id",
      },
      true
    );

    const url = await connection.buildUrl();
    const streamedUrl = await streamingConnection.buildUrl();

    expect(url).toBe(
      "https://us-central1-aiplatform.googleapis.com/v1/projects/fake_project_id/locations/us-central1/publishers/google/models/text-bison:predict"
    );
    expect(streamedUrl).toBe(
      "https://us-central1-aiplatform.googleapis.com/v1/projects/fake_project_id/locations/us-central1/publishers/google/models/text-bison:serverStreamingPredict"
    );
  });

  it("should use the customModelURL when provided", async () => {
    const fakeClient = {
      request: jest.fn(),
      getProjectId: async () => "fake_project_id",
    };
    const asyncCaller = new AsyncCaller({});
    const customModelURL =
      "https://us-central1-aiplatform.googleapis.com/v1/projects/fake_project_id/locations/us-central1/endpoints/99999999";
    const connection = new GoogleVertexAILLMConnection(
      {
        customModelURL,
      },
      asyncCaller,
      fakeClient,
      false
    );

    const streamingConnection = new GoogleVertexAILLMConnection(
      {
        customModelURL,
      },
      asyncCaller,
      fakeClient,
      true
    );

    const url = await connection.buildUrl();
    const streamedUrl = await streamingConnection.buildUrl();

    expect(url).toBe(
      "https://us-central1-aiplatform.googleapis.com/v1/projects/fake_project_id/locations/us-central1/endpoints/99999999:predict"
    );
    expect(streamedUrl).toBe(
      "https://us-central1-aiplatform.googleapis.com/v1/projects/fake_project_id/locations/us-central1/endpoints/99999999:serverStreamingPredict"
    );
  });
});
