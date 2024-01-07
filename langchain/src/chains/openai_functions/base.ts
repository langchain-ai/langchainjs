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
  RunOutput extends Record<string, any> = Record<string, any>
> = {
  functions: FunctionDefinition[];
  llm: RunnableInterface<
    BaseLanguageModelInput,
    BaseMessage,
    BaseFunctionCallOptions
  >;
  prompt: BasePromptTemplate;
  enforceSingleFunctionUsage?: boolean;
  outputParser?: BaseOutputParser<RunOutput>;
};

/**
 * Create a runnable sequence that calls OpenAI functions.
 *
 * @param {Runnable} llm Language model to use, assumed to support the OpenAI function-calling API.
 * @param {BasePromptTemplate<RunInput>} prompt BasePromptTemplate to pass to the model.
 * @param {boolean} [enforceSingleFunctionUsage=true] Only used if a single function is passed in. If `true`, then the model will be forced to use the given function. If `false`, then the model will be given the option to use the given function or not.
 * @param {BaseOutputParser<RunOutput> | undefined} outputParser BaseLLMOutputParser to use for parsing model outputs. By default will be inferred from the function types.
 * @returns A runnable sequence that will pass in the given functions to the model when run.
 */
export function createOpenAIFnRunnable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any> = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  config: CreateOpenAIFnRunnableConfig<RunOutput>
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
  RunInput extends InputValues,
  RunOutput
> = {
  outputSchema: z.AnyZodObject | JsonSchema7Type;
  llm: RunnableInterface<
    BaseLanguageModelInput,
    BaseMessage,
    BaseFunctionCallOptions
  >;
  prompt: BasePromptTemplate<RunInput>;
  outputParser?: BaseOutputParser<RunOutput>;
};

/**
 * Create a runnable that uses an OpenAI function to get a structured output.
 *
 * @param {Record<string, unknown>} outputSchema It's assumed outputSchema is a valid JSONSchema.
 * @param {Runnable} llm Language model to use, assumed to support the OpenAI function-calling API.
 * @param {BasePromptTemplate<RunInput>} prompt BasePromptTemplate to pass to the model.
 * @param {BaseOutputParser<RunOutput> | undefined} outputParser BaseLLMOutputParser to use for parsing model outputs. By default will be inferred from the function types.
 * @returns A runnable sequence that will pass the given function to the model when run.
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
