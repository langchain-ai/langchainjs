/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StructuredTool, tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  CodeExecutionTool,
  DynamicRetrievalMode,
  SchemaType as FunctionDeclarationSchemaType,
  GoogleSearchRetrievalTool,
} from "@google/generative-ai";
import { concat } from "@langchain/core/utils/stream";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

const dummyToolResponse = `[{"title":"Weather in New York City","url":"https://www.weatherapi.com/","content":"{'location': {'name': 'New York', 'region': 'New York', 'country': 'United States of America', 'lat': 40.71, 'lon': -74.01, 'tz_id': 'America/New_York', 'localtime_epoch': 1718659486, 'localtime': '2024-06-17 17:24'}, 'current': {'last_updated_epoch': 1718658900, 'last_updated': '2024-06-17 17:15', 'temp_c': 27.8, 'temp_f': 82.0, 'is_day': 1, 'condition': {'text': 'Partly cloudy', 'icon': '//cdn.weatherapi.com/weather/64x64/day/116.png', 'code': 1003}, 'wind_mph': 2.2, 'wind_kph': 3.6, 'wind_degree': 159, 'wind_dir': 'SSE', 'pressure_mb': 1021.0, 'pressure_in': 30.15, 'precip_mm': 0.0, 'precip_in': 0.0, 'humidity': 58, 'cloud': 25, 'feelslike_c': 29.0, 'feelslike_f': 84.2, 'windchill_c': 26.9, 'windchill_f': 80.5, 'heatindex_c': 27.9, 'heatindex_f': 82.2, 'dewpoint_c': 17.1, 'dewpoint_f': 62.8, 'vis_km': 16.0, 'vis_miles': 9.0, 'uv': 7.0, 'gust_mph': 18.3, 'gust_kph': 29.4}}","score":0.98192,"raw_content":null},{"title":"New York, NY Monthly Weather | AccuWeather","url":"https://www.accuweather.com/en/us/new-york/10021/june-weather/349727","content":"Get the monthly weather forecast for New York, NY, including daily high/low, historical averages, to help you plan ahead.","score":0.97504,"raw_content":null}]`;

test("Test Google AI", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });
  const res = await model.invoke("what is 1 + 1?");
  expect(res).toBeTruthy();
});

test("Test Google AI generation", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });
  const res = await model.generate([
    [["human", `Translate "I love programming" into Korean.`]],
  ]);
  expect(res).toBeTruthy();
});

test("Test Google AI generation with a stop sequence", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    stopSequences: ["two", "2"],
  });
  const res = await model.invoke([
    ["human", `What are the first three positive whole numbers?`],
  ]);
  expect(res).toBeTruthy();
  expect(res.additional_kwargs.finishReason).toBe("STOP");
  expect(res.content).not.toContain("2");
  expect(res.content).not.toContain("two");
});

test("Test Google AI generation with a system message", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });
  const res = await model.generate([
    [
      ["system", `You are an amazing translator.`],
      ["human", `Translate "I love programming" into Korean.`],
    ],
  ]);
  expect(res).toBeTruthy();
});

test("Test Google AI multimodal generation", async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imageData = (
    await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"))
  ).toString("base64");
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
  });
  const res = await model.invoke([
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "Describe the following image:",
        },
        {
          type: "image_url",
          image_url: `data:image/png;base64,${imageData}`,
        },
      ],
    }),
  ]);
  expect(res).toBeTruthy();
});

