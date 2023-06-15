import {
  ChatCompletionFunctions,
  ChatCompletionRequestMessageFunctionCall,
} from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { BaseChain, ChainInputs } from "./base.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { ChatOpenAI } from "../chat_models/openai.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { AIChatMessage, ChainValues } from "../schema/index.js";
import { PromptTemplate } from "../prompts/prompt.js";
import { TransformChain } from "./transform.js";
import { SimpleSequentialChain } from "./sequential_chain.js";

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
      function_call:
        this.functions.length === 1
          ? { name: this.functions[0].name }
          : undefined,
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

function parseToArguments({ input }: { input: AIChatMessage }) {
  const function_call = input?.additional_kwargs
    ?.function_call as ChatCompletionRequestMessageFunctionCall;
  return {
    output: function_call?.arguments
      ? JSON.parse(function_call?.arguments)
      : undefined,
  };
}

function parseToNamedArgument(key: string, inputs: { input: AIChatMessage }) {
  const { output } = parseToArguments(inputs);
  return { output: output?.[key] };
}

function getTaggingFunctions(schema: JsonSchema7ObjectType) {
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
  schema: JsonSchema7ObjectType,
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

function getExtractionFunctions(schema: JsonSchema7ObjectType) {
  return [
    {
      name: "information_extraction",
      description: "Extracts the relevant information from the passage.",
      parameters: {
        type: "object",
        properties: {
          info: { type: "array", items: schema },
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

export function createExtractionChain(
  schema: JsonSchema7ObjectType,
  llm: ChatOpenAI
) {
  const functions = getExtractionFunctions(schema);
  const prompt = PromptTemplate.fromTemplate(_EXTRACTION_TEMPLATE);
  const chain = new OpenAIFunctionsChain({ llm, prompt, functions });
  const parsing_chain = new TransformChain({
    transform: parseToNamedArgument.bind(null, "info"),
    inputVariables: ["input"],
    outputVariables: ["output"],
  });
  return new SimpleSequentialChain({ chains: [chain, parsing_chain] });
}

export function createExtractionChainFromZod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any, any, any, any>,
  llm: ChatOpenAI
) {
  return createExtractionChain(
    zodToJsonSchema(schema) as JsonSchema7ObjectType,
    llm
  );
}
