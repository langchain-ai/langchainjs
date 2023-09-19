import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "../chat.js";
import { PipelinePromptTemplate } from "../pipeline.js";

test("Test pipeline input variables", async () => {
  const prompt = new PipelinePromptTemplate({
    pipelinePrompts: [
      {
        name: "bar",
        prompt: PromptTemplate.fromTemplate("{foo}"),
      },
    ],
    finalPrompt: PromptTemplate.fromTemplate("{bar}"),
  });
  expect(prompt.inputVariables).toEqual(["foo"]);
});

test("Test simple pipeline", async () => {
  const prompt = new PipelinePromptTemplate({
    pipelinePrompts: [
      {
        name: "bar",
        prompt: PromptTemplate.fromTemplate("{foo}"),
      },
    ],
    finalPrompt: PromptTemplate.fromTemplate("{bar}"),
  });
  expect(
    await prompt.format({
      foo: "jim",
    })
  ).toEqual("jim");
});

test("Test multi variable pipeline", async () => {
  const prompt = new PipelinePromptTemplate({
    pipelinePrompts: [
      {
        name: "bar",
        prompt: PromptTemplate.fromTemplate("{foo}"),
      },
    ],
    finalPrompt: PromptTemplate.fromTemplate("okay {bar} {baz}"),
  });
  expect(
    await prompt.format({
      foo: "jim",
      baz: "halpert",
    })
  ).toEqual("okay jim halpert");
});

test("Test longer pipeline", async () => {
  const prompt = new PipelinePromptTemplate({
    pipelinePrompts: [
      {
        name: "bar",
        prompt: PromptTemplate.fromTemplate("{foo}"),
      },
      {
        name: "qux",
        prompt: PromptTemplate.fromTemplate("hi {bar}"),
      },
    ],
    finalPrompt: PromptTemplate.fromTemplate("okay {qux} {baz}"),
  });
  expect(
    await prompt.format({
      foo: "pam",
      baz: "beasley",
    })
  ).toEqual("okay hi pam beasley");
});

test("Test with .partial", async () => {
  const prompt = new PipelinePromptTemplate({
    pipelinePrompts: [
      {
        name: "bar",
        prompt: PromptTemplate.fromTemplate("{foo}"),
      },
    ],
    finalPrompt: PromptTemplate.fromTemplate("okay {bar} {baz}"),
  });
  const partialPrompt = await prompt.partial({
    baz: "schrute",
  });
  expect(
    await partialPrompt.format({
      foo: "dwight",
    })
  ).toEqual("okay dwight schrute");
});

test("Test with chat prompts", async () => {
  const prompt = new PipelinePromptTemplate({
    pipelinePrompts: [
      {
        name: "foo",
        prompt: ChatPromptTemplate.fromMessages([
          HumanMessagePromptTemplate.fromTemplate(`{name} halpert`),
        ]),
      },
    ],
    finalPrompt: ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate("What is your name?"),
      new MessagesPlaceholder("foo"),
    ]),
  });
  const formattedPromptValue = await prompt.formatPromptValue({
    name: "pam",
  });
  expect(formattedPromptValue.messages[1].content).toEqual("pam halpert");
});