test("Test Google AI handleLLMNewToken callback", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });
    let tokens = "";
    const res = await model.call(
      [new HumanMessage("what is 1 + 1?")],
      undefined,
      [
        {
          handleLLMNewToken(token: string) {
            tokens += token;
          },
        },
      ]
    );
    const responseContent = typeof res.content === "string" ? res.content : "";
    expect(tokens).toBe(responseContent);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test Google AI handleLLMNewToken callback with streaming", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });
    let tokens = "";
    const res = await model.stream([new HumanMessage("what is 1 + 1?")], {
      callbacks: [
        {
          handleLLMNewToken(token: string) {
            tokens += token;
          },
        },
      ],
    });
    let responseContent = "";
    for await (const streamItem of res) {
      responseContent += streamItem.content;
    }
    expect(tokens).toBe(responseContent);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test Google AI in streaming mode", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      streaming: true,
    });
    let tokens = "";
    let nrNewTokens = 0;
    const res = await model.invoke([new HumanMessage("Write a haiku?")], {
      callbacks: [
        {
          handleLLMNewToken(token: string) {
            nrNewTokens += 1;
            tokens += token;
          },
        },
      ],
    });
    expect(nrNewTokens).toBeGreaterThanOrEqual(1);
    expect(res.content).toBe(tokens);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

async function fileToBase64(filePath: string): Promise<string> {
  const fileData = await fs.readFile(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

test("Gemini can understand audio", async () => {
  // Update this with the correct path to an audio file on your machine.
  const audioPath = "./src/tests/data/gettysburg10.wav";
  const audioMimeType = "audio/wav";

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0,
    maxRetries: 0,
  });

  const audioBase64 = await fileToBase64(audioPath);

  const prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("audio"),
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    audio: new HumanMessage({
      content: [
        {
          type: "media",
          mimeType: audioMimeType,
          data: audioBase64,
        },
        {
          type: "text",
          text: "Summarize the content in this audio. ALso, what is the speaker's tone?",
        },
      ],
    }),
  });

  expect(typeof response.content).toBe("string");
  expect((response.content as string).length).toBeGreaterThan(15);
});

class FakeBrowserTool extends StructuredTool {
  schema = z.object({
    url: z.string(),
    query: z.string().optional(),
  });

  name = "fake_browser_tool";

  description =
    "useful for when you need to find something on the web or summarize a webpage.";

  async _call(_: z.infer<this["schema"]>): Promise<string> {
    return "fake_browser_tool";
  }
}
const googleGenAITool = {
  functionDeclarations: [
    {
      name: "fake_browser_tool",
      description:
        "useful for when you need to find something on the web or summarize a webpage.",
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        required: ["url"],
        properties: {
          url: {
            type: FunctionDeclarationSchemaType.STRING,
          },
          query: {
            type: FunctionDeclarationSchemaType.STRING,
          },
        },
      },
    },
  ],
};
const prompt = new HumanMessage(
  "Search the web and tell me what the weather will be like tonight in new york. use weather.com"
);

test("ChatGoogleGenerativeAI can bind and invoke langchain tools", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  const modelWithTools = model.bindTools([new FakeBrowserTool()]);
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can bind and stream langchain tools", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
  });

  const modelWithTools = model.bindTools([new FakeBrowserTool()]);
  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of await modelWithTools.stream([prompt])) {
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  if (!finalChunk) {
    throw new Error("finalChunk is undefined");
  }
  const toolCalls = finalChunk.tool_calls;
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect(toolCalls[0].id).toBeDefined();
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can handle streaming tool messages.", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    maxRetries: 1,
  });

  const browserTool = new FakeBrowserTool();

  const modelWithTools = model.bindTools([browserTool]);
  let finalChunk: AIMessageChunk | undefined;
  const fullPrompt = [
    new SystemMessage(
      "You are a helpful assistant. If the chat history contains the tool results, you should use that and not call the tool again."
    ),
    prompt,
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: browserTool.name,
          args: {
            query: "weather tonight new york",
            url: "https://weather.com",
          },
        },
      ],
    }),
    new ToolMessage(dummyToolResponse, "id", browserTool.name),
  ];
  for await (const chunk of await modelWithTools.stream(fullPrompt)) {
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  if (!finalChunk) {
    throw new Error("finalChunk is undefined");
  }
  expect(typeof finalChunk.content).toBe("string");
  expect(finalChunk.content.length).toBeGreaterThan(1);
  expect(finalChunk.tool_calls).toHaveLength(0);
});

