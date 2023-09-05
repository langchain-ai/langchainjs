import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import {
  BaseMessage,
  ChatMessage,
  ChatGeneration,
  HumanMessage,
  LLMResult,
  SystemMessage,
} from "../../schema/index.js";
import { ChatPromptValue } from "../../prompts/chat.js";
import {
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { CallbackManager } from "../../callbacks/index.js";
import { NewTokenIndices } from "../../callbacks/base.js";

test("Test ChatOpenAI", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const message = new HumanMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatOpenAI with SystemChatMessage", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const system_message = new SystemMessage("You are to chat with a user.");
  const message = new HumanMessage("Hello!");
  const res = await chat.call([system_message, message]);
  console.log({ res });
});

test("Test ChatOpenAI Generate", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const message of generation) {
      console.log(message.text);
      expect(typeof message.text).toBe("string");
    }
  }
  console.log({ res });
});

test("Test ChatOpenAI Generate throws when one of the calls fails", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanMessage("Hello!");
  await expect(() =>
    chat.generate([[message], [message]], {
      signal: AbortSignal.timeout(10),
    })
  ).rejects.toThrow();
});

test("Test ChatOpenAI tokenUsage", async () => {
  let tokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const message = new HumanMessage("Hello");
  const res = await model.call([message]);
  console.log({ res });

  expect(tokenUsage.promptTokens).toBeGreaterThan(0);
});

test("Test ChatOpenAI tokenUsage with a batch", async () => {
  let tokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
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
  console.log(res);

  expect(tokenUsage.promptTokens).toBeGreaterThan(0);
});

test("Test ChatOpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    maxTokens: 10,
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

test("Test ChatOpenAI in streaming mode with n > 1 and multiple prompts", async () => {
  let nrNewTokens = 0;
  const streamedCompletions = [
    ["", ""],
    ["", ""],
  ];

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    maxTokens: 10,
    n: 2,
    callbacks: [
      {
        async handleLLMNewToken(token: string, idx: NewTokenIndices) {
          nrNewTokens += 1;
          streamedCompletions[idx.prompt][idx.completion] += token;
        },
      },
    ],
  });
  const message1 = new HumanMessage("Hello!");
  const message2 = new HumanMessage("Bye!");
  const result = await model.generate([[message1], [message2]]);
  console.log(result.generations);

  expect(nrNewTokens > 0).toBe(true);
  expect(result.generations.map((g) => g.map((gg) => gg.text))).toEqual(
    streamedCompletions
  );
}, 10000);

test("Test ChatOpenAI prompt value", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generatePrompt([new ChatPromptValue([message])]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const g of generation) {
      console.log(g.text);
    }
  }
  console.log({ res });
});

test("OpenAI Chat, docs, prompt templates", async () => {
  const chat = new ChatOpenAI({ temperature: 0, maxTokens: 10 });

  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  );

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
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

test("Test OpenAI with stop", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  const res = await model.call(
    [new HumanMessage("Print hello world")],
    ["world"]
  );
  console.log({ res });
});

test("Test OpenAI with stop in object", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  const res = await model.call([new HumanMessage("Print hello world")], {
    stop: ["world"],
  });
  console.log({ res });
});

