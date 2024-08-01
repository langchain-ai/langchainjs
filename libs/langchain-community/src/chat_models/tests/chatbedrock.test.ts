/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BedrockChat } from "../bedrock/web.js";

test("Test Bedrock identifying params", async () => {
  const region = "us-west-2";
  const model = "anthropic.claude-3-sonnet-20240229-v1:0";

  const bedrock = new BedrockChat({
    maxTokens: 20,
    region,
    model,
    maxRetries: 0,
    trace: "ENABLED",
    guardrailIdentifier: "define",
    guardrailVersion: "DRAFT",
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
