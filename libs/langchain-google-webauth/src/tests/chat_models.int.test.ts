import { expect, test } from "@jest/globals";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  BaseMessageLike,
  HumanMessage,
  // MessageContentComplex,
  // MessageContentText,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { GeminiTool, GoogleAISafetySetting } from "@langchain/google-common";
import { ChatGoogle } from "../chat_models.js";

describe("Google APIKey Chat", () => {
  test("invoke", async () => {
    const model = new ChatGoogle();
    try {
      const res = await model.invoke(
        "What is the answer to life the universe and everything? Answer briefly."
      );
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content).toBe("42");
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("generate", async () => {
    const safetySettings: GoogleAISafetySetting[] = [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ];
    const model = new ChatGoogle({ safetySettings });
    try {
      const messages: BaseMessage[] = [
        new SystemMessage(
          "You will reply to all requests to toss a coin with either H, indicating heads, or T, indicating tails."
        ),
        new HumanMessage("Toss the coin"),
        new AIMessage("T"),
        new HumanMessage("Toss the coin again"),
      ];
      const res = await model.predictMessages(messages);
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();
      expect(["H", "T"]).toContainEqual(aiMessage.content);
    } catch (e) {
      console.error(JSON.stringify(e, null, 1));
      throw e;
    }
  });

  test("stream", async () => {
    const safetySettings: GoogleAISafetySetting[] = [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ];
    const model = new ChatGoogle({ safetySettings });
    try {
      const input: BaseLanguageModelInput = new ChatPromptValue([
        new SystemMessage(
          "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
        ),
        new HumanMessage("Flip the coin"),
        new AIMessage("T"),
        new HumanMessage("Flip the coin again"),
      ]);
      const res = await model.stream(input);
      const resArray: BaseMessageChunk[] = [];
      for await (const chunk of res) {
        resArray.push(chunk);
      }
      expect(resArray).toBeDefined();
      expect(resArray.length).toBeGreaterThanOrEqual(1);

      const lastChunk = resArray[resArray.length - 1];
      expect(lastChunk).toBeDefined();
      expect(lastChunk._getType()).toEqual("ai");
      const aiChunk = lastChunk as AIMessageChunk;
      console.log(aiChunk);

      console.log(JSON.stringify(resArray, null, 2));
    } catch (e) {
      console.error(JSON.stringify(e, null, 1));
      throw e;
    }
  });

  test("function", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];
    const model = new ChatGoogle().bind({ tools });
    const result = await model.invoke("Run a test on the cobalt project");
    expect(result).toHaveProperty("content");
    expect(result.content).toBe("");
    const args = result?.lc_kwargs?.additional_kwargs;
    expect(args).toBeDefined();
    expect(args).toHaveProperty("tool_calls");
    expect(Array.isArray(args.tool_calls)).toBeTruthy();
    expect(args.tool_calls).toHaveLength(1);
    const call = args.tool_calls[0];
    expect(call).toHaveProperty("type");
    expect(call.type).toBe("function");
    expect(call).toHaveProperty("function");
    const func = call.function;
    expect(func).toBeDefined();
    expect(func).toHaveProperty("name");
    expect(func.name).toBe("test");
    expect(func).toHaveProperty("arguments");
    expect(typeof func.arguments).toBe("string");
    expect(func.arguments.replaceAll("\n", "")).toBe('{"testName":"cobalt"}');
  });

  test("function reply", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];
    const model = new ChatGoogle().bind({ tools });
    const toolResult = {
      testPassed: true,
    };
    const messages: BaseMessageLike[] = [
      new HumanMessage("Run a test on the cobalt project."),
      new AIMessage("", {
        tool_calls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "test",
              arguments: '{"testName":"cobalt"}',
            },
          },
        ],
      }),
      new ToolMessage(JSON.stringify(toolResult), "test"),
    ];
    const res = await model.stream(messages);
    const resArray: BaseMessageChunk[] = [];
    for await (const chunk of res) {
      resArray.push(chunk);
    }
    console.log(JSON.stringify(resArray, null, 2));
  });

  test("withStructuredOutput", async () => {
    const tool = {
      name: "get_weather",
      description:
        "Get the weather of a specific location and return the temperature in Celsius.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The name of city to get the weather for.",
          },
        },
        required: ["location"],
      },
    };
    const model = new ChatGoogle().withStructuredOutput(tool);
    const result = await model.invoke("What is the weather in Paris?");
    expect(result).toHaveProperty("location");
  });
});

