import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { createStructuredOutputChainFromZod } from "langchain/chains/openai_functions";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";

const zodSchema = z.object({
  name: z.string().describe("Human name"),
  surname: z.string().describe("Human surname"),
  age: z.number().describe("Human age"),
  birthplace: z.string().describe("Where the human was born"),
  appearance: z.string().describe("Human appearance description"),
  shortBio: z.string().describe("Short bio secription"),
  university: z.string().optional().describe("University name if attended"),
  gender: z.string().describe("Gender of the human"),
  interests: z
    .array(z.string())
    .describe("json array of strings human interests"),
});

const prompt = new ChatPromptTemplate({
  promptMessages: [
    SystemMessagePromptTemplate.fromTemplate(
      "Generate details of a hypothetical person."
    ),
    HumanMessagePromptTemplate.fromTemplate("Additional context: {inputText}"),
  ],
  inputVariables: ["inputText"],
});

const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 1 });

const chain = createStructuredOutputChainFromZod(zodSchema, {
  prompt,
  llm,
  outputKey: "person",
});

const response = await chain.call({
  inputText:
    "Please generate a diverse group of people, but don't generate anyone who likes video games.",
});

console.log(JSON.stringify(response, null, 2));

/*
  {
    "person": {
      "name": "Sophia",
      "surname": "Martinez",
      "age": 32,
      "birthplace": "Mexico City, Mexico",
      "appearance": "Sophia has long curly brown hair and hazel eyes. She has a warm smile and a contagious laugh.",
      "shortBio": "Sophia is a passionate environmentalist who is dedicated to promoting sustainable living. She believes in the power of individual actions to create a positive impact on the planet.",
      "university": "Stanford University",
      "gender": "Female",
      "interests": [
        "Hiking",
        "Yoga",
        "Cooking",
        "Reading"
      ]
    }
  }
*/
