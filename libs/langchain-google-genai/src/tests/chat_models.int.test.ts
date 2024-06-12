import { test } from "@jest/globals";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { FunctionDeclarationSchemaType } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

test("Test Google AI", async () => {
  const model = new ChatGoogleGenerativeAI({});
  const res = await model.invoke("what is 1 + 1?");
  console.log({ res });
  expect(res).toBeTruthy();
});

test("Test Google AI generation", async () => {
  const model = new ChatGoogleGenerativeAI({});
  const res = await model.generate([
    [["human", `Translate "I love programming" into Korean.`]],
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});

test("Test Google AI generation with a stop sequence", async () => {
  const model = new ChatGoogleGenerativeAI({
    stopSequences: ["two", "2"],
  });
  const res = await model.invoke([
    ["human", `What are the first three positive whole numbers?`],
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
  expect(res.additional_kwargs.finishReason).toBe("STOP");
  expect(res.content).not.toContain("2");
  expect(res.content).not.toContain("two");
});

test("Test Google AI generation with a system message", async () => {
  const model = new ChatGoogleGenerativeAI({});
  const res = await model.generate([
    [
      ["system", `You are an amazing translator.`],
      ["human", `Translate "I love programming" into Korean.`],
    ],
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});

test("Test Google AI multimodal generation", async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imageData = (
    await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"))
  ).toString("base64");
  const model = new ChatGoogleGenerativeAI({
    modelName: "gemini-pro-vision",
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
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});

test("Test Google AI handleLLMNewToken callback", async () => {
  const model = new ChatGoogleGenerativeAI({});
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
  console.log({ tokens });
  const responseContent = typeof res.content === "string" ? res.content : "";
  expect(tokens).toBe(responseContent);
});

test("Test Google AI handleLLMNewToken callback with streaming", async () => {
  const model = new ChatGoogleGenerativeAI({});
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
  console.log({ tokens });
  let responseContent = "";
  for await (const streamItem of res) {
    responseContent += streamItem.content;
  }
  console.log({ tokens });
  expect(tokens).toBe(responseContent);
});

test("Test Google AI in streaming mode", async () => {
  const model = new ChatGoogleGenerativeAI({ streaming: true });
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
  console.log({ tokens, nrNewTokens });
  expect(nrNewTokens > 1).toBe(true);
  expect(res.content).toBe(tokens);
});

async function fileToBase64(filePath: string): Promise<string> {
  const fileData = await fs.readFile(filePath);
  const base64String = Buffer.from(fileData).toString("base64");
  return base64String;
}

test.skip("Gemini can understand audio", async () => {
  // Update this with the correct path to an audio file on your machine.
  const audioPath =
    "/Users/bracesproul/code/lang-chain-ai/langchainjs/libs/langchain-google-gauth/src/tests/data/audio.mp3";
  const audioMimeType = "audio/mp3";

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro-latest",
    temperature: 0,
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

  console.log(response.content);
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
  const model = new ChatGoogleGenerativeAI({});

  const modelWithTools = model.bind({
    tools: [new FakeBrowserTool()],
  });
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  console.log(toolCalls);
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can bind and invoke genai tools", async () => {
  const model = new ChatGoogleGenerativeAI({});

  const modelWithTools = model.bind({
    tools: [googleGenAITool],
  });
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  console.log(toolCalls);
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can bindTools with langchain tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({});

  const modelWithTools = model.bindTools([new FakeBrowserTool()]);
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  console.log(toolCalls);
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can bindTools with genai tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({});

  const modelWithTools = model.bindTools([googleGenAITool]);
  const res = await modelWithTools.invoke([prompt]);
  const toolCalls = res.tool_calls;
  console.log(toolCalls);
  expect(toolCalls).toBeDefined();
  if (!toolCalls) {
    throw new Error("tool_calls not in response");
  }
  expect(toolCalls.length).toBe(1);
  expect(toolCalls[0].name).toBe("fake_browser_tool");
  expect("url" in toolCalls[0].args).toBe(true);
});

test("ChatGoogleGenerativeAI can call withStructuredOutput langchain tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({});
  const tool = new FakeBrowserTool();

  const modelWithTools = model.withStructuredOutput<
    z.infer<typeof tool.schema>
  >(tool.schema);
  const res = await modelWithTools.invoke([prompt]);
  console.log(res);
  expect(typeof res.url === "string").toBe(true);
});

test("ChatGoogleGenerativeAI can call withStructuredOutput genai tools and invoke", async () => {
  const model = new ChatGoogleGenerativeAI({});

  type GeminiTool = {
    url: string;
    query?: string;
  };

  const modelWithTools = model.withStructuredOutput<GeminiTool>(
    googleGenAITool.functionDeclarations[0].parameters
  );
  const res = await modelWithTools.invoke([prompt]);
  console.log(res);
  expect(typeof res.url === "string").toBe(true);
});
