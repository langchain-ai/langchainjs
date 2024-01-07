import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7Type } from "zod-to-json-schema/src/parseDef.js";

import type { BaseOutputParser } from "@langchain/core/output_parsers";
import type { BasePromptTemplate } from "@langchain/core/prompts";
import type { Runnable, RunnableInterface } from "@langchain/core/runnables";
import type {
  BaseFunctionCallOptions,
  BaseLanguageModelInput,
  FunctionDefinition,
} from "@langchain/core/language_models/base";
import type { InputValues } from "@langchain/core/utils/types";
import type { BaseMessage } from "@langchain/core/messages";
import { JsonOutputFunctionsParser } from "../../output_parsers/openai_functions.js";

/**
 * Configuration params for the createOpenAIFnRunnable method.
 */
export type CreateOpenAIFnRunnableConfig<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any>,
  RunOutput
> = {
  functions: FunctionDefinition[];
  /** Language model to use, assumed to support the OpenAI function-calling API. */
  llm: RunnableInterface<
    BaseLanguageModelInput,
    BaseMessage,
    BaseFunctionCallOptions
  >;
  /** BasePromptTemplate to pass to the model. */
  prompt: BasePromptTemplate<InputValues<Extract<keyof RunInput, string>>>;
  /**
   * Only used if a single function is passed in. If `true`, then the model will be
   * forced to use the given function. If `false`, then the model will be given the
   * option to use the given function or not.
   */
  enforceSingleFunctionUsage?: boolean;
  /**
   * BaseLLMOutputParser to use for parsing model outputs.
   * By default will be inferred from the function types.
   */
  outputParser?: BaseOutputParser<RunOutput>;
};

const openAIFunction = {
  name: "get_person_details",
  description: "Get details about a person",
  parameters: {
    title: "Person",
    description: "Identifying information about a person.",
    type: "object",
    properties: {
      name: { title: "Name", description: "The person's name", type: "string" },
      age: { title: "Age", description: "The person's age", type: "integer" },
      fav_food: {
        title: "Fav Food",
        description: "The person's favorite food",
        type: "string",
      },
    },
    required: ["name", "age"],
  },
};

/**
 * Creates a runnable sequence that calls OpenAI functions.
 * @param config - The parameters required to create the runnable.
 * @returns A runnable sequence that will pass the given functions to the model when run.
 *
 * @example
 * ```typescript
 * const openAIFunction = {
 *   name: "get_person_details",
 *   description: "Get details about a person",
 *   parameters: {
 *     title: "Person",
 *     description: "Identifying information about a person.",
 *     type: "object",
 *     properties: {
 *       name: { title: "Name", description: "The person's name", type: "string" },
 *       age: { title: "Age", description: "The person's age", type: "integer" },
 *       fav_food: {
 *         title: "Fav Food",
 *         description: "The person's favorite food",
 *         type: "string",
 *       },
 *     },
 *     required: ["name", "age"],
 *   },
 * };
 *
 * const model = new ChatOpenAI();
 * const prompt = ChatPromptTemplate.fromMessages([
 *   ["human", "Human description: {description}"],
 * ]);
 * const outputParser = new JsonOutputFunctionsParser();
 *
 * const runnable = createOpenAIFnRunnable({
 *   functions: [openAIFunction],
 *   llm: model,
 *   prompt,
 *   enforceSingleFunctionUsage: true, // Default is true
 *   outputParser
 * });
 * const response = await runnable.invoke({
 *   description:
 *     "My name's John Doe and I'm 30 years old. My favorite kind of food are chocolate chip cookies.",
 * });
 *
 * console.log(response);
 *
 * // { name: 'John Doe', age: 30, fav_food: 'chocolate chip cookies' }
 * ```
 */
