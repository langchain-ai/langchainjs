import { expect, test } from "@jest/globals";

import { StructuredOutputParser } from "../structured.js";
import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { LLMChain } from "../../chains/index.js";
import {
  ChatPromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";

test("StructuredOutputParser deals special chars in prompt with llm model", async () => {
  const model = new OpenAI({
    temperature: 0,
  });

  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    question1: "a very on-topic question",
    question2: "a super weird question",
    question3: "an on-topic, but slightly creative",
  });

  const prompt = new PromptTemplate({
    template: "context:\n{context}\n---{format_instructions}",
    inputVariables: ["context"],
    partialVariables: {
      format_instructions: parser.getFormatInstructions(),
    },
  });

  const chain = new LLMChain({
    llm: model,
    prompt,
    outputParser: parser,
    outputKey: "questions",
  });

  const result = await chain.call({
    context: `The U2 ur-myth begins in 1976, when drummer Larry Mullen wanted to form a band.
      He picked four school friends from Mount Temple Comprehensive School in Dublin.
      “Larry formed U2,” says Paul McGuinness, U2’s manager from the beginning. “He
      auditioned the other three and he chose them. The first name of U2 was the Larry
      Mullen band,” McGuinness laughs. “And he never lets us forget it.” `,
  });

  console.log("response", result);

  expect(result.questions).toHaveProperty("question1");
  expect(result.questions).toHaveProperty("question2");
  expect(result.questions).toHaveProperty("question3");
});

test("StructuredOutputParser deals special chars in prompt with chat model", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
  });

  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    question1: "a very on-topic question",
    question2: "a super weird question",
    question3: "an on-topic, but slightly creative",
  });

  const prompt = new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate("context:\n{context}\n---"),
      SystemMessagePromptTemplate.fromTemplate(`{format_instructions}`),
    ],
    inputVariables: ["context"],
    partialVariables: {
      format_instructions: parser.getFormatInstructions(),
    },
  });

  const chain = new LLMChain({
    llm: model,
    prompt,
    outputParser: parser,
    outputKey: "questions",
  });

  const result = await chain.call({
    context: `The U2 ur-myth begins in 1976, when drummer Larry Mullen wanted to form a band.
        He picked four school friends from Mount Temple Comprehensive School in Dublin.
        “Larry formed U2,” says Paul McGuinness, U2’s manager from the beginning. “He
        auditioned the other three and he chose them. The first name of U2 was the Larry
        Mullen band,” McGuinness laughs. “And he never lets us forget it.” `,
  });

  console.log("response", result);

  expect(result.questions).toHaveProperty("question1");
  expect(result.questions).toHaveProperty("question2");
  expect(result.questions).toHaveProperty("question3");
});

test("StructuredOutputParser deals special chars in prompt with chat model 2", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
  });

  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    question1: "a very on-topic question",
    question2: "a super weird question",
    question3: "an on-topic, but slightly creative",
  });

  const prompt = new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate("context:\n{context}\n---"),
      SystemMessagePromptTemplate.fromTemplate(`{format_instructions}`),
    ],
    inputVariables: ["context"],
    partialVariables: {
      format_instructions: parser.getFormatInstructions(),
    },
  });

  const chain = new LLMChain({
    llm: model,
    prompt,
    outputKey: "questions",
  });

  const result = await chain.call({
    context: `The U2 ur-myth begins in 1976, when drummer Larry Mullen wanted to form a band.
          He picked four school friends from Mount Temple Comprehensive School in Dublin.
          “Larry formed U2,” says Paul McGuinness, U2’s manager from the beginning. “He
          auditioned the other three and he chose them. The first name of U2 was the Larry
          Mullen band,” McGuinness laughs. “And he never lets us forget it.” `,
  });

  console.log("response", result);
  const parsed = await parser.parse(result.questions);

  expect(parsed).toHaveProperty("question1");
  expect(parsed).toHaveProperty("question2");
  expect(parsed).toHaveProperty("question3");
});