describe("Google Webauth Chat", () => {
  test("invoke", async () => {
    const model = new ChatGoogle();
    try {
      const res = await model.invoke("What is 1 + 1?");
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

      /*
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();
      const content = aiMessage.content[0] as MessageContentComplex;
      expect(content).toHaveProperty("type");
      expect(content.type).toEqual("text");

      const textContent = content as MessageContentText;
      expect(textContent.text).toBeDefined();
      expect(textContent.text).toEqual("2");
      */
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("generate", async () => {
    const model = new ChatGoogle();
    try {
      const messages: BaseMessage[] = [
        new SystemMessage(
          "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
        ),
        new HumanMessage("Flip it"),
        new AIMessage("T"),
        new HumanMessage("Flip the coin again"),
      ];
      const res = await model.predictMessages(messages);
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(["H", "T"]).toContainEqual(text);

      /*
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();

      const content = aiMessage.content[0] as MessageContentComplex;
      expect(content).toHaveProperty("type");
      expect(content.type).toEqual("text");

      const textContent = content as MessageContentText;
      expect(textContent.text).toBeDefined();
      expect(["H", "T"]).toContainEqual(textContent.text);
      */
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("stream", async () => {
    const model = new ChatGoogle();
    try {
      const input: BaseLanguageModelInput = new ChatPromptValue([
        new SystemMessage(
          "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
        ),
        new HumanMessage("Flip it"),
        new AIMessage("T"),
        new HumanMessage("Flip the coin again"),
      ]);
      const res = await model.stream(input);
      const resArray: BaseMessageChunk[] = [];
      for await (const chunk of res) {
        resArray.push(chunk);
      }
      expect(resArray).toBeDefined();
      expect(resArray.length).toBeGreaterThanOrEqual(1);

      const lastChunk = resArray[resArray.length - 1];
      expect(lastChunk).toBeDefined();
      expect(lastChunk._getType()).toEqual("ai");
      const aiChunk = lastChunk as AIMessageChunk;
      console.log(aiChunk);

      console.log(JSON.stringify(resArray, null, 2));
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("function", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];
    const model = new ChatGoogle().bind({
      tools,
    });
    const result = await model.invoke("Run a test on the cobalt project");
    expect(result).toHaveProperty("content");
    const args = result?.lc_kwargs?.additional_kwargs;
    expect(args).toBeDefined();
    expect(args).toHaveProperty("tool_calls");
    expect(Array.isArray(args.tool_calls)).toBeTruthy();
    expect(args.tool_calls).toHaveLength(1);
    const call = args.tool_calls[0];
    expect(call).toHaveProperty("type");
    expect(call.type).toBe("function");
    expect(call).toHaveProperty("function");
    const func = call.function;
    expect(func).toBeDefined();
    expect(func).toHaveProperty("name");
    expect(func.name).toBe("test");
    expect(func).toHaveProperty("arguments");
    expect(typeof func.arguments).toBe("string");
    expect(func.arguments.replaceAll("\n", "")).toBe('{"testName":"cobalt"}');
  });

  test("function reply", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];
    const model = new ChatGoogle().bind({
      tools,
    });
    const toolResult = {
      testPassed: true,
    };
    const messages: BaseMessageLike[] = [
      new HumanMessage("Run a test on the cobalt project."),
      new AIMessage("", {
        tool_calls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "test",
              arguments: '{"testName":"cobalt"}',
            },
          },
        ],
      }),
      new ToolMessage(JSON.stringify(toolResult), "test"),
    ];
    const res = await model.stream(messages);
    const resArray: BaseMessageChunk[] = [];
    for await (const chunk of res) {
      resArray.push(chunk);
    }
    console.log(JSON.stringify(resArray, null, 2));
  });
});