test("ChatGoogleGenerativeAI can handle invoking tool messages.", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    maxRetries: 1,
  });

  const browserTool = new FakeBrowserTool();

  const modelWithTools = model.bindTools([browserTool]);
  const fullPrompt = [
    new SystemMessage(
      "You are a helpful assistant. If the chat history contains the tool results, you should use that and not call the tool again."
    ),
    prompt,
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: browserTool.name,
          args: {
            query: "weather tonight new york",
            url: "https://weather.com",
          },
        },
      ],
    }),
    new ToolMessage(dummyToolResponse, "id", browserTool.name),
  ];
  const response = await modelWithTools.invoke(fullPrompt);
  expect(typeof response.content).toBe("string");
  expect(response.content.length).toBeGreaterThan(1);
  expect(response.tool_calls).toHaveLength(0);
});

test("ChatGoogleGenerativeAI can bind and invoke genai tools", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  const modelWithTools = model.bindTools([googleGenAITool]);
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can bindTools with langchain tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  const modelWithTools = model.bindTools([new FakeBrowserTool()]);
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can bindTools with genai tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  const modelWithTools = model.bindTools([googleGenAITool]);
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can call withStructuredOutput langchain tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  const modelWithTools = model.withStructuredOutput(
    z.object({
      zomg: z.string(),
      omg: z.number().optional(),
    })
  );
  const res = await modelWithTools.invoke([prompt]);
  expect(typeof res.zomg === "string").toBe(true);
});

test("ChatGoogleGenerativeAI can call withStructuredOutput genai tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  type GeminiTool = {
    url: string;
    query?: string;
  };

  const modelWithTools = model.withStructuredOutput<GeminiTool>(
    googleGenAITool.functionDeclarations[0].parameters
  );
  const res = await modelWithTools.invoke([prompt]);
  expect(typeof res.url === "string").toBe(true);
});

test("Stream token count usage_metadata", async () => {
  const model = new ChatGoogleGenerativeAI({
    temperature: 0,
    model: "gemini-2.0-flash",
    maxOutputTokens: 10,
  });
  let res: AIMessageChunk | null = null;
  for await (const chunk of await model.stream(
    "Why is the sky blue? Be concise."
  )) {
    if (!res) {
      res = chunk;
    } else {
      res = res.concat(chunk);
    }
  }
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
});

describe("ChatGoogleGenerativeAI should count tokens correctly", () => {
  describe("when streaming", () => {
    test.each(["gemini-1.5-flash", "gemini-2.5-pro"])(
      "with %s",
      async (modelName) => {
        const model = new ChatGoogleGenerativeAI({
          model: modelName,
          temperature: 0,
          maxRetries: 0,
        });
        const res = await model.stream("Why is the sky blue? Be concise.");
        let full: AIMessageChunk | undefined;
        for await (const chunk of res) {
          full ??= chunk;
          full = full.concat(chunk);
          console.log("langchain:", chunk.usage_metadata);
        }
        console.log(modelName, full);
        // expect(full?.usage_metadata);
        // expect(res.usage_metadata).toBeDefined();
      }
    );
  });
});

test("streamUsage excludes token usage", async () => {
  const model = new ChatGoogleGenerativeAI({
    temperature: 0,
    model: "gemini-2.0-flash",
    streamUsage: false,
  });
  let res: AIMessageChunk | null = null;
  for await (const chunk of await model.stream(
    "Why is the sky blue? Be concise."
  )) {
    if (!res) {
      res = chunk;
    } else {
      res = res.concat(chunk);
    }
  }
  expect(res?.usage_metadata).not.toBeDefined();
});

test("Invoke token count usage_metadata", async () => {
  const model = new ChatGoogleGenerativeAI({
    temperature: 0,
    model: "gemini-2.0-flash",
    maxOutputTokens: 10,
  });
  const res = await model.invoke("Why is the sky blue? Be concise.");
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
});

test("Invoke with JSON mode", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0,
    maxOutputTokens: 10,
    json: true,
  });
  const res = await model.invoke("Why is the sky blue? Be concise.");
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
});

