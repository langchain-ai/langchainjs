import { FunctionDefinition } from "@langchain/core/language_models/base";
import { BaseOutputParser } from "@langchain/core/output_parsers";
import { BasePromptTemplate } from "@langchain/core/prompts";
import { Runnable } from "@langchain/core/runnables";
import { JsonOutputFunctionsParser } from "../../output_parsers/openai_functions.js";

/**
 * Create a runnable sequence that uses OpenAI functions.
 *
 * @template RunInput extends Record<string, unknown> = Record<string, unknown>
 * @template RunOutput extends Record<string, unknown> = Record<string, unknown>
 * @param {Array<FunctionDefinition>} functions Functions are assumed to already be a valid OpenAI functions. If only a single function is passed in, then it will be enforced that the model use that function.
 * @param {Runnable<RunInput, RunOutput>} llm Language model to use, assumed to support the OpenAI function-calling API.
 * @param {BasePromptTemplate} prompt BasePromptTemplate to pass to the model.
 * @param {boolean} [enforceSingleFunctionUsage=true] Only used if a single function is passed in. If `true`, then the model will be forced to use the given function. If `false`, then the model will be given the option to use the given function or not.
 * @param {BaseOutputParser<RunOutput> | undefined} outputParser BaseLLMOutputParser to use for parsing model outputs. By default will be inferred from the function types.
 * @returns {Runnable<RunInput, RunOutput>} A runnable sequence that will pass in the given functions to the model when run.
 */
function createOpenAIFnRunnable<
  RunInput extends Record<string, unknown> = Record<string, unknown>,
  RunOutput extends Record<string, unknown> = Record<string, unknown>
>(
  functions: FunctionDefinition[],
  llm: Runnable<RunInput, RunOutput>,
  prompt: BasePromptTemplate,
  enforceSingleFunctionUsage?: boolean,
  outputParser?: BaseOutputParser<RunOutput>
): Runnable<RunInput, RunOutput> {
  const llmKwargs: Record<string, unknown> = {
    functions
  };
  // eslint-disable-next-line no-param-reassign
  enforceSingleFunctionUsage = enforceSingleFunctionUsage ?? true;
  if (functions.length === 1 && enforceSingleFunctionUsage) {
    llmKwargs.function_call = {
      name: functions[0].name
    };
  }

  // eslint-disable-next-line no-param-reassign
  outputParser = outputParser ?? new JsonOutputFunctionsParser();

  const llmWithKwargs = llm.bind(llmKwargs);
  const chain = prompt.pipe(llmWithKwargs).pipe(outputParser);
  return chain;
}

/**
 * Create a runnable that uses an OpenAI function to get a structured output.
 *
 * @template RunInput extends Record<string, unknown> = Record<string, unknown>
 * @template RunOutput extends Record<string, unknown> = Record<string, unknown>
 * @param {RunOutput} outputSchema It's assumed outputSchema is a valid JsonSchema.
 * @param {Runnable<RunInput, RunOutput>} llm Language model to use, assumed to support the OpenAI function-calling API.
 * @param {BasePromptTemplate} prompt BasePromptTemplate to pass to the model.
 * @param {BaseOutputParser<RunOutput> | undefined} outputParser BaseLLMOutputParser to use for parsing model outputs. By default will be inferred from the function types.
 * @returns {Runnable<RunInput, RunOutput>} A runnable sequence that will pass the given function to the model when run.
 */
export function createStructuredOutputRunnable<
  RunInput extends Record<string, unknown> = Record<string, unknown>,
  RunOutput extends Record<string, unknown> = Record<string, unknown>
>(
  outputSchema: RunOutput,
  llm: Runnable<RunInput, RunOutput>,
  prompt: BasePromptTemplate<RunInput>,
  outputParser?: BaseOutputParser<RunOutput>
): Runnable<RunInput, RunOutput> {
  const oaiFunction = {
    name: "outputFormatter",
    description:
      "Output formatter. Should always be used to format your response to the user",
    parameters: outputSchema
  };

  return createOpenAIFnRunnable([oaiFunction], llm, prompt, true, outputParser);
}
