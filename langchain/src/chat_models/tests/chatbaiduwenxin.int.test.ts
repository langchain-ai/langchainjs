import { test, expect } from "@jest/globals";
import { ChatBaiduWenxin } from "../baiduwenxin.js";
import { SystemMessage, HumanMessage } from "../../schema/index.js";

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
  system?: string;
  message?: string;
  shouldThrow?: boolean;
}

const runTest = async ({
  modelName,
  config,
  system = "",
  message = "Hello!",
  shouldThrow = false,
}: TestConfig) => {
  const description = `Test ChatBaiduWenxin ${modelName || "default model"} ${
    config.description || ""
  }`.trim();
  let nrNewTokens = 0;
  let streamedCompletion = "";
  if (config.streaming) {
    // eslint-disable-next-line no-param-reassign
    config.callbacks = [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ];
  }
  test.skip(description, async () => {
    const chat = new ChatBaiduWenxin({
      modelName,
      ...config,
    });

    const messages = [];
    if (system) {
      messages.push(new SystemMessage(system));
    }
    messages.push(new HumanMessage(message));

    if (shouldThrow) {
      await expect(chat.call(messages)).rejects.toThrow();
      return;
    }

    const res = await chat.call(messages);
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
  {
    modelName: "ERNIE-Bot",
    config: {
      description: "illegal input should throw an error",
      temperature: 0,
    },
    shouldThrow: true,
  },
  {
    modelName: "ERNIE-Bot",
    config: {
      description: "illegal input in streaming mode should throw an error",
      streaming: true,
      temperature: 0,
    },
    shouldThrow: true,
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
    modelName: "ERNIE-Bot-turbo",
    config: {
      description: "with system message",
    },
    system: "你是一个说文言文的人",
  },
  {
    modelName: "ERNIE-Bot-4",
    config: {},
  },
];

testConfigs.forEach((testConfig) => {
  // eslint-disable-next-line no-void
  void runTest(testConfig);
});
