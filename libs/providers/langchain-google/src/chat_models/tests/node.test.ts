import { beforeEach, describe, expect, test, vi } from "vitest";
import { VERTEX_AI_AUTH_SCOPES } from "../../const.js";

const googleAuthConstructorOptions = vi.hoisted(
  () => [] as Array<Record<string, unknown> | undefined>
);

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    constructor(options?: Record<string, unknown>) {
      googleAuthConstructorOptions.push(options);
    }
  },
}));

import { ChatGoogle } from "../node.js";

describe("ChatGoogle Node authentication", () => {
  beforeEach(() => {
    googleAuthConstructorOptions.length = 0;
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("GOOGLE_CLOUD_CREDENTIALS", "");
    vi.stubEnv("LANGSMITH_API_KEY", "");
  });

  test("configures Vertex scopes for implicit ADC", () => {
    new ChatGoogle({
      model: "gemini-2.5-flash",
      platformType: "gcp",
      vertexai: true,
    });

    expect(googleAuthConstructorOptions).toEqual([
      { scopes: VERTEX_AI_AUTH_SCOPES },
    ]);
  });

  test("does not initialize ADC when an API key is configured", () => {
    new ChatGoogle({
      model: "gemini-2.5-flash",
      apiKey: "test-api-key",
    });

    expect(googleAuthConstructorOptions).toEqual([]);
  });
});
