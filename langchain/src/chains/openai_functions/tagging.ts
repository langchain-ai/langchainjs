import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { ChatOpenAI } from "../../chat_models/openai.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  FunctionParameters,
  JsonOutputFunctionsParser,
} from "../../output_parsers/openai_functions.js";
import { LLMChain, LLMChainInput } from "../llm_chain.js";

export type TaggingChainOptions = {
  prompt?: PromptTemplate;
} & Omit<LLMChainInput<object>, "prompt" | "llm">;

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
  llm: ChatOpenAI,
  options: TaggingChainOptions = {}
) {
  const { prompt = PromptTemplate.fromTemplate(TAGGING_TEMPLATE), ...rest } =
    options;
  const functions = getTaggingFunctions(schema);
  const outputParser = new JsonOutputFunctionsParser();
  return new LLMChain({
    llm,
    prompt,
    llmKwargs: { functions },
    outputParser,
    tags: ["openai_functions", "tagging"],
    ...rest,
  });
}

export function createTaggingChainFromZod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any, any>,
  llm: ChatOpenAI,
  options?: TaggingChainOptions
) {
  return createTaggingChain(
    zodToJsonSchema(schema) as JsonSchema7ObjectType,
    llm,
    options
  );
}
