/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BedrockChat } from "../bedrock/web.js";

test("Test Bedrock identifying params", async () => {
  const region = process.env.BEDROCK_AWS_REGION!;
  const model = "anthropic.claude-v2";

  const bedrock = new BedrockChat({
    maxTokens: 20,
    region,
    model,
    maxRetries: 0,
    credentials: {
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
    },
  });

  expect(bedrock._identifyingParams()).toMatchObject({
    model,
  });
});
