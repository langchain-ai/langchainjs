import { expect, test } from "@jest/globals";
import { z } from "zod";

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

test("StructuredOutputParser handles a longer and more complex schema", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      surname: z.string().describe("Human surname"),
      age: z.number().describe("Human age"),
      appearance: z.string().describe("Human appearance description"),
      shortBio: z.string().describe("Short bio secription"),
      university: z.string().optional().describe("University name if attended"),
      gender: z.string().describe("Gender of the human"),
      interests: z
        .array(z.string())
        .describe("json array of strings human interests"),
    })
  );

  const formatInstructions = parser.getFormatInstructions();

  const prompt = new PromptTemplate({
    template:
      "Generate details of a hypothetical person.\n{format_instructions}\nPerson description: {inputText}",
    inputVariables: ["inputText"],
    partialVariables: { format_instructions: formatInstructions },
  });

  const model = new OpenAI({ temperature: 0.5, modelName: "gpt-3.5-turbo" });

  const input = await prompt.format({
    inputText: "A man, living in Poland.",
  });
  const response = await model.call(input);
  console.log("response", response);

  const parsed = await parser.parse(response);

  expect(parsed).toHaveProperty("name");
  expect(parsed).toHaveProperty("surname");
  expect(parsed).toHaveProperty("age");
  expect(parsed).toHaveProperty("appearance");
  expect(parsed).toHaveProperty("shortBio");
  expect(parsed).toHaveProperty("age");
  expect(parsed).toHaveProperty("gender");
  expect(parsed).toHaveProperty("interests");
  expect(parsed.interests.length).toBeGreaterThan(0);
});
