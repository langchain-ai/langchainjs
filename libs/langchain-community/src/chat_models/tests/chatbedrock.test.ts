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

describe("Test model provider detection", () => {
  const testCases = [
    {
      modelId: "eu.anthropic.claude-3-haiku-20240307-v1:0",
      expectedProvider: "anthropic",
      shouldThrow: false,
      region: "eu-west-1",
    },
    {
      modelId: "mx.anthropic.claude-3-5-sonnet-20240620-v1:0",
      expectedProvider: "anthropic",
      shouldThrow: false,
      region: "us-west-2",
    },
    {
      modelId: "apac.anthropic.claude-3-5-sonnet-20240620-v1:0",
      expectedProvider: "anthropic",
      shouldThrow: false,
      region: "ap-northeast-1",
    },
    {
      modelId: "us-gov.anthropic.claude-3-5-sonnet-20240620-v1:0",
      expectedProvider: "anthropic",
      shouldThrow: false,
      region: "us-gov-west-1",
    },
    {
      modelId: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
      expectedProvider: "anthropic",
      shouldThrow: false,
      region: "us-west-2",
    },
    {
      modelId: "meta.llama3-1-405b-instruct-v1:0",
      expectedProvider: "meta",
      shouldThrow: false,
      region: "us-west-2",
    },
    {
      modelId:
        "arn:aws:bedrock:us-east-1::custom-model/cohere.command-r-v1:0/MyCustomModel2",
      expectedProvider: "arn:aws:bedrock:us-east-1::custom-model/cohere",
      shouldThrow: true, // This is not in ALLOWED_MODEL_PROVIDERS, so it should throw
      region: "us-east-1",
    },
    {
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      expectedProvider: "anthropic",
      shouldThrow: false,
      region: "us-east-1",
    },
  ];

  test.each(testCases)(
    "should handle model $modelId with provider $provider",
    ({ modelId, expectedProvider, shouldThrow, region }) => {
      if (shouldThrow) {
        expect(() => {
          // eslint-disable-next-line no-new
          new BedrockChat({
            model: modelId,
            region,
            credentials: {
              accessKeyId: "unused",
              secretAccessKey: "unused",
              sessionToken: "unused",
            },
          });
        }).toThrow();
        return;
      }

      const bedrock = new BedrockChat({
        model: modelId,
        region,
        credentials: {
          accessKeyId: "unused",
          secretAccessKey: "unused",
          sessionToken: "unused",
        },
      });
      expect(bedrock.modelProvider).toBe(expectedProvider);
      expect(bedrock.region).toBe(region);
    }
  );
});
