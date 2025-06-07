import { test, expect } from "@jest/globals";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatBaiduWenxin } from "../baiduwenxin.js";

interface TestConfig {
  model: string | undefined;
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

test.skip("Test chat.stream work fine", async () => {
  const chat = new ChatBaiduWenxin({
    model: "ERNIE-Bot",
  });
  const stream = await chat.stream(
    `Translate "I love programming" into Chinese.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(0);
});

const runTest = async ({
  model,
  config,
  system = "",
  message = "Hello!",
  shouldThrow = false,
}: TestConfig) => {
  const description = `Test ChatBaiduWenxin ${model || "default model"} ${
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
      model,
      ...config,
    });

    const messages = [];
    if (system) {
      messages.push(new SystemMessage(system));
    }
    messages.push(new HumanMessage(message));

    if (shouldThrow) {
      await expect(chat.invoke(messages)).rejects.toThrow();
      return;
    }

    const res = await chat.invoke(messages);
    // console.log({ res });

    if (config.streaming) {
      expect(nrNewTokens > 0).toBe(true);
      expect(res.text).toBe(streamedCompletion);
    }
  });
};

const testConfigs: TestConfig[] = [
  { model: undefined, config: {} },
  { model: "ERNIE-Bot", config: {} },
  {
    model: "ERNIE-Bot",
    config: { description: "with temperature", temperature: 1 },
  },
  { model: "ERNIE-Bot", config: { description: "with topP", topP: 1 } },
  {
    model: "ERNIE-Bot",
    config: { description: "with penaltyScore", penaltyScore: 1 },
  },
  {
    model: "ERNIE-Bot",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  {
    model: "ERNIE-Bot",
    config: {
      description: "illegal input should throw an error",
      temperature: 0,
    },
    shouldThrow: true,
  },
  {
    model: "ERNIE-Bot",
    config: {
      description: "illegal input in streaming mode should throw an error",
      streaming: true,
      temperature: 0,
    },
    shouldThrow: true,
  },
  { model: "ERNIE-Lite-8K", config: {} },
  {
    model: "ERNIE-Lite-8K",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  {
    model: "ERNIE-Lite-8K",
    config: {
      description: "with system message",
    },
    system: "你是一个说文言文的人",
  },
  {
    model: "ERNIE-Bot-4",
    config: {},
  },
  {
    model: "ERNIE-Speed-8K",
    config: {},
  },
  {
    model: "ERNIE-Speed-128K",
    config: {},
  },
];

testConfigs.forEach((testConfig) => {
  // eslint-disable-next-line no-void
  void runTest(testConfig);
});