export function createOpenAIFnRunnable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any> = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  config: CreateOpenAIFnRunnableConfig<RunInput, RunOutput>
): RunnableInterface<RunInput, RunOutput> {
  const {
    functions,
    llm,
    prompt,
    enforceSingleFunctionUsage = true,
    outputParser = new JsonOutputFunctionsParser<RunOutput>(),
  } = config;
  const llmKwargs: BaseFunctionCallOptions = {
    functions,
  };

  if (functions.length === 1 && enforceSingleFunctionUsage) {
    llmKwargs.function_call = {
      name: functions[0].name,
    };
  }

  const llmWithKwargs = (llm as Runnable).bind(llmKwargs);
  return prompt.pipe(llmWithKwargs).pipe(outputParser);
}

function isZodSchema(
  schema: z.AnyZodObject | JsonSchema7Type
): schema is z.AnyZodObject {
  return typeof (schema as z.AnyZodObject).safeParse === "function";
}

/**
 * Configuration params for the createStructuredOutputRunnable method.
 */
export type CreateStructuredOutputRunnableConfig<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any>,
  RunOutput
> = {
  /**
   * Schema to output. Must be either valid JSONSchema or a Zod schema.
   */
  outputSchema: z.AnyZodObject | JsonSchema7Type;
  /**
   * Language model to use, assumed to support the OpenAI function-calling API.
   */
  llm: RunnableInterface<
    BaseLanguageModelInput,
    BaseMessage,
    BaseFunctionCallOptions
  >;
  /** BasePromptTemplate to pass to the model. */
  prompt: BasePromptTemplate<InputValues<Extract<keyof RunInput, string>>>;
  /**
   * BaseLLMOutputParser to use for parsing model outputs.
   */
  outputParser?: BaseOutputParser<RunOutput>;
};

/**
 * Create a runnable that uses an OpenAI function to get a structured output.
 * @param config Params required to create the runnable.
 * @returns A runnable sequence that will pass the given function to the model when run.
 *
 * @example
 * ```typescript
 * import { createStructuredOutputRunnable } from "langchain/chains/openai_functions";
 * import { ChatOpenAI } from "@langchain/openai";
 * import { ChatPromptTemplate } from "@langchain/core/prompts";
 * import { JsonOutputFunctionsParser } from "langchain/output_parsers";
 *
 * const jsonSchema = {
 *   title: "Person",
 *   description: "Identifying information about a person.",
 *   type: "object",
 *   properties: {
 *     name: { title: "Name", description: "The person's name", type: "string" },
 *     age: { title: "Age", description: "The person's age", type: "integer" },
 *     fav_food: {
 *       title: "Fav Food",
 *       description: "The person's favorite food",
 *       type: "string",
 *     },
 *   },
 *   required: ["name", "age"],
 * };
 *
 * const model = new ChatOpenAI();
 * const prompt = ChatPromptTemplate.fromMessages([
 *   ["human", "Human description: {description}"],
 * ]);
 *
 * const outputParser = new JsonOutputFunctionsParser();
 *
 * // Also works with Zod schema
 * const runnable = createStructuredOutputRunnable({
 *   outputSchema: jsonSchema,
 *   llm: model,
 *   prompt,
 *   outputParser
 * });
 *
 * const response = await runnable.invoke({
 *   description:
 *     "My name's John Doe and I'm 30 years old. My favorite kind of food are chocolate chip cookies.",
 * });
 *
 * console.log(response);
 *
 * // { name: 'John Doe', age: 30, fav_food: 'chocolate chip cookies' }
 * ```
 */
export function createStructuredOutputRunnable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any> = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  config: CreateStructuredOutputRunnableConfig<RunInput, RunOutput>
): RunnableInterface<RunInput, RunOutput> {
  const { outputSchema, llm, prompt, outputParser } = config;
  const jsonSchema = isZodSchema(outputSchema)
    ? zodToJsonSchema(outputSchema)
    : outputSchema;
  const oaiFunction: FunctionDefinition = {
    name: "outputFormatter",
    description:
      "Output formatter. Should always be used to format your response to the user",
    parameters: jsonSchema,
  };

  return createOpenAIFnRunnable({
    functions: [oaiFunction],
    llm,
    prompt,
    enforceSingleFunctionUsage: true,
    outputParser,
  });
}
