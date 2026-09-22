import { describe, expect, test, vi } from "vitest";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { NodeApiClient } from "../node.js";

describe("NodeApiClient auth precedence", () => {
  test("explicit googleAuthOptions suppress the ambient GOOGLE_API_KEY", () => {
    vi.stubEnv("GOOGLE_API_KEY", "ambient-key-that-should-be-ignored");

    const client = new NodeApiClient({
      googleAuthOptions: {
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      },
    });

    // The ambient key must not leak into the client: if it did, fetch()
    // would attach it as `X-Goog-Api-Key` and override OAuth on Vertex AI.
    expect((client as unknown as { apiKey?: string }).apiKey).toBeUndefined();
    expect(getEnvironmentVariable("GOOGLE_API_KEY")).toBe(
      "ambient-key-that-should-be-ignored"
    );

    vi.unstubAllEnvs();
  });

  test("without googleAuthOptions, the ambient GOOGLE_API_KEY env fallback still applies", () => {
    vi.stubEnv("GOOGLE_API_KEY", "ambient-key");

    const client = new NodeApiClient({});

    expect((client as unknown as { apiKey?: string }).apiKey).toBe(
      "ambient-key"
    );

    vi.unstubAllEnvs();
  });
});
