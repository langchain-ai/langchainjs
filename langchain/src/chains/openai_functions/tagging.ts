import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { ChatOpenAI } from "../../chat_models/openai.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  FunctionParameters,
  JsonOutputFunctionsParser,
} from "../../output_parsers/openai_functions.js";
import { LLMChain } from "../llm_chain.js";

function getTaggingFunctions(schema: FunctionParameters) {
  return [
    {
      name: "information_extraction",
      description: "Extracts the relevant information from the passage.",
      parameters: schema,
    },
  ];
}

const TAGGING_TEMPLATE = `Extract the desired information from the following passage.

Passage:
{input}
`;

export function createTaggingChain(
  schema: FunctionParameters,
  llm: ChatOpenAI
) {
  const functions = getTaggingFunctions(schema);
  const prompt = PromptTemplate.fromTemplate(TAGGING_TEMPLATE);
  const outputParser = new JsonOutputFunctionsParser();
  return new LLMChain({
    llm,
    prompt,
    llmKwargs: { functions },
    outputParser,
    tags: ["openai_functions", "tagging"],
  });
}

export function createTaggingChainFromZod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any, any>,
  llm: ChatOpenAI
) {
  return createTaggingChain(
    zodToJsonSchema(schema) as JsonSchema7ObjectType,
    llm
  );
}
