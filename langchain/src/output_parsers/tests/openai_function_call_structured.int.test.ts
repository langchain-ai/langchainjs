import { expect, test } from "@jest/globals";
import { z } from "zod";

import { FunctionCallStructuredOutputParser } from "../openai_function_call_structured.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { LLMChain } from "../../chains/index.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";

test("FunctionCallStructuredOutputParser deals special chars in prompt with chat model", async () => {
  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-0613",
    temperature: 0,
  });

  const parser = FunctionCallStructuredOutputParser.fromNamesAndDescriptions({
    question1: "a very on-topic question",
    question2: "a super weird question",
    question3: "an on-topic, but slightly creative",
  });

  const prompt = new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate("context:\n{context}\n---"),
    ],
    inputVariables: ["context"],
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

test("FunctionCallStructuredOutputParser handles a longer and more complex schema", async () => {
  const parser = FunctionCallStructuredOutputParser.fromZodSchema(
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

  const prompt = new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(
        "Generate details of a hypothetical person."
      ),
      HumanMessagePromptTemplate.fromTemplate(
        "Person description: {inputText}"
      ),
    ],
    inputVariables: ["inputText"],
  });

  const model = new ChatOpenAI({
    temperature: 0.5,
    modelName: "gpt-3.5-turbo-0613",
  });

  const chain = new LLMChain({
    llm: model,
    prompt,
    outputKey: "person",
    outputParser: parser,
  });

  const response = await chain.call({ inputText: "A man, living in Poland." });
  console.log("response", response);

  expect(response.person).toHaveProperty("name");
  expect(response.person).toHaveProperty("surname");
  expect(response.person).toHaveProperty("age");
  expect(response.person).toHaveProperty("appearance");
  expect(response.person).toHaveProperty("shortBio");
  expect(response.person).toHaveProperty("age");
  expect(response.person).toHaveProperty("gender");
  expect(response.person).toHaveProperty("interests");
  expect(response.person.interests.length).toBeGreaterThan(0);
});
