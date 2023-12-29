import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";
import {
  compare,
  type Operation as JSONPatchOperation,
} from "@langchain/core/utils/json_patch";

import { ChatGeneration, Generation } from "../schema/index.js";
import { Optional } from "../types/type-utils.js";
import {
  BaseCumulativeTransformOutputParser,
  type BaseCumulativeTransformOutputParserInput,
  BaseLLMOutputParser,
} from "../schema/output_parser.js";
import { parsePartialJson } from "./json.js";

/**
 * Represents optional parameters for a function in a JSON Schema.
 */
export type FunctionParameters = Optional<
  JsonSchema7ObjectType,
  "additionalProperties"
>;

/**
 * Class for parsing the output of an LLM. Can be configured to return
 * only the arguments of the function call in the output.
 */
export class OutputFunctionsParser extends BaseLLMOutputParser<string> {
  static lc_name() {
    return "OutputFunctionsParser";
  }

  lc_namespace = ["langchain", "output_parsers"];

  lc_serializable = true;

  argsOnly = true;

  constructor(config?: { argsOnly?: boolean }) {
    super();
    this.argsOnly = config?.argsOnly ?? this.argsOnly;
  }

  /**
   * Parses the output and returns a string representation of the function
   * call or its arguments.
   * @param generations The output of the LLM to parse.
   * @returns A string representation of the function call or its arguments.
   */
  async parseResult(
    generations: Generation[] | ChatGeneration[]
  ): Promise<string> {
    if ("message" in generations[0]) {
      const gen = generations[0] as ChatGeneration;
      const functionCall = gen.message.additional_kwargs.function_call;
      if (!functionCall) {
        throw new Error(
          `No function_call in message ${JSON.stringify(generations)}`
        );
      }
      if (!functionCall.arguments) {
        throw new Error(
          `No arguments in function_call ${JSON.stringify(generations)}`
        );
      }
      if (this.argsOnly) {
        return functionCall.arguments;
      }
      return JSON.stringify(functionCall);
    } else {
      throw new Error(
        `No message in generations ${JSON.stringify(generations)}`
      );
    }
  }
}

/**
 * Class for parsing the output of an LLM into a JSON object. Uses an
 * instance of `OutputFunctionsParser` to parse the output.
 */
export class JsonOutputFunctionsParser extends BaseCumulativeTransformOutputParser<object> {
  static lc_name() {
    return "JsonOutputFunctionsParser";
  }

  lc_namespace = ["langchain", "output_parsers"];

  lc_serializable = true;

  outputParser: OutputFunctionsParser;

  argsOnly = true;

  constructor(
    config?: { argsOnly?: boolean } & BaseCumulativeTransformOutputParserInput
  ) {
    super(config);
    this.argsOnly = config?.argsOnly ?? this.argsOnly;
    this.outputParser = new OutputFunctionsParser(config);
  }

  protected _diff(
    prev: unknown | undefined,
    next: unknown
  ): JSONPatchOperation[] | undefined {
    if (!next) {
      return undefined;
    }
    const ops = compare(prev ?? {}, next);
    return ops;
  }

  async parsePartialResult(
    generations: ChatGeneration[]
  ): Promise<object | undefined> {
    const generation = generations[0];
    if (!generation.message) {
      return undefined;
    }
    const { message } = generation;
    const functionCall = message.additional_kwargs.function_call;
    if (!functionCall) {
      return undefined;
    }
    if (this.argsOnly) {
      return parsePartialJson(functionCall.arguments);
    }

    return {
      ...functionCall,
      arguments: parsePartialJson(functionCall.arguments),
    };
  }

  /**
   * Parses the output and returns a JSON object. If `argsOnly` is true,
   * only the arguments of the function call are returned.
   * @param generations The output of the LLM to parse.
   * @returns A JSON object representation of the function call or its arguments.
   */
  async parseResult(
    generations: Generation[] | ChatGeneration[]
  ): Promise<object> {
    const result = await this.outputParser.parseResult(generations);
    if (!result) {
      throw new Error(
        `No result from "OutputFunctionsParser" ${JSON.stringify(generations)}`
      );
    }
    return this.parse(result);
  }

  async parse(text: string): Promise<object> {
    const parsedResult = JSON.parse(text);
    if (this.argsOnly) {
      return parsedResult;
    }
    parsedResult.arguments = JSON.parse(parsedResult.arguments);
    return parsedResult;
  }

  getFormatInstructions(): string {
    return "";
  }
}

/**
 * Class for parsing the output of an LLM into a JSON object and returning
 * a specific attribute. Uses an instance of `JsonOutputFunctionsParser`
 * to parse the output.
 */
export class JsonKeyOutputFunctionsParser<
  T = object
> extends BaseLLMOutputParser<T> {
  static lc_name() {
    return "JsonKeyOutputFunctionsParser";
  }

  lc_namespace = ["langchain", "output_parsers"];

  lc_serializable = true;

  outputParser = new JsonOutputFunctionsParser();

  attrName: string;

  constructor(fields: { attrName: string }) {
    super(fields);
    this.attrName = fields.attrName;
  }

  /**
   * Parses the output and returns a specific attribute of the parsed JSON
   * object.
   * @param generations The output of the LLM to parse.
   * @returns The value of a specific attribute of the parsed JSON object.
   */
  async parseResult(generations: Generation[] | ChatGeneration[]): Promise<T> {
    const result = await this.outputParser.parseResult(generations);
    return result[this.attrName as keyof typeof result] as T;
  }
}
