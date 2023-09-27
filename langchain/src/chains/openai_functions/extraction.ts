import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { PromptTemplate } from "../../prompts/prompt.js";
import {
  FunctionParameters,
  JsonKeyOutputFunctionsParser,
} from "../../output_parsers/openai_functions.js";
import { LLMChain } from "../llm_chain.js";
import { BaseChatModel } from "../../chat_models/base.js";
import { BaseFunctionCallOptions } from "../../base_language/index.js";

/**
 * Function that returns an array of extraction functions. These functions
 * are used to extract relevant information from a passage.
 * @param schema The schema of the function parameters.
 * @returns An array of extraction functions.
 */
function getExtractionFunctions(schema: FunctionParameters) {
  return [
    {
      name: "information_extraction",
      description: "Extracts the relevant information from the passage.",
      parameters: {
        type: "object",
        properties: {
          info: {
            type: "array",
            items: {
              type: schema.type,
              properties: schema.properties,
              required: schema.required,
            },
          },
        },
        required: ["info"],
      },
    },
  ];
}

const _EXTRACTION_TEMPLATE = `Extract and save the relevant entities mentioned in the following passage together with their properties.

Passage:
{input}
`;

/**
 * Function that creates an extraction chain using the provided JSON schema.
 * It sets up the necessary components, such as the prompt, output parser, and tags.
 * @param schema JSON schema of the function parameters.
 * @param llm Must be a ChatOpenAI or AnthropicFunctions model that supports function calling.
 * @returns A LLMChain instance configured to return data matching the schema.
 */
export function createExtractionChain(
  schema: FunctionParameters,
  llm: BaseChatModel<BaseFunctionCallOptions>
) {
  const functions = getExtractionFunctions(schema);
  const prompt = PromptTemplate.fromTemplate(_EXTRACTION_TEMPLATE);
  const outputParser = new JsonKeyOutputFunctionsParser({ attrName: "info" });
  return new LLMChain({
    llm,
    prompt,
    llmKwargs: { functions },
    outputParser,
    tags: ["openai_functions", "extraction"],
  });
}

/**
 * Function that creates an extraction chain from a Zod schema. It
 * converts the Zod schema to a JSON schema using zod-to-json-schema
 * before creating the extraction chain.
 * @param schema The Zod schema which extracted data should match
 * @param llm Must be a ChatOpenAI or AnthropicFunctions model that supports function calling.
 * @returns A LLMChain instance configured to return data matching the schema.
 */
export function createExtractionChainFromZod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any, any>,
  llm: BaseChatModel<BaseFunctionCallOptions>
) {
  return createExtractionChain(
    zodToJsonSchema(schema) as JsonSchema7ObjectType,
    llm
  );
}
