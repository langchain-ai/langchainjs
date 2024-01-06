import { BaseOutputParser } from "@langchain/core/output_parsers";
import { BasePromptTemplate } from "@langchain/core/prompts";
import { Runnable } from "@langchain/core/runnables";
import { FunctionDefinition } from "@langchain/core/language_models/base";
import { JsonOutputFunctionsParser } from "../../output_parsers/openai_functions.js";

/**
 * Create a runnable sequence that uses OpenAI functions.
 *
 * @template RunInput extends Record<string, any> = Record<string, any>
 * @template RunOutput extends Record<string, any> = Record<string, any>
 * @param {Array<FunctionDefinition>} functions Functions are assumed to already be a valid OpenAI functions. If only a single function is passed in, then it will be enforced that the model use that function.
 * @param {Runnable} llm Language model to use, assumed to support the OpenAI function-calling API.
 * @param {BasePromptTemplate<RunInput>} prompt BasePromptTemplate to pass to the model.
 * @param {boolean} [enforceSingleFunctionUsage=true] Only used if a single function is passed in. If `true`, then the model will be forced to use the given function. If `false`, then the model will be given the option to use the given function or not.
 * @param {BaseOutputParser<RunOutput> | undefined} outputParser BaseLLMOutputParser to use for parsing model outputs. By default will be inferred from the function types.
 * @returns {Runnable<RunInput, RunOutput>} A runnable sequence that will pass in the given functions to the model when run.
 */
export function createOpenAIFnRunnable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any> = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  functions: FunctionDefinition[],
  llm: Runnable,
  prompt: BasePromptTemplate<RunInput>,
  enforceSingleFunctionUsage?: boolean,
  outputParser?: BaseOutputParser<RunOutput>
): Runnable<RunInput, RunOutput> {
  const llmKwargs: Record<string, unknown> = {
    functions,
  };
  // eslint-disable-next-line no-param-reassign
  enforceSingleFunctionUsage = enforceSingleFunctionUsage ?? true;
  if (functions.length === 1 && enforceSingleFunctionUsage) {
    llmKwargs.function_call = {
      name: functions[0].name,
    };
  }

  // eslint-disable-next-line no-param-reassign
  outputParser = outputParser ?? new JsonOutputFunctionsParser<RunOutput>();

  const llmWithKwargs = llm.bind(llmKwargs);
  const chain = prompt.pipe(llmWithKwargs).pipe(outputParser);
  return chain;
}

/**
 * Create a runnable that uses an OpenAI function to get a structured output.
 *
 * @template RunInput extends Record<string, any> = Record<string, any>
 * @template RunOutput extends Record<string, any> = Record<string, any>
 * @param {Record<string, unknown>} outputSchema It's assumed outputSchema is a valid JSONSchema.
 * @param {Runnable} llm Language model to use, assumed to support the OpenAI function-calling API.
 * @param {BasePromptTemplate<RunInput>} prompt BasePromptTemplate to pass to the model.
 * @param {BaseOutputParser<RunOutput> | undefined} outputParser BaseLLMOutputParser to use for parsing model outputs. By default will be inferred from the function types.
 * @returns {Runnable<RunInput, RunOutput>} A runnable sequence that will pass the given function to the model when run.
 */
export function createStructuredOutputRunnable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any> = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  outputSchema: Record<string, unknown>,
  llm: Runnable,
  prompt: BasePromptTemplate<RunInput>,
  outputParser?: BaseOutputParser<RunOutput>
): Runnable<RunInput, RunOutput> {
  const oaiFunction = {
    name: "outputFormatter",
    description:
      "Output formatter. Should always be used to format your response to the user",
    parameters: outputSchema,
  };

  return createOpenAIFnRunnable([oaiFunction], llm, prompt, true, outputParser);
}
