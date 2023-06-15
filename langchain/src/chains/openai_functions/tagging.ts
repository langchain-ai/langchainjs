import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { ChatOpenAI } from "../../chat_models/openai.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { TransformChain } from "../transform.js";
import { SimpleSequentialChain } from "../sequential_chain.js";
import {
  FunctionParameters,
  OpenAIFunctionsChain,
  parseToArguments,
} from "./index.js";

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
  const chain = new OpenAIFunctionsChain({ llm, prompt, functions });
  const parsing_chain = new TransformChain({
    transform: parseToArguments,
    inputVariables: ["input"],
    outputVariables: ["output"],
  });
  return new SimpleSequentialChain({ chains: [chain, parsing_chain] });
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
