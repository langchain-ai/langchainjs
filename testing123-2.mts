import {
  HumanMessage,
  ToolMessage,
  AIMessage,
  AIMessageChunk,
  isAIMessage,
  BaseMessage,
  isToolMessage,
  MessageContentText,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogle } from "@langchain/google-gauth";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { ChatBedrockConverse } from "@langchain/aws";

// import { ChatOllama } from "@langchain/ollama";
// import { ChatGroq } from "@langchain/groq";
// import { ChatXAI } from "@langchain/xai";
// import { ChatCerebras } from "@langchain/cerebras";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { readFile } from "fs/promises";
import { z } from "zod";
import { ToolCall } from "@langchain/core/dist/messages/tool";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const weather = new DynamicStructuredTool({
  name: "get_weather",
  description: "get the current weather in a given location",
  schema: {
    type: "object",
    properties: {
      location: { type: "string" },
    },
    required: ["location"],
  },
  func: async (input: { location: string }) => {
    return `The weather in ${input.location} is sunny and 70 degrees fahrenheit.`;
  },
});

const add = new DynamicStructuredTool({
  name: "add",
  description: "add two numbers",
  schema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    // required: ["a", "b"],
  },
  func: async (input: { a: number, b: number }) => {
    return input.a + input.b;
  },
});

const subtract = new DynamicStructuredTool({
  name: "subtract",
  description: "subtract two numbers",
  schema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    // required: ["a", "b"],
  },
  func: async (input: { a: number, b: number }) => {
    return input.a - input.b;
  },
});

const multiply = new DynamicStructuredTool({
  name: "multiply",
  description: "multiply two numbers",
  schema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    // required: ["a", "b"],
  },
  func: async (input: { a: number, b: number }) => {
    return input.a * input.b;
  },
});

const divide = new DynamicStructuredTool({
  name: "divide",
  description: "divide two numbers",
  schema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    // required: ["a", "b"],
  },
  func: async (input: { a: number, b: number }) => {
    return input.a / input.b;
  },
});

const tools = [ add, subtract, multiply, divide ];
// const tools = [weather];

function chunksToAIMessage(chunks: AIMessageChunk[]): AIMessage {
  if (chunks.length === 0) {
    throw new Error("No chunks provided");
  }
  
  const message = chunks.slice(1).reduce((acc, chunk) => {
    return acc.concat(chunk);
  }, chunks[0]);
  
  // manually convert to ToolCall from OpenAIToolCall - this shouldn't be necessary - will fix in the groq provider
  // if (
  //   (!message.tool_calls || message.tool_calls.length === 0) &&
  //   message.additional_kwargs?.tool_calls &&
  //   message.additional_kwargs.tool_calls.length > 0
  // ) {
  //   if (!message.tool_calls) {
  //     message.tool_calls = [];
  //   }

  //   if (!message.invalid_tool_calls) {
  //     message.invalid_tool_calls = [];
  //   }
  //   
  //   console.warn("[INFO: Manually converting tool calls from OpenAIToolCall to ToolCall]");

  //   for (const toolCall of message.additional_kwargs.tool_calls) {
  //     // @ts-expect-error this shouldn't be possible - if we branch here, something in the provider is bugged
  //     if (toolCall.type === "tool_call") {
  //       console.warn("[BUG! -- LangChain tool call found in additional_kwargs, converting to ToolCall]");
  //       message.tool_calls.push(toolCall as unknown as ToolCall);
  //     } else {
  //       try {
  //         const convertedArgs = JSON.parse(toolCall.function.arguments);
  //         const converted: ToolCall = {
  //           id: toolCall.id,
  //           name: toolCall.function.name,
  //           type: "tool_call",
  //           args: convertedArgs,
  //         };
  //         message.tool_calls.push(converted);
  //       } catch {
  //         message.invalid_tool_calls.push({
  //           name: toolCall.function.name,
  //           args: toolCall.function.arguments,
  //           error: "Invalid JSON",
  //           id: toolCall.id,
  //           type: "invalid_tool_call",
  //         });
  //       }
  //     }
  //   }
  // }
  
  if (message.tool_calls && message.tool_calls.length > 0) {
    console.log(`Tool calls: ${JSON.stringify(message.tool_calls, null, 2)}`);
  }
  return new AIMessage({
    id: message.id,
    content: message.content,
    tool_calls: message.tool_calls,
    invalid_tool_calls: message.invalid_tool_calls,
    usage_metadata: message.usage_metadata,
    name: message.name,
    response_metadata: message.response_metadata,
    additional_kwargs: message.additional_kwargs,
  });
}

function* extractTextContent(chunk: AIMessageChunk | AIMessage) {
  const content = chunk.content;

  if (typeof content === "string") {
    yield content;
    return;
  }

  if (!Array.isArray(content)) {
    throw new Error(
      `Unexpected message content structure: ${JSON.stringify(
        content,
        null,
        2
      )}`
    );
  }

  for (const item of content) {
    // standard text blocks
    if (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item
    ) {
      yield (item as MessageContentText).text;
      continue;
    }
    
    // throw new Error(`Unexpected message content structure: ${JSON.stringify(item, null, 2)}`);
  }
}

