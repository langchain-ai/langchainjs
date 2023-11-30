import { expect, test } from "@jest/globals";
import {
  FewShotChatMessagePromptTemplate,
  FewShotPromptTemplate,
} from "../few_shot.js";
import { ChatPromptTemplate } from "../index.js";
import { PromptTemplate } from "../prompt.js";
import { LengthBasedExampleSelector } from "../../example_selectors/length_based.js";
import { AIMessage, HumanMessage } from "../../messages/index.js";

describe("FewShotPromptTemplate", () => {
  test("Test using partial", async () => {
    const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
    const prompt = new FewShotPromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo"],
      partialVariables: { bar: "baz" },
    });
    expect(await prompt.format({ foo: "foo" })).toBe("foobaz\n");
  });

  test("Test using full partial", async () => {
    const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
    const prompt = new FewShotPromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: [],
      partialVariables: { bar: "baz", foo: "boo" },
    });
    expect(await prompt.format({})).toBe("boobaz\n");
  });

  test("Test partial with string", async () => {
    const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
    const prompt = new FewShotPromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo", "bar"],
    });

    const partialPrompt = await prompt.partial({ foo: "foo" });
    expect(await partialPrompt.format({ bar: "baz" })).toBe("foobaz\n");
    expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  });

  test("Test partial with function", async () => {
    const examplePrompt = PromptTemplate.fromTemplate("{foo}{bar}");
    const prompt = new FewShotPromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo", "bar"],
    });

    const partialPrompt = await prompt.partial({
      foo: () => Promise.resolve("boo"),
    });
    expect(await partialPrompt.format({ bar: "baz" })).toBe("boobaz\n");
  });

  test("Test partial with function and examples", async () => {
    const examplePrompt = PromptTemplate.fromTemplate("An example about {x}");
    const prompt = new FewShotPromptTemplate({
      prefix: "{foo}{bar}",
      examples: [{ x: "foo" }, { x: "bar" }],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo", "bar"],
    });

    const partialPrompt = await prompt.partial({
      foo: () => Promise.resolve("boo"),
    });
    expect(await partialPrompt.format({ bar: "baz" })).toBe(
      `boobaz
An example about foo
An example about bar
`
    );
  });

  test("Test partial with function and example selector", async () => {
    const examplePrompt = PromptTemplate.fromTemplate("An example about {x}");
    const exampleSelector = await LengthBasedExampleSelector.fromExamples(
      [{ x: "foo" }, { x: "bar" }],
      { examplePrompt, maxLength: 200 }
    );
    const prompt = new FewShotPromptTemplate({
      prefix: "{foo}{bar}",
      exampleSelector,
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo", "bar"],
    });

    const partialPrompt = await prompt.partial({
      foo: () => Promise.resolve("boo"),
    });
    expect(await partialPrompt.format({ bar: "baz" })).toBe(
      `boobaz
An example about foo
An example about bar
`
    );
  });
});

describe("FewShotChatMessagePromptTemplate", () => {
  test("Format messages", async () => {
    const examplePrompt = ChatPromptTemplate.fromMessages([
      ["ai", "{ai_input_var}"],
      ["human", "{human_input_var}"],
    ]);
    const examples = [
      {
        ai_input_var: "ai-foo",
        human_input_var: "human-bar",
      },
      {
        ai_input_var: "ai-foo2",
        human_input_var: "human-bar2",
      },
    ];
    const prompt = new FewShotChatMessagePromptTemplate({
      examplePrompt,
      inputVariables: ["ai_input_var", "human_input_var"],
      examples,
    });
    const messages = await prompt.formatMessages({});
    expect(messages).toEqual([
      new AIMessage("ai-foo"),
      new HumanMessage("human-bar"),
      new AIMessage("ai-foo2"),
      new HumanMessage("human-bar2"),
    ]);
  });

  test("Test using partial", async () => {
    const examplePrompt = ChatPromptTemplate.fromMessages([
      ["ai", "{foo}{bar}"],
    ]);
    const prompt = new FewShotChatMessagePromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo"],
      partialVariables: { bar: "baz" },
    });
    expect(await prompt.format({ foo: "foo" })).toBe("foobaz\n");
  });

  test("Test using full partial", async () => {
    const examplePrompt = ChatPromptTemplate.fromMessages([
      ["ai", "{foo}{bar}"],
    ]);
    const prompt = new FewShotChatMessagePromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: [],
      partialVariables: { bar: "baz", foo: "boo" },
    });
    expect(await prompt.format({})).toBe("boobaz\n");
  });

  test("Test partial with string", async () => {
    const examplePrompt = ChatPromptTemplate.fromMessages([
      ["ai", "{foo}{bar}"],
    ]);
    const prompt = new FewShotChatMessagePromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo", "bar"],
    });

    const partialPrompt = await prompt.partial({ foo: "foo" });
    expect(await partialPrompt.format({ bar: "baz" })).toBe("foobaz\n");
    expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  });

  test("Test partial with function", async () => {
    const examplePrompt = ChatPromptTemplate.fromMessages([
      ["ai", "{foo}{bar}"],
    ]);
    const prompt = new FewShotChatMessagePromptTemplate({
      prefix: "{foo}{bar}",
      examples: [],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo", "bar"],
    });

    const partialPrompt = await prompt.partial({
      foo: () => Promise.resolve("boo"),
    });
    expect(await partialPrompt.format({ bar: "baz" })).toBe("boobaz\n");
  });

  test("Test partial with function and examples", async () => {
    const examplePrompt = ChatPromptTemplate.fromMessages([
      ["ai", "An example about {x}"],
    ]);
    const prompt = new FewShotChatMessagePromptTemplate({
      prefix: "{foo}{bar}",
      examples: [{ x: "foo" }, { x: "bar" }],
      suffix: "",
      templateFormat: "f-string",
      exampleSeparator: "\n",
      examplePrompt,
      inputVariables: ["foo", "bar"],
    });

    const partialPrompt = await prompt.partial({
      foo: () => Promise.resolve("boo"),
    });
    expect(await partialPrompt.format({ bar: "baz" })).toBe(
      `boobaz
An example about foo
An example about bar
`
    );
  });
});
