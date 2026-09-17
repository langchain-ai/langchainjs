import { expect, test } from "vitest";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatGoogle } from "../node.js";

const hasApplicationDefaultCredentials = Boolean(
  getEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS") &&
  getEnvironmentVariable("GOOGLE_CLOUD_PROJECT")
);

test.skipIf(!hasApplicationDefaultCredentials)(
  "authenticates to Vertex AI with implicit application default credentials",
  async () => {
    const model = new ChatGoogle({
      model: "gemini-2.5-flash",
      platformType: "gcp",
      vertexai: true,
      location: "global",
      maxOutputTokens: 8,
    });

    const result = await model.invoke("Reply with OK.");

    expect(result.content).not.toEqual("");
  }
);
