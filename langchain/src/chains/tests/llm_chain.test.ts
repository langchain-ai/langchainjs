import { test, jest, expect } from "@jest/globals";
import {
  ChatPromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { LLM } from "../../llms/base.js";
import { CommaSeparatedListOutputParser } from "../../output_parsers/list.js";
import { SimpleChatModel } from "../../chat_models/base.js";
import { BaseChatMessage } from "../../schema/index.js";

class FakeLLM extends LLM {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(fields?: any) {
    super(fields ?? {});

    this._call = jest.fn(() => Promise.resolve("a completion"));
  }

  _llmType(): string {
    return "fake";
  }

  _call(_: string) {
    return Promise.resolve("a completion");
  }
}

class FakeChatModel extends SimpleChatModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(fields?: any) {
    super(fields ?? {});

    this._call = jest.fn(() => Promise.resolve("a completion"));
  }

  _llmType(): string {
    return "fake";
  }

  _call(_: BaseChatMessage[]) {
    return Promise.resolve("a completion");
  }
}

test("Test without output_parser", async () => {
  const model = new FakeLLM();
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.call({ foo: "my favorite color" });

  expect(res).toEqual({ [chain.outputKey]: "a completion" });
  expect(model._call).toHaveBeenCalledWith(
    "Print my favorite color",
    undefined
  );
});

test("Test with output_parser without format_instructions", async () => {
  const model = new FakeLLM();
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
    outputParser: new CommaSeparatedListOutputParser(),
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.call({ foo: "my favorite color" });

  expect(res).toEqual({ [chain.outputKey]: "a completion" });
  expect(model._call).toHaveBeenCalledWith(
    "Print my favorite color",
    undefined
  );
});

test("Test with output_parser with format_instructions", async () => {
  const model = new FakeLLM();
  const prompt = new PromptTemplate({
    template: "Print {foo}\n{format_instructions}",
    inputVariables: ["foo", "format_instructions"],
    outputParser: new CommaSeparatedListOutputParser(),
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.call({ foo: "my favorite color" });

  expect(res).toEqual({ [chain.outputKey]: "a completion" });
  expect(model._call).toHaveBeenCalledWith(
    "Print my favorite color\nYour response should be a list of comma separated values, eg: `foo, bar, baz`",
    undefined
  );
});

test("Test with output_parser with format_instructions with ChatMessagesPrompt", async () => {
  const model = new FakeChatModel();
  const prompt = new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(
        "You are a chat assistant\n{format_instructions}"
      ),
      HumanMessagePromptTemplate.fromTemplate("What is {foo}"),
    ],
    inputVariables: ["foo", "format_instructions"],
    outputParser: new CommaSeparatedListOutputParser(),
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.call({ foo: "my favorite color" });

  expect(res).toEqual({ [chain.outputKey]: "a completion" });
  expect(model._call).toHaveBeenCalledWith(
    [
      {
        text: "You are a chat assistant\nYour response should be a list of comma separated values, eg: `foo, bar, baz`",
      },
      { text: "What is my favorite color" },
    ],
    undefined
  );
});