test("Test OpenAI with timeout in call options", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  await expect(() =>
    model.call([new HumanMessage("Print hello world")], {
      options: { timeout: 10 },
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with timeout in call options and node adapter", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  await expect(() =>
    model.call([new HumanMessage("Print hello world")], {
      options: { timeout: 10 },
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call([new HumanMessage("Print hello world")], {
      options: { signal: controller.signal },
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options and node adapter", async () => {
  const model = new ChatOpenAI({ maxTokens: 5, modelName: "text-ada-001" });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call([new HumanMessage("Print hello world")], {
      options: { signal: controller.signal },
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

function createSystemChatMessage(text: string, name?: string) {
  const msg = new SystemMessage(text);
  msg.name = name;
  return msg;
}

function createSampleMessages(): BaseMessage[] {
  // same example as in https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
  return [
    createSystemChatMessage(
      "You are a helpful, pattern-following assistant that translates corporate jargon into plain English."
    ),
    createSystemChatMessage(
      "New synergies will help drive top-line growth.",
      "example_user"
    ),
    createSystemChatMessage(
      "Things working well together will increase revenue.",
      "example_assistant"
    ),
    createSystemChatMessage(
      "Let's circle back when we have more bandwidth to touch base on opportunities for increased leverage.",
      "example_user"
    ),
    createSystemChatMessage(
      "Let's talk later when we're less busy about how to do better.",
      "example_assistant"
    ),
    new HumanMessage(
      "This late pivot means we don't have time to boil the ocean for the client deliverable."
    ),
  ];
}

test("getNumTokensFromMessages gpt-3.5-turbo-0301 model for sample input", async () => {
  const messages: BaseMessage[] = createSampleMessages();

  const chat = new ChatOpenAI({
    openAIApiKey: "dummy",
    modelName: "gpt-3.5-turbo-0301",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(127);
});

test("getNumTokensFromMessages gpt-4-0314 model for sample input", async () => {
  const messages: BaseMessage[] = createSampleMessages();

  const chat = new ChatOpenAI({
    openAIApiKey: "dummy",
    modelName: "gpt-4-0314",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(129);
});

test("Test OpenAI with specific roles in ChatMessage", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const system_message = new ChatMessage(
    "You are to chat with a user.",
    "system"
  );
  const user_message = new ChatMessage("Hello!", "user");
  const res = await chat.call([system_message, user_message]);
  console.log({ res });
});

test("Test ChatOpenAI stream method", async () => {
  const model = new ChatOpenAI({ maxTokens: 50, modelName: "gpt-3.5-turbo" });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test ChatOpenAI stream method with abort", async () => {
  await expect(async () => {
    const model = new ChatOpenAI({ maxTokens: 50, modelName: "gpt-3.5-turbo" });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose.",
      {
        signal: AbortSignal.timeout(1000),
      }
    );
    for await (const chunk of stream) {
      console.log(chunk);
    }
  }).rejects.toThrow();
});

test("Test ChatOpenAI stream method with early break", async () => {
  const model = new ChatOpenAI({ maxTokens: 50, modelName: "gpt-3.5-turbo" });
  const stream = await model.stream(
    "How is your day going? Be extremely verbose."
  );
  let i = 0;
  for await (const chunk of stream) {
    console.log(chunk);
    i += 1;
    if (i > 10) {
      break;
    }
  }
});

test("Test ChatOpenAI stream method, timeout error thrown from SDK", async () => {
  await expect(async () => {
    const model = new ChatOpenAI({
      maxTokens: 50,
      modelName: "gpt-3.5-turbo",
      timeout: 1,
    });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose."
    );
    for await (const chunk of stream) {
      console.log(chunk);
    }
  }).rejects.toThrow();
});

test("Function calling with streaming", async () => {
  let finalResult: BaseMessage | undefined;
  const modelForFunctionCalling = new ChatOpenAI({
    modelName: "gpt-4-0613",
    temperature: 0,
    callbacks: [
      {
        handleLLMEnd(output: LLMResult) {
          finalResult = (output.generations[0][0] as ChatGeneration).message;
        },
      },
    ],
  });

  const stream = await modelForFunctionCalling.stream(
    "What is the weather in New York?",
    {
      functions: [
        {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      ],
      function_call: {
        name: "get_current_weather",
      },
    }
  );

  const chunks = [];
  let streamedOutput;
  for await (const chunk of stream) {
    chunks.push(chunk);
    if (!streamedOutput) {
      streamedOutput = chunk;
    } else if (chunk) {
      streamedOutput = streamedOutput.concat(chunk);
    }
  }

  expect(finalResult).toEqual(streamedOutput);
  expect(chunks.length).toBeGreaterThan(1);
  expect(finalResult?.additional_kwargs?.function_call?.name).toBe(
    "get_current_weather"
  );
  expect(
    JSON.parse(finalResult?.additional_kwargs?.function_call?.arguments ?? "")
      .location
  ).toBe("New York");
});
