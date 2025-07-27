import {
  type JsonSchema7Type,
  Validator,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import { ChatOpenAI } from "@langchain/openai";
import { BasePromptTemplate } from "@langchain/core/prompts";
import {
  BaseLLMOutputParser,
  OutputParserException,
} from "@langchain/core/output_parsers";
import { ChatGeneration } from "@langchain/core/outputs";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseFunctionCallOptions } from "@langchain/core/language_models/base";
import {
  InferInteropZodOutput,
  interopSafeParseAsync,
  InteropZodObject,
} from "@langchain/core/utils/types";
import { LLMChain, type LLMChainInput } from "../llm_chain.js";
import { OutputFunctionsParser } from "../../output_parsers/openai_functions.js";

/**
 * Type representing the input for creating a structured output chain. It
 * extends the LLMChainInput type and includes an additional
 * 'outputSchema' field representing the JSON schema for the expected
 * output.
 */
export type StructuredOutputChainInput<
  T extends InteropZodObject = InteropZodObject
> = Omit<LLMChainInput, "outputParser" | "llm"> & {
  outputSchema?: JsonSchema7Type;
  prompt: BasePromptTemplate;
  llm?: BaseChatModel<BaseFunctionCallOptions>;
  zodSchema?: T;
};

export type FunctionCallStructuredOutputParserFields<
  T extends InteropZodObject = InteropZodObject
> = {
  jsonSchema?: JsonSchema7Type;
  zodSchema?: T;
};

function isJsonSchema7Type(
  x: JsonSchema7Type | FunctionCallStructuredOutputParserFields
): x is JsonSchema7Type {
  return (
    (x as FunctionCallStructuredOutputParserFields).jsonSchema === undefined &&
    (x as FunctionCallStructuredOutputParserFields).zodSchema === undefined
  );
}

/**
 * Class that extends the BaseLLMOutputParser class. It provides
 * functionality for parsing the structured output based on a JSON schema.
 */
export class FunctionCallStructuredOutputParser<
  T extends InteropZodObject
> extends BaseLLMOutputParser<InferInteropZodOutput<T>> {
  lc_namespace = ["langchain", "chains", "openai_functions"];

  protected functionOutputParser = new OutputFunctionsParser();

  protected jsonSchemaValidator?: Validator;

  protected zodSchema?: T;

  constructor(fieldsOrSchema: JsonSchema7Type);

  constructor(fieldsOrSchema: FunctionCallStructuredOutputParserFields<T>);

  constructor(
    fieldsOrSchema:
      | JsonSchema7Type
      | FunctionCallStructuredOutputParserFields<T>
  ) {
    let fields;
    if (isJsonSchema7Type(fieldsOrSchema)) {
      fields = { jsonSchema: fieldsOrSchema };
    } else {
      fields = fieldsOrSchema;
    }
    if (fields.jsonSchema === undefined && fields.zodSchema === undefined) {
      throw new Error(
        `Must provide at least one of "jsonSchema" or "zodSchema".`
      );
    }
    super(fields);
    if (fields.jsonSchema !== undefined) {
      this.jsonSchemaValidator = new Validator(
        fields.jsonSchema as Record<string, unknown>,
        "7"
      );
    }
    if (fields.zodSchema !== undefined) {
      this.zodSchema = fields.zodSchema;
    }
  }

  /**
   * Method to parse the result of chat generations. It first parses the
   * result using the functionOutputParser, then parses the result against a
   * zod schema if the zod schema is available which allows the result to undergo
   * Zod preprocessing, then it parses that result against the JSON schema.
   * If the result is valid, it returns the parsed result. Otherwise, it throws
   * an OutputParserException.
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
    if (this.zodSchema) {
      const zodParsedResult = await interopSafeParseAsync(
        this.zodSchema,
        parsedResult
      );
      if (zodParsedResult.success) {
        return zodParsedResult.data;
      } else {
        throw new OutputParserException(
          `Failed to parse. Text: "${initialResult}". Error: ${JSON.stringify(
            zodParsedResult.error.issues
          )}`,
          initialResult
        );
      }
    } else if (this.jsonSchemaValidator !== undefined) {
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
    } else {
      throw new Error(
        "This parser requires an input JSON Schema or an input Zod schema."
      );
    }
  }
}

/**
 * @deprecated Use {@link https://api.js.langchain.com/functions/langchain.chains_openai_functions.createStructuredOutputRunnable.html | createStructuredOutputRunnable} instead
 * Create a chain that returns output matching a JSON Schema.
 * @param input Object that includes all LLMChainInput fields except "outputParser"
 * as well as an additional required "outputSchema" JSON Schema object.
 * @returns OpenAPIChain
 */
export function createStructuredOutputChain<
  T extends InteropZodObject = InteropZodObject
>(input: StructuredOutputChainInput<T>) {
  const {
    outputSchema,
    llm = new ChatOpenAI({ model: "gpt-3.5-turbo-0613", temperature: 0 }),
    outputKey = "output",
    llmKwargs = {},
    zodSchema,
    ...rest
  } = input;
  if (outputSchema === undefined && zodSchema === undefined) {
    throw new Error(`Must provide one of "outputSchema" or "zodSchema".`);
  }
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
    outputParser: new FunctionCallStructuredOutputParser<T>({
      jsonSchema: outputSchema,
      zodSchema,
    }),
    ...rest,
  });
}

/** @deprecated Use {@link https://api.js.langchain.com/functions/langchain.chains_openai_functions.createStructuredOutputRunnable.html | createStructuredOutputRunnable} instead */
export function createStructuredOutputChainFromZod<T extends InteropZodObject>(
  zodSchema: T,
  input: Omit<StructuredOutputChainInput<T>, "outputSchema">
) {
  return createStructuredOutputChain<T>({
    ...input,
    outputSchema: toJsonSchema(zodSchema),
    zodSchema,
  });
}
