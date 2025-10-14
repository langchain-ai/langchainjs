import { test, expect } from "@jest/globals";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatAlibabaTongyi } from "../alibaba_tongyi.js";

interface TestConfig {
  model: string | undefined;
  config: {
    description?: string;
    temperature?: number;
    topP?: number;
    repetitionPenalty?: number;
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
  model,
  config,
  system = "",
  message = "Hello!",
  shouldThrow = false,
}: TestConfig) => {
  const description = `Test ChatAlibabaTongyi ${model || "default model"} ${
    config.description || ""
  }`.trim();
  let nrNewTokens = 0;
  let streamedCompletion = "";
  const passedConfig = { ...config };
  if (passedConfig.streaming) {
    passedConfig.callbacks = [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ];
  }
  test.skip(description, async () => {
    const chat = new ChatAlibabaTongyi({
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

    // test streaming call
    const stream = await chat.stream(
      `Translate "I love programming" into Chinese.`
    );
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);

    if (passedConfig.streaming) {
      expect(nrNewTokens > 0).toBe(true);
      expect(res.text).toBe(streamedCompletion);
    }
  });
};

const testConfigs: TestConfig[] = [
  { model: undefined, config: {} },
  { model: "qwen-turbo", config: {} },
  {
    model: "qwen-turbo",
    config: { description: "with temperature", temperature: 1 },
  },
  { model: "qwen-turbo", config: { description: "with topP", topP: 1 } },
  {
    model: "qwen-turbo",
    config: { description: "with repetitionPenalty", repetitionPenalty: 1 },
  },
  {
    model: "qwen-turbo",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  {
    model: "qwen-turbo",
    config: {
      description: "illegal input should throw an error",
      temperature: 0,
    },
    shouldThrow: true,
  },
  {
    model: "qwen-turbo",
    config: {
      description: "illegal input in streaming mode should throw an error",
      streaming: true,
      temperature: 0,
    },
    shouldThrow: true,
  },
  { model: "qwen-plus", config: {} },
  {
    model: "qwen-plus",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  {
    model: "qwen-plus",
    config: {
      description: "with system message",
    },
    system: "你是一个说文言文的人",
  },
  {
    model: "qwen-turbo-max",
    config: {},
  },
];

testConfigs.forEach((testConfig) => {
  // eslint-disable-next-line no-void
  void runTest(testConfig);
});
