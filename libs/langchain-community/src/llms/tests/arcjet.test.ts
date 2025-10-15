import { test } from "@jest/globals";
import {
  LLM,
  type BaseLLMCallOptions,
} from "@langchain/core/language_models/llms";
import { ArcjetRedact } from "../arcjet.js";

// Mock LLM for testing purposes
export class MockLLM extends LLM {
  static lc_name() {
    return "MockLLM";
  }

  lc_serializable = true;

  callback?: (input: string) => string;

  constructor(callback?: (input: string) => string) {
    super({});
    this.callback = callback;
  }

  _llmType() {
    return "mock_llm";
  }

  async _call(input: string, _options?: BaseLLMCallOptions): Promise<string> {
    if (typeof this.callback !== "undefined") {
      return this.callback(input);
    } else {
      throw new Error("no callback");
    }
  }
}

test("It calls the base LLM correctly", async () => {
  const callback = (input: string) => {
    expect(input).toEqual("this is the input");
    return "this is the output";
  };
  const mockLLM = new MockLLM(callback);
  const options = {
    llm: mockLLM,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke("this is the input");

  expect(output).toEqual("this is the output");
});

test("It performs redactions and unredactions", async () => {
  const callback = (input: string) => {
    expect(input).toEqual("email <Redacted email #0>");
    return "your email is <Redacted email #0>";
  };
  const mockLLM = new MockLLM(callback);
  const options = {
    llm: mockLLM,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke("email test@example.com");

  expect(output).toEqual("your email is test@example.com");
});

test("It only redacts configured entities", async () => {
  const callback = (input: string) => {
    expect(input).toEqual(
      "email test@example.com phone <Redacted phone number #0>"
    );
    return "your phone number is <Redacted phone number #0>";
  };
  const mockLLM = new MockLLM(callback);
  const options = {
    llm: mockLLM,
    entities: ["phone-number" as const],
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke(
    "email test@example.com phone +35312345678"
  );

  expect(output).toEqual("your phone number is +35312345678");
});

test("It redacts custom entities", async () => {
  const callback = (input: string) => {
    expect(input).toEqual("custom <Redacted custom-entity #0>");
    return "custom is <Redacted custom-entity #0>";
  };
  const mockLLM = new MockLLM(callback);
  const customDetector = (tokens: string[]) => {
    return tokens.map((t) =>
      t === "my-custom-string-to-be-detected" ? "custom-entity" : undefined
    );
  };
  const options = {
    llm: mockLLM,
    entities: ["custom-entity" as const],
    detect: customDetector,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke(
    "custom my-custom-string-to-be-detected"
  );

  expect(output).toEqual("custom is my-custom-string-to-be-detected");
});

test("It provides the correct number of tokens to the context window", async () => {
  const callback = (input: string) => {
    expect(input).toEqual("this is a sentence for testing");
    return "this is a sentence for testing";
  };
  const mockLLM = new MockLLM(callback);
  const customDetector = (tokens: string[]) => {
    expect(tokens).toHaveLength(4);
    return tokens.map(() => undefined);
  };
  const options = {
    llm: mockLLM,
    entities: ["email" as const],
    detect: customDetector,
    contextWindowSize: 4,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke("this is a sentence for testing");

  expect(output).toEqual("this is a sentence for testing");
});

test("It uses custom replacers", async () => {
  const callback = (input: string) => {
    expect(input).toEqual(
      "custom <Redacted custom-entity #0> email redacted@example.com"
    );
    return "custom is <Redacted custom-entity #0> email is redacted@example.com";
  };
  const mockLLM = new MockLLM(callback);
  const customDetector = (tokens: string[]) => {
    return tokens.map((t) =>
      t === "my-custom-string-to-be-detected" ? "custom-entity" : undefined
    );
  };
  const customReplacer = (detected: string) => {
    return detected === "email" ? "redacted@example.com" : undefined;
  };
  const options = {
    llm: mockLLM,
    entities: ["custom-entity" as const, "email" as const],
    detect: customDetector,
    replace: customReplacer,
  };

  const arcjetRedact = new ArcjetRedact(options);
  const output = await arcjetRedact.invoke(
    "custom my-custom-string-to-be-detected email test@example.com"
  );

  expect(output).toEqual(
    "custom is my-custom-string-to-be-detected email is test@example.com"
  );
});

test("It throws when no entities are configured", async () => {
  const mockLLM = new MockLLM();
  const options = {
    llm: mockLLM,
    entities: [],
  };

  expect(() => {
    new ArcjetRedact(options);
  }).toThrow("no entities configured for redaction");
});
