import { test, expect } from "@jest/globals";
import { ChatBaiduWenxin } from "../baiduwenxin.js";
import { HumanMessage } from "../../schema/index.js";

interface TestConfig {
  modelName: string | undefined;
  config: {
    description?: string;
    temperature?: number;
    topP?: number;
    penaltyScore?: number;
    streaming?: boolean;
    callbacks?: Array<{
      nrNewTokens?: number;
      streamedCompletion?: string;
      handleLLMNewToken?: (token: string) => Promise<void>;
    }>;
  };
  message?: string;
}

const runTest = async ({
  modelName,
  config,
  message = "Hello!",
}: TestConfig) => {
  const description = `Test ChatBaiduWenxin ${modelName} ${config.description || ""
    }`.trim();
  let nrNewTokens = 0;
  let streamedCompletion = "";
  if (config.streaming) {
    config.callbacks = [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ];
  }
  test(description, async () => {
    const chat = new ChatBaiduWenxin({
      modelName,
      ...config,
    });
    const messageInstance = new HumanMessage(message);
    const res = await chat.call([messageInstance]);
    console.log({ res });

    if (config.streaming) {
      expect(nrNewTokens > 0).toBe(true);
      expect(res.text).toBe(streamedCompletion);
    }
  });
};

const testConfigs: TestConfig[] = [
  { modelName: undefined, config: {} },
  { modelName: "ERNIE-Bot", config: {} },
  {
    modelName: "ERNIE-Bot",
    config: { description: "with temperature", temperature: 1 },
  },
  { modelName: "ERNIE-Bot", config: { description: "with topP", topP: 1 } },
  {
    modelName: "ERNIE-Bot",
    config: { description: "with penaltyScore", penaltyScore: 1 },
  },
  {
    modelName: "ERNIE-Bot",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  { modelName: "ERNIE-Bot-turbo", config: {} },
  {
    modelName: "ERNIE-Bot-turbo",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  {
    modelName: "ERNIE-Bot-4",
    config: {},
  },
];

testConfigs.forEach((testConfig) => {
  runTest(testConfig);
});