function shouldContinue(lastMessage: BaseMessage) {
  if (!isAIMessage(lastMessage)) {
    console.log("[Start of conversation or ToolMessage, continuing...]");
    return true;
  }

  if ((lastMessage.tool_calls ?? []).length > 0) {
    console.log("[Tool call, continuing...]");
    return true;
  }

  console.log("[No more tool calls, stopping...]");
  return false;
};

async function* handleToolCalls(message: AIMessage) {
  const toolCalls = message.tool_calls;
  for (const toolCall of toolCalls ?? []) {
    const tool = tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      yield new ToolMessage({
        tool_call_id: toolCall.id!,
        content: `Tool ${toolCall.name} not found`,
        name: toolCall.name,
        status: "error",
      });
      continue;
    }

    const result = await tool.invoke(toolCall);
    if (isToolMessage(result)) {
      console.log(`[Tool call: ${toolCall.name}(${JSON.stringify(toolCall.args)}) = ${result.content}]`);
      yield result;
    }

    if (typeof result === "string" || typeof result === "number") {
      console.log(`[Tool call: ${toolCall.name}(${JSON.stringify(toolCall.args)}) = ${result}]`);
      const tm = new ToolMessage({
        tool_call_id: toolCall.id!,
        content: result.toString(),
        name: tool.name,
        status: "success",
      });
      yield tm;
    }
  }
}


