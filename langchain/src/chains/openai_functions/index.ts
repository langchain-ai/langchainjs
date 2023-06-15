import {
  ChatCompletionFunctions,
  ChatCompletionRequestMessageFunctionCall,
} from "openai";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { BaseChain, ChainInputs } from "../base.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { AIChatMessage, ChainValues } from "../../schema/index.js";
import { Optional } from "../../types/type-utils.js";

export type FunctionParameters = Optional<
  JsonSchema7ObjectType,
  "additionalProperties"
>;

export interface OpenAIFunctionsChainFields extends ChainInputs {
  llm: ChatOpenAI;
  prompt: BasePromptTemplate;
  functions: ChatCompletionFunctions[];
  outputKey?: string;
}

export class OpenAIFunctionsChain
  extends BaseChain
  implements OpenAIFunctionsChainFields
{
  llm: ChatOpenAI;

  prompt: BasePromptTemplate;

  functions: ChatCompletionFunctions[];

  outputKey = "output";

  _chainType() {
    return "openai_functions" as const;
  }

  get inputKeys() {
    return this.prompt.inputVariables;
  }

  get outputKeys() {
    return [this.outputKey];
  }

  constructor(fields: OpenAIFunctionsChainFields) {
    super(fields);
    this.llm = fields.llm;
    this.prompt = fields.prompt;
    this.functions = fields.functions;
    this.outputKey = fields.outputKey ?? this.outputKey;
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const valuesForPrompt = { ...values };
    const valuesForLLM: this["llm"]["CallOptions"] = {
      functions: this.functions,
    };
    for (const key of this.llm.callKeys) {
      if (key in values) {
        valuesForLLM[key as keyof this["llm"]["CallOptions"]] = values[key];
        delete valuesForPrompt[key];
      }
    }
    const promptValue = await this.prompt.formatPromptValue(valuesForPrompt);
    const message = await this.llm.predictMessages(
      promptValue.toChatMessages(),
      valuesForLLM,
      runManager?.getChild()
    );
    return { output: message };
  }
}

export function parseToArguments({ input }: { input: AIChatMessage }) {
  const function_call = input?.additional_kwargs
    ?.function_call as ChatCompletionRequestMessageFunctionCall;
  return {
    output: function_call?.arguments
      ? JSON.parse(function_call?.arguments)
      : undefined,
  };
}

export function parseToNamedArgument(
  key: string,
  inputs: { input: AIChatMessage }
) {
  const { output } = parseToArguments(inputs);
  return { output: output?.[key] };
}
