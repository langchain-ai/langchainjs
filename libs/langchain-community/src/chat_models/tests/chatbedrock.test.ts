/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BedrockChat } from "../bedrock/web.js";

test("Test Bedrock identifying params", async () => {
  const region = "us-east-1";
  const model = "anthropic.claude-v2";

  const bedrock = new BedrockChat({
    maxTokens: 20,
    region,
    model,
    maxRetries: 0,
    credentials: {
      accessKeyId: "unused",
      secretAccessKey: "unused",
      sessionToken: "unused",
    },
  });

  expect(bedrock._identifyingParams()).toMatchObject({
    model,
  });
});
