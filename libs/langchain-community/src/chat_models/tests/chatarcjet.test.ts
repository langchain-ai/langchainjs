import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseMessage, MessageType } from "@langchain/core/messages";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import { ArcjetRedact } from "../arcjet.js";

class MockChatModel extends BaseChatModel {
  callback?: (input: BaseMessage[]) => ChatGeneration[];

  constructor(callback?: (input: BaseMessage[]) => ChatGeneration[]) {
    super({});
    this.callback = callback;
  }

  _llmType(): string {
    return "mock_chat_model";
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    return {
      generations: this.callback ? this.callback(messages) : [],
    };
  }
}

class GenericMessage extends BaseMessage {
  constructor(text: string) {
    super(text);
  }

  _getType(): MessageType {
    return "human";
  }
}

test("It passes messages through correctly", async () => {
  const generationA = {
    message: new GenericMessage("this is the output"),
    text: "this is the output",
  };

  const callback = (input: BaseMessage[]) => {
    expect(input[0].content).toEqual("this is the input");
    expect(input[1].content).toEqual("this is a second input");
    return [generationA];
  };
  const mockLLM = new MockChatModel(callback);
  const options = {
    chatModel: mockLLM,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke([
    "this is the input",
    "this is a second input",
  ]);

  expect(output.content).toEqual("this is the output");
});

test("It passes messages through correctly in the streaming interface", async () => {
  const generationA = {
    message: new GenericMessage("this is the output"),
    text: "this is the output",
  };

  const callback = (input: BaseMessage[]) => {
    expect(input[0].content).toEqual("this is the input");
    expect(input[1].content).toEqual("this is a second input");
    return [generationA];
  };
  const mockLLM = new MockChatModel(callback);
  const options = {
    chatModel: mockLLM,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const stream = await arcjetRedact.stream([
    "this is the input",
    "this is a second input",
  ]);

  const output = await stream.next();

  expect(output.value.content).toEqual("this is the output");
});

test("It redacts built in entities across multiple messages and unredacts them in the response", async () => {
  const generationA = {
    message: new GenericMessage(
      "Your email is <Redacted email #1> and your card number is <Redacted credit card number #2>"
    ),
    text: "Your email is <Redacted email #1> and your card number is <Redacted credit card number #2>",
  };

  const callback = (input: BaseMessage[]) => {
    expect(input[0].content).toEqual("my email address is <Redacted email #1>");
    expect(input[1].content).toEqual(
      "my card number is <Redacted credit card number #2>"
    );
    return [generationA];
  };

  const mockLLM = new MockChatModel(callback);
  const options = {
    chatModel: mockLLM,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.stream([
    "my email address is test@example.com",
    "my card number is 4242424242424242",
  ]);

  const first = await output.next();
  expect(first.value.content).toEqual(
    "Your email is test@example.com and your card number is 4242424242424242"
  );
});

test("it redacts and unredacts correctly", async () => {
  const generationA = {
    message: new GenericMessage(
      "Your email is <Redacted email #1> and your card number is <Redacted credit card number #2>"
    ),
    text: "Your email is <Redacted email #1> and your card number is <Redacted credit card number #2>",
  };

  const callback = (input: BaseMessage[]) => {
    expect(input[0].content).toEqual("my email address is <Redacted email #1>");
    expect(input[1].content).toEqual(
      "my card number is <Redacted credit card number #2>"
    );
    return [generationA];
  };

  const mockLLM = new MockChatModel(callback);
  const options = {
    chatModel: mockLLM,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.stream([
    "my email address is test@example.com",
    "my card number is 4242424242424242",
  ]);

  const first = await output.next();
  expect(first.value.content).toEqual(
    "Your email is test@example.com and your card number is 4242424242424242"
  );
});

test("it redacts and unredacts correctly", async () => {
  const generationA = {
    message: new GenericMessage(
      "Your email is <Redacted email #1> and your card number is <Redacted credit card number #2>"
    ),
    text: "Your email is <Redacted email #1> and your card number is <Redacted credit card number #2>",
  };

  const callback = (input: BaseMessage[]) => {
    expect(input[0].content).toEqual("my email address is <Redacted email #1>");
    expect(input[1].content).toEqual(
      "my card number is <Redacted credit card number #2>"
    );
    return [generationA];
  };

  const mockLLM = new MockChatModel(callback);
  const options = {
    chatModel: mockLLM,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke([
    "my email address is test@example.com",
    "my card number is 4242424242424242",
  ]);

  expect(output.content).toEqual(
    "Your email is test@example.com and your card number is 4242424242424242"
  );
});

test("it handles custom detect functions correctly", async () => {
  const generationA = {
    message: new GenericMessage("custom <Redacted custom-entity #1>"),
    text: "custom <Redacted custom-entity #0>",
  };

  const callback = (input: BaseMessage[]) => {
    expect(input[0].content).toEqual("custom <Redacted custom-entity #1>");
    return [generationA];
  };

  const mockLLM = new MockChatModel(callback);
  const customDetector = (tokens: string[]) => {
    return tokens.map((t) =>
      t === "my-custom-string-to-be-detected" ? "custom-entity" : undefined
    );
  };
  const options = {
    chatModel: mockLLM,
    entities: ["custom-entity" as const],
    detect: customDetector,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke([
    "custom my-custom-string-to-be-detected",
  ]);

  expect(output.content).toEqual("custom my-custom-string-to-be-detected");
});

test("it handles custom replace functions correctly", async () => {
  const generationA = {
    message: new GenericMessage(
      "custom is <Redacted custom-entity #1> email is redacted@example.com"
    ),
    text: "custom is <Redacted custom-entity #1> email is redacted@example.com",
  };

  const callback = (input: BaseMessage[]) => {
    expect(input[0].content).toEqual(
      "custom <Redacted custom-entity #1> email redacted@example.com"
    );
    return [generationA];
  };

  const mockLLM = new MockChatModel(callback);
  const customDetector = (tokens: string[]) => {
    return tokens.map((t) =>
      t === "my-custom-string-to-be-detected" ? "custom-entity" : undefined
    );
  };
  const customReplacer = (detected: string) => {
    return detected === "email" ? "redacted@example.com" : undefined;
  };
  const options = {
    chatModel: mockLLM,
    entities: ["custom-entity" as const, "email" as const],
    detect: customDetector,
    replace: customReplacer,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke([
    "custom my-custom-string-to-be-detected email test@example.com",
  ]);

  expect(output.content).toEqual(
    "custom is my-custom-string-to-be-detected email is test@example.com"
  );
});
