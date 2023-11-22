import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7Type } from "zod-to-json-schema/src/parseDef.js";

import { Validator } from "@langchain/core/utils/json_schema";
import { LLMChain, LLMChainInput } from "../llm_chain.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BasePromptTemplate } from "../../prompts/index.js";
import {
  BaseLLMOutputParser,
  OutputParserException,
} from "../../schema/output_parser.js";
import { OutputFunctionsParser } from "../../output_parsers/openai_functions.js";
import { ChatGeneration } from "../../schema/index.js";
import { BaseChatModel } from "../../chat_models/base.js";
import { BaseFunctionCallOptions } from "../../base_language/index.js";

/**
 * Type representing the input for creating a structured output chain. It
 * extends the LLMChainInput type and includes an additional
 * 'outputSchema' field representing the JSON schema for the expected
 * output.
 */
export type StructuredOutputChainInput = Omit<
  LLMChainInput,
  "outputParser" | "llm"
> & {
  outputSchema: JsonSchema7Type;
  prompt: BasePromptTemplate;
  llm?: BaseChatModel<BaseFunctionCallOptions>;
};

/**
 * Class that extends the BaseLLMOutputParser class. It provides
 * functionality for parsing the structured output based on a JSON schema.
 */
export class FunctionCallStructuredOutputParser<
  T extends z.AnyZodObject
> extends BaseLLMOutputParser<z.infer<T>> {
  lc_namespace = ["langchain", "chains", "openai_functions"];

  protected functionOutputParser = new OutputFunctionsParser();

  protected jsonSchemaValidator: Validator;

  constructor(public schema: JsonSchema7Type) {
    super();
    this.jsonSchemaValidator = new Validator(schema, "7");
  }

  /**
   * Method to parse the result of chat generations. It first parses the
   * result using the functionOutputParser, then validates the parsed result
   * against the JSON schema. If the result is valid, it returns the parsed
   * result. Otherwise, it throws an OutputParserException.
   * @param generations Array of ChatGeneration instances to be parsed.
   * @returns The parsed result if it is valid according to the JSON schema.
   */
  async parseResult(generations: ChatGeneration[]) {
    const initialResult = await this.functionOutputParser.parseResult(
      generations
    );
    const parsedResult = JSON.parse(initialResult, (_, value) => {
      if (value === null) {
        return undefined;
      }
      return value;
    });
    const result = this.jsonSchemaValidator.validate(parsedResult);
    if (result.valid) {
      return parsedResult;
    } else {
      throw new OutputParserException(
        `Failed to parse. Text: "${initialResult}". Error: ${JSON.stringify(
          result.errors
        )}`,
        initialResult
      );
    }
  }
}

/**
 * Create a chain that returns output matching a JSON Schema.
 * @param input Object that includes all LLMChainInput fields except "outputParser"
 * as well as an additional required "outputSchema" JSON Schema object.
 * @returns OpenAPIChain
 */
export function createStructuredOutputChain<
  T extends z.AnyZodObject = z.AnyZodObject
>(input: StructuredOutputChainInput) {
  const {
    outputSchema,
    llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 0 }),
    outputKey = "output",
    llmKwargs = {},
    ...rest
  } = input;
  const functionName = "output_formatter";
  return new LLMChain({
    llm,
    llmKwargs: {
      ...llmKwargs,
      functions: [
        {
          name: functionName,
          description: `Output formatter. Should always be used to format your response to the user.`,
          parameters: outputSchema,
        },
      ],
      function_call: {
        name: functionName,
      },
    },
    outputKey,
    outputParser: new FunctionCallStructuredOutputParser<T>(outputSchema),
    ...rest,
  });
}

export function createStructuredOutputChainFromZod<T extends z.AnyZodObject>(
  zodSchema: T,
  input: Omit<StructuredOutputChainInput, "outputSchema">
) {
  return createStructuredOutputChain<T>({
    ...input,
    outputSchema: zodToJsonSchema(zodSchema),
  });
}
