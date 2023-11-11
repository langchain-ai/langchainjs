import { protos } from "@google-ai/generativelanguage";
import { expect, test } from "@jest/globals";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "../../schema/index.js";
import { ChatGooglePaLM } from "../googlepalm.js";

// Test class extending actual class to test private & protected methods
class ChatGooglePaLMTest extends ChatGooglePaLM {
  public _getPalmContextInstruction(messages: BaseMessage[]) {
    return super._getPalmContextInstruction(messages);
  }

  public _mapBaseMessagesToPalmMessages(messages: BaseMessage[]) {
    return super._mapBaseMessagesToPalmMessages(messages);
  }

  public _mapPalmMessagesToChatResult(
    msgRes: protos.google.ai.generativelanguage.v1beta2.IGenerateMessageResponse
  ) {
    return super._mapPalmMessagesToChatResult(msgRes);
  }
}

test("Google Palm Chat - `temperature` must be in range [0.0,1.0]", async () => {
  expect(
    () =>
      new ChatGooglePaLMTest({
        temperature: -1.0,
      })
  ).toThrow();
  expect(
    () =>
      new ChatGooglePaLMTest({
        temperature: 1.1,
      })
  ).toThrow();
});

test("Google Palm Chat - `topP` must be positive", async () => {
  expect(
    () =>
      new ChatGooglePaLMTest({
        topP: -1,
      })
  ).toThrow();
});

test("Google Palm Chat - `topK` must be positive", async () => {
  expect(
    () =>
      new ChatGooglePaLMTest({
        topK: -1,
      })
  ).toThrow();
});

test("Google Palm Chat - gets the Palm prompt context from 'system' messages", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("system-1"),
    new AIMessage("ai-1"),
    new HumanMessage("human-1"),
    new SystemMessage("system-2"),
  ];
  const model = new ChatGooglePaLMTest({
    apiKey: "GOOGLE_PALM_API_KEY",
  });

  const context = model._getPalmContextInstruction(messages);
  expect(context).toBe("system-1");
});

test("Google Palm Chat - maps `BaseMessage` to Palm message", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("system-1"),
    new AIMessage("ai-1"),
    new HumanMessage("human-1"),
    new AIMessage({
      content: "ai-2",
      name: "droid",
      additional_kwargs: {
        citationSources: [
          {
            startIndex: 0,
            endIndex: 5,
            uri: "https://example.com",
            license: "MIT",
          },
        ],
      },
    }),
    new HumanMessage({
      content: "human-2",
      name: "skywalker",
    }),
  ];
  const model = new ChatGooglePaLMTest({
    apiKey: "GOOGLE_PALM_API_KEY",
  });

  const palmMessages = model._mapBaseMessagesToPalmMessages(messages);
  expect(palmMessages.length).toEqual(4);
  expect(palmMessages[0]).toEqual({
    author: "ai",
    content: "ai-1",
    citationMetadata: {
      citationSources: undefined,
    },
  });
  expect(palmMessages[1]).toEqual({
    author: "human",
    content: "human-1",
    citationMetadata: {
      citationSources: undefined,
    },
  });
  expect(palmMessages[2]).toEqual({
    author: "droid",
    content: "ai-2",
    citationMetadata: {
      citationSources: [
        {
          startIndex: 0,
          endIndex: 5,
          uri: "https://example.com",
          license: "MIT",
        },
      ],
    },
  });
  expect(palmMessages[3]).toEqual({
    author: "skywalker",
    content: "human-2",
    citationMetadata: {
      citationSources: undefined,
    },
  });
});

test("Google Palm Chat - removes 'system' messages while mapping `BaseMessage` to Palm message", async () => {
  const messages: BaseMessage[] = [
    new SystemMessage("system-1"),
    new AIMessage("ai-1"),
    new HumanMessage("human-1"),
    new SystemMessage("system-2"),
  ];
  const model = new ChatGooglePaLMTest({
    apiKey: "GOOGLE_PALM_API_KEY",
  });

  const palmMessages = model._mapBaseMessagesToPalmMessages(messages);
  expect(palmMessages.length).toEqual(2);
  expect(palmMessages[0].content).toEqual("ai-1");
  expect(palmMessages[1].content).toEqual("human-1");
});

test("Google Palm Chat - throws error for consecutive 'ai'/'human' messages while mapping `BaseMessage` to Palm message", async () => {
  const messages: BaseMessage[] = [
    new AIMessage("ai-1"),
    new HumanMessage("human-1"),
    new AIMessage("ai-2"),
    new HumanMessage("human-2"),
    new HumanMessage("human-3"),
  ];
  const model = new ChatGooglePaLMTest({
    apiKey: "GOOGLE_PALM_API_KEY",
  });

  expect(() => model._mapBaseMessagesToPalmMessages(messages)).toThrow();
});

test("Google Palm Chat - maps Palm generated message to `AIMessage` chat result", async () => {
  const generations: protos.google.ai.generativelanguage.v1beta2.IGenerateMessageResponse =
    {
      candidates: [
        {
          author: "droid",
          content: "ai-1",
          citationMetadata: {
            citationSources: [
              {
                startIndex: 0,
                endIndex: 5,
                uri: "https://example.com",
                license: "MIT",
              },
            ],
          },
        },
      ],
      filters: [
        {
          message: "potential problem",
          reason: "SAFETY",
        },
      ],
    };
  const model = new ChatGooglePaLMTest({
    apiKey: "GOOGLE_PALM_API_KEY",
  });

  const chatResult = model._mapPalmMessagesToChatResult(generations);
  expect(chatResult.generations.length).toEqual(1);
  expect(chatResult.generations[0].text).toBe("ai-1");
  expect(chatResult.generations[0].message._getType()).toBe("ai");
  expect(chatResult.generations[0].message.name).toBe("droid");
  expect(chatResult.generations[0].message.content).toBe("ai-1");
  expect(
    chatResult.generations[0].message.additional_kwargs.citationSources
  ).toEqual([
    {
      startIndex: 0,
      endIndex: 5,
      uri: "https://example.com",
      license: "MIT",
    },
  ]);
  expect(chatResult.generations[0].message.additional_kwargs.filters).toEqual([
    {
      message: "potential problem",
      reason: "SAFETY",
    },
  ]);
});

test("Google Palm Chat - gets empty chat result & reason if generation failed", async () => {
  const generations: protos.google.ai.generativelanguage.v1beta2.IGenerateMessageResponse =
    {
      candidates: [],
      filters: [
        {
          message: "potential problem",
          reason: "SAFETY",
        },
      ],
    };
  const model = new ChatGooglePaLMTest({
    apiKey: "GOOGLE_PALM_API_KEY",
  });

  const chatResult = model._mapPalmMessagesToChatResult(generations);
  expect(chatResult.generations.length).toEqual(0);
  expect(chatResult.llmOutput?.filters).toEqual([
    {
      message: "potential problem",
      reason: "SAFETY",
    },
  ]);
});