test("Supports tool_choice", async () => {
  const model = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });
  const tools = [
    {
      name: "get_weather",
      description: "Get the weather",
      schema: z.object({
        location: z.string(),
      }),
    },
    {
      name: "calculator",
      description: "Preform calculations",
      schema: z.object({
        expression: z.string(),
      }),
    },
  ];

  const modelWithTools = model.bindTools(tools, {
    tool_choice: "calculator",
    allowedFunctionNames: ["calculator"],
  });
  const response = await modelWithTools.invoke(
    "What is 27725327 times 283683? Also whats the weather in New York?"
  );
  expect(response.tool_calls?.length).toBe(1);
});

describe("GoogleSearchRetrievalTool", () => {
  test("Supports GoogleSearchRetrievalTool", async () => {
    const searchRetrievalTool: GoogleSearchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: DynamicRetrievalMode.MODE_DYNAMIC,
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-pro",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");

    expect(result.response_metadata?.groundingMetadata).toBeDefined();
    expect(result.content as string).toContain("Dodgers");
  });

  test("Can stream GoogleSearchRetrievalTool", async () => {
    const searchRetrievalTool: GoogleSearchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: DynamicRetrievalMode.MODE_DYNAMIC,
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-pro",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const stream = await model.stream("Who won the 2024 MLB World Series?");
    let finalMsg: AIMessageChunk | undefined;
    for await (const msg of stream) {
      finalMsg = finalMsg ? concat(finalMsg, msg) : msg;
    }
    if (!finalMsg) {
      throw new Error("finalMsg is undefined");
    }
    expect(finalMsg.response_metadata?.groundingMetadata).toBeDefined();
    expect(finalMsg.content as string).toContain("Dodgers");
  });
});

describe("CodeExecutionTool", () => {
  test("Supports CodeExecutionTool", async () => {
    const codeExecutionTool: CodeExecutionTool = {
      codeExecution: {}, // Simply pass an empty object to enable it.
    };
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-pro",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([codeExecutionTool]);

    const result = await model.invoke(
      "Use code execution to find the sum of the first and last 3 numbers in the following list: [1, 2, 3, 72638, 8, 727, 4, 5, 6]"
    );

    expect(Array.isArray(result.content)).toBeTruthy();
    if (!Array.isArray(result.content)) {
      throw new Error("Content is not an array");
    }
    const texts = result.content
      .flatMap((item) => ("text" in item ? [item.text] : []))
      .join("\n");
    expect(texts).toContain("21");

    const executableCode = result.content.find(
      (item) => item.type === "executableCode"
    );
    expect(executableCode).toBeDefined();
    const codeResult = result.content.find(
      (item) => item.type === "codeExecutionResult"
    );
    expect(codeResult).toBeDefined();
  });

  test("CodeExecutionTool contents can be passed in chat history", async () => {
    const codeExecutionTool: CodeExecutionTool = {
      codeExecution: {}, // Simply pass an empty object to enable it.
    };
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-pro",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([codeExecutionTool]);

    const codeResult = await model.invoke(
      "Use code execution to find the sum of the first and last 3 numbers in the following list: [1, 2, 3, 72638, 8, 727, 4, 5, 6]"
    );

    const explanation = await model.invoke([
      codeResult,
      {
        role: "user",
        content:
          "Please explain the question I asked, the code you wrote, and the answer you got.",
      },
    ]);

    expect(typeof explanation.content).toBe("string");
    expect(explanation.content.length).toBeGreaterThan(10);
  });

  test("Can stream CodeExecutionTool", async () => {
    const codeExecutionTool: CodeExecutionTool = {
      codeExecution: {}, // Simply pass an empty object to enable it.
    };
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-pro",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([codeExecutionTool]);

    const stream = await model.stream(
      "Use code execution to find the sum of the first and last 3 numbers in the following list: [1, 2, 3, 72638, 8, 727, 4, 5, 6]"
    );
    let finalMsg: AIMessageChunk | undefined;
    for await (const msg of stream) {
      finalMsg = finalMsg ? concat(finalMsg, msg) : msg;
    }

    if (!finalMsg) {
      throw new Error("finalMsg is undefined");
    }
    expect(Array.isArray(finalMsg.content)).toBeTruthy();
    if (!Array.isArray(finalMsg.content)) {
      throw new Error("Content is not an array");
    }
    const texts = finalMsg.content
      .flatMap((item) => ("text" in item ? [item.text] : []))
      .join("\n");
    expect(texts).toContain("21");

    const executableCode = finalMsg.content.find(
      (item) => item.type === "executableCode"
    );
    expect(executableCode).toBeDefined();
    const codeResult = finalMsg.content.find(
      (item) => item.type === "codeExecutionResult"
    );
    expect(codeResult).toBeDefined();
  });
});

