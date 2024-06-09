import { test, expect } from "@jest/globals";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatZhipuAI } from "../zhipuai.js";

interface TestConfig {
  modelName: string | undefined;
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
  system?: string;
  message?: string;
  shouldThrow?: boolean;
}

test.skip("Test chat.stream work fine", async () => {
  const chat = new ChatZhipuAI({
    modelName: "glm-3-turbo",
  });
  const stream = await chat.stream(
    `Translate "I love programming" into Chinese.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.log(chunks);
  expect(chunks.length).toBeGreaterThan(0);
});

const runTest = async ({
  modelName,
  config,
  system = "",
  message = "Hello!",
  shouldThrow = false,
}: TestConfig) => {
  const description = `Test ChatZhipuAI ${modelName || "default model"} ${
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
    const chat = new ChatZhipuAI({
      modelName,
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

    const res = await chat.invoke(messages, passedConfig);
    console.log({ res });

    if (passedConfig.streaming) {
      expect(nrNewTokens > 0).toBe(true);
      expect(res.content).toBe(streamedCompletion);
    }
  });
};

const testConfigs: TestConfig[] = [
  { modelName: undefined, config: {} },
  { modelName: "glm-3-turbo", config: {} },
  {
    modelName: "glm-3-turbo",
    config: { description: "with temperature", temperature: 1 },
  },
  { modelName: "glm-3-turbo", config: { description: "with topP", topP: 1 } },
  {
    modelName: "glm-3-turbo",
    config: { description: "with repetitionPenalty" },
  },
  {
    modelName: "glm-3-turbo",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  {
    modelName: "glm-3-turbo",
    config: {
      description: "illegal input should throw an error",
      temperature: 0,
    },
    shouldThrow: true,
  },
  {
    modelName: "glm-3-turbo",
    config: {
      description: "illegal input in streaming mode should throw an error",
      streaming: true,
      temperature: 0,
    },
    shouldThrow: true,
  },
  { modelName: "glm-4", config: {} },
  {
    modelName: "glm-4",
    config: {
      description: "in streaming mode",
      streaming: true,
    },
    message: "您好，请讲个长笑话",
  },
  {
    modelName: "glm-4",
    config: {
      description: "with system message",
    },
    system: "你是一个说文言文的人",
  },
  {
    modelName: "glm-4",
    config: {},
  },
];

testConfigs.forEach((testConfig) => {
  void runTest(testConfig);
});