async function testLLMInvoke(
  model: BaseChatModel,
  invocationType: "invoke" | "stream" | "streamEvents" = "invoke"
) {
  if (!model.bindTools) {
    throw new Error("Model does not support tool binding");
  }

  const bound = model.bindTools(tools);
  
  // const recording = await readFile(path.join(__dirname, "test_recording.mp3"), { encoding: "base64" });
  // 
  // const image = await readFile(path.join(__dirname, "test_image.png"), { encoding: "base64" });
  // 
  // const document = await readFile(path.join(__dirname, "test_document.pdf"), { encoding: "base64" });

  let messages: BaseMessage[] = [
    // new HumanMessage("What is the current weather in San Francisco?"),
    new SystemMessage(`# Tool use

## Rules

- You may use the following tools to complete the user's request.
- If a user's question can be answered with a tool, you MUST use the tool when answering the user's question.
- You must call tools without nesting or function composition.
- Your tool arguments MUST match the tool's schema EXACTLY.
- You MAY include multiple tool calls in a response so long as the input of one tool call is not the output of another tool call.
- After you receive the result of your tool calls you will be able to call tools again.
- You will be able to call tools as many times as needed to answer the user's request.

## Available Tools

${tools
  .map(
    (t) =>
      `###${t.name}\n\n#### Description\n\n${
        t.description
      }\n\n#### Schema:\n\n\`\`\`${JSON.stringify(t.schema, null, 2)}\`\`\``
  )
  .join("\n\n")}`),
    // new HumanMessage({
    //   content: [
    //     {
    //       source_type: "base64",

    //       // type: "audio",
    //       // data: recording,
    //       // mime_type: "audio/mp3",

    //       // type: "image",
    //       // data: image,
    //       // mime_type: "image/png",
    //       // type: "image_url",
    //       // image_url: {
    //       //   url: "data:image/png;base64," + image,
    //       // },

    //       // type: "file",
    //       // data: document,
    //       // mime_type: "application/pdf",
    //       // metadata: {
    //       //   filename: "testdocument",
    //       // },
    //     },
    //     {
    //       type: "text",
    //       source_type: "text",
    //       text: "Describe the attached document.",
    //     }
    // }),

    new HumanMessage(
      "Answer the following question using the provided calculator tools: What is 2 + (3047 + 1234) / (1234 - 3047)?"
    ),
  ];
  
  // messages = [messages[1]];

  const content = messages.at(-1)!.content;
  if (typeof content === "string") {
    console.log(`User: ${messages.at(-1)!.content}`);
  } else {
    console.log(`User: <multimodal message>`);
  }

  while (shouldContinue(messages.at(-1)!)) {
    let result: AIMessage;
    if (invocationType === "stream") {
      const stream = await bound.stream(messages);
      const chunks: AIMessageChunk[] = [];
      let first = true;
      for await (const chunk of stream) {
        // console.log(
        //   `Received message chunk: ${JSON.stringify(chunk, null, 2)}`
        // );

        for (const text of extractTextContent(chunk)) {
          if (text) {
            if (first) {
              process.stdout.write("AI: ");
              first = false;
            }
            process.stdout.write(text);
          }
        }
        chunks.push(chunk);
      }
      if (!first) {
        process.stdout.write("\n");
      }

      if (chunks.length > 0) {
        result = chunksToAIMessage(chunks);
      } else {
        throw new Error("No chunks received");
      }
    } else if (invocationType === "streamEvents") {
      const streamEvents = bound.streamEvents(messages, {
        version: "v2",
      });
      const chunks: AIMessageChunk[] = [];
      let first = true;
      for await (const event of streamEvents) {
        if (event.event === "on_chat_model_stream") {
          if (typeof event.data.chunk === "string") {
            console.warn(`[BUG! -- Received string chunk '${event.data.chunk}', expected AIMessageChunk]`);
          }
          const chunk = event.data.chunk as AIMessageChunk;
          for (const text of extractTextContent(chunk)) {
            if (text) {
              if (first) {
                process.stdout.write("AI: ");
                first = false;
              }
              process.stdout.write(text);
            }
          }
          chunks.push(chunk);
        }
        if (event.event === "on_chat_model_end" && chunks.length === 0) {
          chunks.push(event.data.chunk);
          console.log(`AI (buffered): ${extractTextContent(event.data.chunk)}`);
        }
      }
      if (!first) {
        process.stdout.write("\n");
      }

      if (chunks.length > 0) {
        result = chunksToAIMessage(chunks);
      } else {
        throw new Error("No chunks received");
      }
    } else {
      result = await bound.invoke(messages);
      process.stdout.write("AI: ");
      for (const text of extractTextContent(result)) {
        process.stdout.write(text);
      }
      process.stdout.write("\n");
    }

    messages.push(result);
    // console.log(`AIMessage: ${JSON.stringify(result, null, 2)}`);
    for await (const toolMessage of handleToolCalls(result)) {
      messages.push(toolMessage);
    }
  }
}

async function main() {
  const invocationTypes = [/* "invoke", */ "stream", /* "streamEvents" */] as const;
  const models = [
    new ChatOpenAI({
      model: "gpt-4o",
      temperature: 1,
      configuration: {
        baseURL: "http://localhost:8080/v1",
      },
      useResponsesApi: true,
    }),
    
    // new ChatAnthropic({
    //   model: "claude-3-7-sonnet-latest",
    //   temperature: 1,
    // }),

    // new ChatGoogle({
    //   model: "gemini-2.0-flash",
    //   temperature: 1,
    // }),

    // new ChatGoogle({
    //   // model: "gemini-2.0-flash",
    //   model: "claude-3-5-sonnet-v2@20241022",
    //   temperature: 1,
    //   // apiName: "anthropic"
    // }),
    
    // new ChatVertexAI({
    //   model: "claude-3-5-sonnet-v2@20241022",
    //   apiName: "anthropic",
    //   apiKey: process.env.GOOGLE_API_KEY,
    //   temperature: 1,
    //   authOptions: {
    //     apiKey: process.env.GOOGLE_API_KEY,
    //     projectId: "langchain-dev",
    //   }
    // }),
    
    // new ChatBedrockConverse({
    //   model: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    //   temperature: 1,
    // }),

    // new ChatGroq({
    //   model: "llama-3.3-70b-versatile", // randomly decides not to produce responses
    //   // model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    //   // model: "deepseek-r1-distill-qwen-32b",
    //   // model: "llama-3.1-8b-instant", // works, but slow
    //   // model: "qwen-2.5-32b", // works fine, fast
    //   temperature: 1,
    //   baseUrl: "https://localhost:8082"
    // }),
    
    // new ChatOpenAI({
    //   model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    //   configuration: {
    //     apiKey: process.env.GROQ_API_KEY,
    //     baseURL: "https://api.groq.com/openai/v1",
    //   }
    // }),

    // new ChatOllama({
    //   model: "llama3.3:70b-instruct-q6_K",
    //   temperature: 0.2,
    //   baseUrl: "http://localhost:8080",
    // }),

    // new ChatOpenAI({
    //   model: "unsloth/Llama-3.3-70B-Instruct-bnb-4bit",
    //   configuration: {
    //     apiKey: "vllm",
    //     baseURL: "http://localhost:8000/v1",
    //   }
    // }),

    // new ChatXAI({
    //   model: "grok-2-vision-1212",
    //   temperature: 1,
    // }),

    // new ChatCerebras({
    //   model: "llama-3.3-70b",
    //   // model: "llama-4-scout-17b-16e-instruct",
    //   temperature: 1,
    // }),
  ];

  for (const model of models) {
    for (const invocationType of invocationTypes) {
      console.log(`Testing ${model.constructor.name} with ${invocationType}...`);
      try {
        await testLLMInvoke(model, invocationType);
      } catch (e) {
        console.error(`Testing ${model.constructor.name} with ${invocationType} failed: ${e}`);
        console.error(e.stack);
      }
      console.log("Done");
      console.log("");
      console.log("");
      console.log("");
    }
  }
}

main()
  .then(() => console.log("Done with all tests."))
  .catch(console.error);