test("pass pdf to request", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash-exp",
    temperature: 0,
    maxRetries: 0,
  });
  const pdfPath =
    "../langchain-community/src/document_loaders/tests/example_data/Jacob_Lee_Resume_2023.pdf";
  const pdfBase64 = await fs.readFile(pdfPath, "base64");

  const response = await model.invoke([
    ["system", "Use the provided documents to answer the question"],
    [
      "user",
      [
        {
          type: "application/pdf",
          data: pdfBase64,
        },
        {
          type: "text",
          text: "Summarize the contents of this PDF",
        },
      ],
    ],
  ]);

  expect(response.content.length).toBeGreaterThan(10);
});

test("calling tool with no args should work", async () => {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    maxRetries: 0,
  });
  const sfWeatherTool = tool(
    async () => "The weather is 80 degrees and sunny",
    {
      name: "sf_weather",
      description: "Gets the weather in SF",
      schema: z.object({}),
    }
  );
  const llmWithTools = llm.bindTools([sfWeatherTool]);
  const result = await llmWithTools.invoke([
    {
      role: "user",
      content: "What is the current weather in SF?",
    },
  ]);
  const nextMessage = await sfWeatherTool.invoke(result.tool_calls![0]);
  delete nextMessage.name; // Should work even if name is not present
  const finalResult = await llmWithTools.invoke([
    {
      role: "user",
      content: "What is the current weather in SF?",
    },
    result,
    nextMessage,
  ]);
  expect(finalResult.content).toContain("80");
});

// test("calling tool with no args in agent should work", async () => {
//   const { createReactAgent } = await import("@langchain/langgraph/prebuilt");
//   const llm = new ChatGoogleGenerativeAI({
//     model: "gemini-2.0-flash",
//     maxRetries: 0,
//   });
//   const sfWeatherTool = tool(
//     async ({}) => {
//       return "The weather is 80 degrees and sunny";
//     },
//     {
//       name: "sf_weather",
//       description: "Get the weather in SF",
//       schema: z.object({}),
//     }
//   );
//   const agent = createReactAgent({
//     llm,
//     tools: [sfWeatherTool],
//   });
//   const result = await agent.invoke({
//     messages: [
//       {
//         role: "user",
//         content: "What is the weather in SF?",
//       },
//     ],
//   });
//   expect(result.messages.at(-1)?.content).toContain("80");
// });

// test("calling tool with no args in agent should work", async () => {
//   const { createReactAgent } = await import("@langchain/langgraph/prebuilt");
//   const llm = new ChatGoogleGenerativeAI({
//     model: "gemini-2.0-flash",
//     maxRetries: 0,
//     streaming: true,
//   });
//   const sfWeatherTool = tool(
//     async ({ location }) => {
//       return `The weather in ${location} is 80 degrees and sunny`;
//     },
//     {
//       name: "weather",
//       description: "Get the weather in location",
//       schema: z.object({ location: z.string() }),
//     }
//   );
//   const agent = createReactAgent({
//     llm,
//     tools: [sfWeatherTool],
//   });
//   const result = await agent.invoke({
//     messages: [
//       {
//         role: "user",
//         content:
//           "What is the weather in Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch?",
//       },
//     ],
//   });
//   expect(result.messages.at(-1)?.content).toContain("80");
// });
