import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { PromptTemplate } from "../../prompts/prompt.js";
import {
  FunctionParameters,
  JsonOutputFunctionsParser,
} from "../../output_parsers/openai_functions.js";
import { LLMChain, LLMChainInput } from "../llm_chain.js";
import { BaseChatModel } from "../../chat_models/base.js";
import { BaseFunctionCallOptions } from "../../base_language/index.js";

/**
 * Type representing the options for creating a tagging chain.
 */
export type TaggingChainOptions = {
  prompt?: PromptTemplate;
} & Omit<LLMChainInput<object>, "prompt" | "llm">;

/**
 * Function that returns an array of tagging functions. These functions
 * are used to extract relevant information from a passage.
 * @param schema The schema defining the structure of function parameters.
 * @returns An array of tagging functions.
 */
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

/**
 * Function that creates a tagging chain using the provided schema,
 * LLM, and options. It constructs the LLM with the necessary
 * functions, prompt, output parser, and tags.
 * @param schema The schema defining the structure of function parameters.
 * @param llm LLM to use in the chain. Must support function calling.
 * @param options Options for creating the tagging chain.
 * @returns A new instance of LLMChain configured for tagging.
 */
export function createTaggingChain(
  schema: FunctionParameters,
  llm: BaseChatModel<BaseFunctionCallOptions>,
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

/**
 * Function that creates a tagging chain from a Zod schema. It converts
 * the Zod schema to a JSON schema using the zodToJsonSchema function and
 * then calls createTaggingChain with the converted schema.
 * @param schema The Zod schema which extracted data should match.
 * @param llm LLM to use in the chain. Must support function calling.
 * @param options Options for creating the tagging chain.
 * @returns A new instance of LLMChain configured for tagging.
 */
export function createTaggingChainFromZod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any, any>,
  llm: BaseChatModel<BaseFunctionCallOptions>,
  options?: TaggingChainOptions
) {
  return createTaggingChain(
    zodToJsonSchema(schema) as JsonSchema7ObjectType,
    llm,
    options
  );
}
