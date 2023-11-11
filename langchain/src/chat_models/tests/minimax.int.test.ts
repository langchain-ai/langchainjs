import { expect, test } from "@jest/globals";
import { ChatMinimax } from "../minimax.js";
import {
  ChatMessage,
  HumanMessage,
  LLMResult,
  SystemMessage,
} from "../../schema/index.js";
import { CallbackManager } from "../../callbacks/index.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";

test.skip("Test ChatMinimax", async () => {
  const chat = new ChatMinimax({
    modelName: "abab5.5-chat",
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatMinimax with SystemChatMessage", async () => {
  const chat = new ChatMinimax();
  const system_message = new SystemMessage("You are to chat with a user.");
  const message = new HumanMessage("Hello!");
  const res = await chat.call([system_message, message]);
  console.log({ res });
});

test.skip("Test ChatMinimax Generate", async () => {
  const chat = new ChatMinimax({
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(1);
    for (const message of generation) {
      console.log(message.text);
      expect(typeof message.text).toBe("string");
    }
  }
  console.log({ res });
});

test.skip("Test ChatMinimax Generate throws when one of the calls fails", async () => {
  const chat = new ChatMinimax({
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  });
  const message = new HumanMessage("Hello!");
  await expect(() =>
    chat.generate([[message], [message]], {
      signal: AbortSignal.timeout(10),
    })
  ).rejects.toThrow("TimeoutError: The operation was aborted due to timeout");
});

test.skip("Test ChatMinimax tokenUsage", async () => {
  let tokenUsage = {
    totalTokens: 0,
  };

  const model = new ChatMinimax({
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const message = new HumanMessage("Hello");
  const res = await model.call([message]);
  console.log({ res });

  expect(tokenUsage.totalTokens).toBeGreaterThan(0);
});

test.skip("Test ChatMinimax tokenUsage with a batch", async () => {
  let tokenUsage = {
    totalTokens: 0,
  };

  const model = new ChatMinimax({
    temperature: 0.01,
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const res = await model.generate([
    [new HumanMessage("Hello")],
    [new HumanMessage("Hi")],
  ]);
  console.log({ tokenUsage });
  console.log(res);

  expect(tokenUsage.totalTokens).toBeGreaterThan(0);
});

test.skip("Test ChatMinimax in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatMinimax({
    streaming: true,
    tokensToGenerate: 10,
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
    callbacks: [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ],
  });
  const message = new HumanMessage("Hello!");
  const result = await model.call([message]);
  console.log(result);

  expect(nrNewTokens > 0).toBe(true);
  expect(result.content).toBe(streamedCompletion);
}, 10000);

test.skip("OpenAI Chat, docs, prompt templates", async () => {
  const chat = new ChatMinimax({
    temperature: 0.01,
    tokensToGenerate: 10,
  });

  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  );

  const chatPrompt = ChatPromptTemplate.fromMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      input_language: "English",
      output_language: "French",
      text: "I love programming.",
    }),
  ]);

  console.log(responseA.generations);
}, 5000);

test.skip("Test OpenAI with signal in call options", async () => {
  const model = new ChatMinimax({ tokensToGenerate: 5 });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call([new HumanMessage("Print hello world")], {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test.skip("Test OpenAI with specific roles in ChatMessage", async () => {
  const chat = new ChatMinimax({ tokensToGenerate: 10 });
  const system_message = new ChatMessage(
    "You are to chat with a user.",
    "system"
  );
  const user_message = new ChatMessage("Hello!", "user");
  const res = await chat.call([system_message, user_message]);
  console.log({ res });
});

test.skip("Function calling ", async () => {
  const weatherFunction = {
    name: "get_weather",
    description: " Get weather information.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: " The location to get the weather",
        },
      },
      required: ["location"],
    },
  };

  const model = new ChatMinimax({
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  }).bind({
    functions: [weatherFunction],
  });

  const result = await model.invoke([
    new HumanMessage({
      content: " What is the weather like in NewYork tomorrow?",
      name: "I",
    }),
  ]);

  console.log(result);
  expect(result.additional_kwargs.function_call?.name).toBe("get_weather");
});
test.skip("Test ChatMinimax Function calling ", async () => {
  const weatherFunction = {
    name: "get_weather",
    description: " Get weather information.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: " The location to get the weather",
        },
      },
      required: ["location"],
    },
  };

  const model = new ChatMinimax({
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  }).bind({
    functions: [weatherFunction],
  });

  const result = await model.invoke([
    new HumanMessage({
      content: " What is the weather like in NewYork tomorrow?",
      name: "I",
    }),
  ]);

  console.log(result);
  expect(result.additional_kwargs.function_call?.name).toBe("get_weather");
});

test.skip("Test ChatMinimax Glyph", async () => {
  const model = new ChatMinimax({
    modelName: "abab5.5-chat",
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  }).bind({
    replyConstraints: {
      sender_type: "BOT",
      sender_name: "MM Assistant",
      glyph: {
        type: "raw",
        raw_glyph: "The translated text：{{gen 'content'}}",
      },
    },
  });

  const messagesTemplate = ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate(
      " Please help me translate the following sentence in English： {text}"
    ),
  ]);

  const messages = await messagesTemplate.formatMessages({ text: "你好" });
  const result = await model.invoke(messages);

  console.log(result);
  expect(result.content).toMatch(/The translated text：.*/);
});
test.skip("Test ChatMinimax Plugins", async () => {
  const model = new ChatMinimax({
    modelName: "abab5.5-chat",
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  }).bind({
    plugins: ["plugin_web_search"],
  });

  const result = await model.invoke([
    new HumanMessage({
      content: " What is the weather like in NewYork tomorrow?",
    }),
  ]);

  console.log(result);
});
