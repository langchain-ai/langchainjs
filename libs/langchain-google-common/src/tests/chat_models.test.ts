import { expect, test } from "@jest/globals";
import {
  AIMessage,
  BaseMessage,
  BaseMessageLike,
  HumanMessage,
  HumanMessageChunk,
  MessageContentComplex,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

import { ChatGoogleBase, ChatGoogleBaseInput } from "../chat_models.js";
import { authOptions, MockClient, MockClientAuthInfo, mockId } from "./mock.js";
import { GeminiTool, GoogleAIBaseLLMInput } from "../types.js";
import { GoogleAbstractedClient } from "../auth.js";
import { GoogleAISafetyError } from "../utils/safety.js";

class ChatGoogle extends ChatGoogleBase<MockClientAuthInfo> {
  constructor(fields?: ChatGoogleBaseInput<MockClientAuthInfo>) {
    super(fields);
  }

  buildAbstractedClient(
    fields?: GoogleAIBaseLLMInput<MockClientAuthInfo>
  ): GoogleAbstractedClient {
    const options = authOptions(fields);
    return new MockClient(options);
  }
}

describe("Mock ChatGoogle", () => {
  test("Setting invalid model parameters", async () => {
    expect(() => {
      const model = new ChatGoogle({
        temperature: 1.2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/temperature/);

    expect(() => {
      const model = new ChatGoogle({
        topP: -2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topP/);

    expect(() => {
      const model = new ChatGoogle({
        topP: 2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topP/);

    expect(() => {
      const model = new ChatGoogle({
        topK: -2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topK/);
  });

  test("user agent header", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record?.opts?.headers).toHaveProperty("User-Agent");
    expect(record?.opts?.headers).toHaveProperty("Client-Info");
    expect(record.opts.headers["User-Agent"]).toMatch(
      /langchain-js\/[0-9.]+-ChatConnection/
    );
    expect(record.opts.headers["Client-Info"]).toMatch(
      /\d+(\.\d+)?-ChatConnection/ // Since we are not getting libraryVersion from env right now, it will always be 0
    );
  });

  test("platform default", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new ChatGoogle({
      authOptions,
    });

    expect(model.platform).toEqual("gcp");
  });

  test("platform set", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gai",
    });

    expect(model.platform).toEqual("gai");
  });

  test("1. Basic request format", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);
    console.log("record", JSON.stringify(record, null, 1));
    console.log("result", JSON.stringify(result, null, 1));

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toBeDefined();
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. Invoke request format", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);
    console.log("record", JSON.stringify(record, null, 1));
    console.log("result", JSON.stringify(result, null, 1));

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toBeDefined();
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. Response format", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);

    expect(result._getType()).toEqual("ai");
    const aiMessage = result as AIMessage;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content).toBe("T");
  });

  test("1. Invoke response format", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);

    expect(result._getType()).toEqual("ai");
    const aiMessage = result as AIMessage;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content).toBe("T");
  });

  // The older models don't support systemInstruction, so
  // SystemMessages will be turned into the human request with the prompt
  // from the system message and a faked ai response saying "Ok".
  test("1. System request format old model", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.0-pro-001",
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);
    console.log("record", JSON.stringify(record, null, 1));
    console.log("result", JSON.stringify(result, null, 1));

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(5);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual(
      "I will ask you to flip a coin and tell me H for heads and T for tails"
    );
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("Ok");
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. System request format convert true", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: true,
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);
    console.log("record", JSON.stringify(record, null, 1));
    console.log("result", JSON.stringify(result, null, 1));

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(5);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual(
      "I will ask you to flip a coin and tell me H for heads and T for tails"
    );
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("Ok");
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. System request format convert false", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: false,
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);
    console.log("record", JSON.stringify(record, null, 1));
    console.log("result", JSON.stringify(result, null, 1));

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual("Flip it");
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("H");
    expect(data.systemInstruction).toBeDefined();
  });

  test("1. System request format new model", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-pro",
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);
    console.log("record", JSON.stringify(record, null, 1));
    console.log("result", JSON.stringify(result, null, 1));

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual("Flip it");
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("H");
    expect(data.systemInstruction).toBeDefined();
  });

  test("1. System request - multiple", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: false,
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new SystemMessage("Now tell me Z for heads and Q for tails"),
      new HumanMessage("Flip it again"),
    ];

    let caught = false;
    try {
      const result = await model.invoke(messages);
      console.log(result);
    } catch (xx) {
      caught = true;
    }
    expect(caught).toBeTruthy();
  });

  test("1. System request - not first", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: false,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new SystemMessage("Now tell me Z for heads and Q for tails"),
      new HumanMessage("Flip it again"),
    ];

    let caught = false;
    try {
      const result = await model.invoke(messages);
      console.log(result);
    } catch (xx) {
      caught = true;
    }
    expect(caught).toBeTruthy();
  });

  test("2. Response format - safety", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-2-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    let caught = false;
    try {
      await model.invoke(messages);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (xx: any) {
      caught = true;
      expect(xx).toBeInstanceOf(GoogleAISafetyError);

      const result = xx?.reply.generations[0].message;

      expect(result._getType()).toEqual("ai");
      const aiMessage = result as AIMessage;
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content).toBe("T");
    }

    expect(caught).toEqual(true);
  });

  /*
   * Images aren't supported (yet) by Gemini, but a one-round with
   * image should work ok.
   */
  test("3. invoke - images", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-3-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      model: "gemini-pro-vision",
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=`,
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];

    const result = await model.invoke(messages);

    expect(record.opts).toHaveProperty("data");
    expect(record.opts.data).toHaveProperty("contents");
    expect(record.opts.data.contents).toHaveLength(1);
    expect(record.opts.data.contents[0]).toHaveProperty("parts");

    const parts = record?.opts?.data?.contents[0]?.parts;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty("text");
    expect(parts[1]).toHaveProperty("inlineData");
    expect(parts[1].inlineData).toHaveProperty("mimeType");
    expect(parts[1].inlineData).toHaveProperty("data");

    expect(result.content).toBe("A blue square.");
  });

  test("4. Functions Bind - Gemini format request", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

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

    const baseModel = new ChatGoogle({
      authOptions,
    });
    const model = baseModel.bind({
      tools,
    });

    const result = await model.invoke("What?");

    console.log(JSON.stringify(record, null, 1));

    expect(result).toBeDefined();

    const toolsResult = record?.opts?.data?.tools;
    expect(toolsResult).toBeDefined();
    expect(Array.isArray(toolsResult)).toBeTruthy();
    expect(toolsResult).toHaveLength(1);

    const toolResult = toolsResult[0];
    expect(toolResult).toBeDefined();
    expect(toolResult).toHaveProperty("functionDeclarations");
    expect(Array.isArray(toolResult.functionDeclarations)).toBeTruthy();
    expect(toolResult.functionDeclarations).toHaveLength(1);

    const functionDeclaration = toolResult.functionDeclarations[0];
    expect(functionDeclaration.name).toBe("test");
    expect(functionDeclaration.description).toBe(
      "Run a test with a specific name and get if it passed or failed"
    );
    expect(functionDeclaration.parameters).toBeDefined();
    expect(typeof functionDeclaration.parameters).toBe("object");

    const parameters = functionDeclaration?.parameters;
    expect(parameters.type).toBe("object");
    expect(parameters).toHaveProperty("properties");
    expect(typeof parameters.properties).toBe("object");

    expect(parameters.properties.testName).toBeDefined();
    expect(typeof parameters.properties.testName).toBe("object");
    expect(parameters.properties.testName.type).toBe("string");
    expect(parameters.properties.testName.description).toBe(
      "The name of the test that should be run."
    );

    expect(parameters.required).toBeDefined();
    expect(Array.isArray(parameters.required)).toBeTruthy();
    expect(parameters.required).toHaveLength(1);
    expect(parameters.required[0]).toBe("testName");
  });

  test("4. Functions withStructuredOutput - Gemini format request", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

    const tool = {
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
    };

    const baseModel = new ChatGoogle({
      authOptions,
    });
    const model = baseModel.withStructuredOutput(tool);

    await model.invoke("What?");

    console.log(JSON.stringify(record, null, 1));

    const toolsResult = record?.opts?.data?.tools;
    expect(toolsResult).toBeDefined();
    expect(Array.isArray(toolsResult)).toBeTruthy();
    expect(toolsResult).toHaveLength(1);

    const toolResult = toolsResult[0];
    expect(toolResult).toBeDefined();
    expect(toolResult).toHaveProperty("functionDeclarations");
    expect(Array.isArray(toolResult.functionDeclarations)).toBeTruthy();
    expect(toolResult.functionDeclarations).toHaveLength(1);

    const functionDeclaration = toolResult.functionDeclarations[0];
    expect(functionDeclaration.name).toBe("test");
    expect(functionDeclaration.description).toBe(
      "Run a test with a specific name and get if it passed or failed"
    );
    expect(functionDeclaration.parameters).toBeDefined();
    expect(typeof functionDeclaration.parameters).toBe("object");

    const parameters = functionDeclaration?.parameters;
    expect(parameters.type).toBe("object");
    expect(parameters).toHaveProperty("properties");
    expect(typeof parameters.properties).toBe("object");

    expect(parameters.properties.testName).toBeDefined();
    expect(typeof parameters.properties.testName).toBe("object");
    expect(parameters.properties.testName.type).toBe("string");
    expect(parameters.properties.testName.description).toBe(
      "The name of the test that should be run."
    );

    expect(parameters.required).toBeDefined();
    expect(Array.isArray(parameters.required)).toBeTruthy();
    expect(parameters.required).toHaveLength(1);
    expect(parameters.required[0]).toBe("testName");
  });

  test("4. Functions - results", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

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

    const model = new ChatGoogle({
      authOptions,
    }).bind({
      tools,
    });

    const result = await model.invoke("What?");

    console.log(JSON.stringify(result, null, 1));
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

  test("5. Functions - function reply", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-5-mock.json",
    };

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

    const model = new ChatGoogle({
      authOptions,
    }).bind({
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
    const result = await model.invoke(messages);
    expect(result).toBeDefined();

    console.log(JSON.stringify(record?.opts?.data, null, 1));
  });
});
