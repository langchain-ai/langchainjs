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

test("Test Bedrock serialization", async () => {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  const bedrock = new BedrockChat({
    region: "us-west-2",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    credentials: {
      accessKeyId: "unused",
      secretAccessKey: "unused",
      sessionToken: "unused",
    },
  });

  expect(JSON.stringify(bedrock)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","bedrock","BedrockChat"],"kwargs":{"region_name":"us-west-2","model_id":"anthropic.claude-3-sonnet-20240229-v1:0","credentials":{"accessKeyId":{"lc":1,"type":"secret","id":["AWS_ACCESS_KEY_ID"]},"secretAccessKey":{"lc":1,"type":"secret","id":["AWS_SECRET_ACCESS_KEY"]},"sessionToken":{"lc":1,"type":"secret","id":["AWS_SECRET_ACCESS_KEY"]}}}}`
  );
});

test("Test Bedrock serialization from environment variables", async () => {
  process.env.AWS_ACCESS_KEY_ID = "foo";
  process.env.AWS_SECRET_ACCESS_KEY = "bar";
  const bedrock = new BedrockChat({
    region: "us-west-2",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
  });

  expect(JSON.stringify(bedrock)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","bedrock","BedrockChat"],"kwargs":{"region_name":"us-west-2","model_id":"anthropic.claude-3-sonnet-20240229-v1:0","aws_access_key_id":{"lc":1,"type":"secret","id":["AWS_ACCESS_KEY_ID"]},"aws_secret_access_key":{"lc":1,"type":"secret","id":["AWS_SECRET_ACCESS_KEY"]},"credentials":{"accessKeyId":{"lc":1,"type":"secret","id":["AWS_ACCESS_KEY_ID"]},"secretAccessKey":{"lc":1,"type":"secret","id":["AWS_SECRET_ACCESS_KEY"]}}}}`
  );
});
