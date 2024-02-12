import { expect, test } from "@jest/globals";
import {
  AIMessage,
  BaseMessageLike,
  HumanMessage,
  MessageContentComplex,
  MessageContentText,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGoogleBase, ChatGoogleBaseInput } from "../chat_models.js";
import { authOptions, MockClient, MockClientAuthInfo, mockId } from "./mock.js";
import { GoogleAIBaseLLMInput } from "../types.js";
import { GoogleAbstractedClient } from "../auth.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

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
    await model.call(messages);

    expect(record?.opts?.headers).toHaveProperty("User-Agent");
    expect(record.opts.headers["User-Agent"]).toMatch(
      /langchain-js\/[0-9.]+-ChatConnection/
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
    const result = await model.call(messages);
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
    const result = await model.call(messages);

    expect(result._getType()).toEqual("ai");
    const aiMessage = result as AIMessage;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content.length).toBeGreaterThanOrEqual(1);
    expect(aiMessage.content[0]).toHaveProperty("type");

    const complexContent = aiMessage.content[0] as MessageContentComplex;
    expect(complexContent.type).toEqual("text");
    const content = complexContent as MessageContentText;
    expect(content.text).toEqual("T");
  });

  // SystemMessages will be turned into the human request with the prompt
  // from the system message and a faked ai response saying "Ok".
  test("1. System request format", async () => {
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
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.call(messages);
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
  });

  test("2. Blocked response", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-2-mock.json",
    };

    const model = new ChatGoogle({
      model: "gemini-pro",
      authOptions,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["human", "dangerous content"],
    ]);

    const result = await prompt
      .pipe(model)
      .pipe(new StringOutputParser())
      .invoke({});

    // console.log("record", JSON.stringify(record, null, 1));
    console.log("result", JSON.stringify(result, null, 1));
  });
});
