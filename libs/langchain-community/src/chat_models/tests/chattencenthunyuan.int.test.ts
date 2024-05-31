import { test, expect } from "@jest/globals";
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { ChatTencentHunyuan } from "../tencent_hunyuan/index.js";

interface TestConfig {
  model: string | undefined;
  config: {
    description?: string;
    temperature?: number;
    topP?: number;
    streaming?: boolean;
    callbacks?: Array<{
      nrNewTokens?: number;
      streamedCompletion?: string;
      handleLLMNewToken?: (token: string) => Promise<void>;
    }>;
  };
  messages?: BaseMessage[];
  shouldThrow?: boolean;
}

const runTest = async ({
  model,
  config,
  messages = [new HumanMessage("Hello!")],
  shouldThrow = false,
}: TestConfig) => {
  const description = `Test ChatTencentHunyuan ${model || "default model"} ${
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
    const chat = new ChatTencentHunyuan({
      model,
      ...config,
    });

    if (shouldThrow) {
      await expect(chat.invoke(messages)).rejects.toThrow();
      return;
    }

    const res = await chat.invoke(messages);
    console.log({ res });

    if (config.streaming) {
      expect(nrNewTokens > 0).toBe(true);
      expect(res.text).toBe(streamedCompletion);
    }
  });
};

const testConfigs: TestConfig[] = [
  { model: undefined, config: {} },
  { model: "hunyuan-lite", config: {} },
  {
    model: "hunyuan-lite",
    config: { description: "with temperature", temperature: 1 },
  },
  { model: "hunyuan-lite", config: { description: "with topP", topP: 1 } },
  {
    model: "hunyuan-lite",
    config: { description: "with penaltyScore" },
  },
  {
    model: "hunyuan-lite",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    messages: [new HumanMessage("您好，请讲个长笑话")],
  },
  {
    model: "hunyuan-lite",
    config: {
      description: "illegal input should throw an error",
      temperature: 0,
    },
    shouldThrow: true,
  },
  {
    model: "hunyuan-lite",
    config: {
      description: "illegal input in streaming mode should throw an error",
      streaming: true,
      temperature: 0,
    },
    shouldThrow: true,
  },
  { model: "hunyuan-pro", config: {} },
  {
    model: "hunyuan-pro",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    messages: [new HumanMessage("您好，请讲个长笑话")],
  },
  {
    model: "hunyuan-pro",
    config: {
      description: "with system message",
    },
    messages: [
      new SystemMessage("你是一个说文言文的人"),
      new HumanMessage("Hello!"),
    ],
  },
  {
    model: "hunyuan-standard",
    config: {},
  },
  {
    model: "hunyuan-lite",
    config: {},
  },
  {
    model: "hunyuan-standard-256K",
    config: {},
  },
];

testConfigs.forEach((testConfig) => {
  // eslint-disable-next-line no-void
  void runTest(testConfig);
});
