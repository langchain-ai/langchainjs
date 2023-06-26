import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";
import { ChatGeneration, Generation } from "../schema/index.js";
import { Optional } from "../types/type-utils.js";
import { BaseLLMOutputParser } from "../schema/output_parser.js";

export type FunctionParameters = Optional<
  JsonSchema7ObjectType,
  "additionalProperties"
>;

export class OutputFunctionsParser extends BaseLLMOutputParser<string> {
  lc_namespace = ["langchain", "chains", "openai_functions"];

  lc_serializable = true;

  async parseResult(
    generations: Generation[] | ChatGeneration[]
  ): Promise<string> {
    if ("message" in generations[0]) {
      const gen = generations[0] as ChatGeneration;
      if (!gen.message.additional_kwargs.function_call) {
        throw new Error(
          `No function_call in message ${JSON.stringify(generations)}`
        );
      }
      if (!gen.message.additional_kwargs.function_call.arguments) {
        throw new Error(
          `No arguments in function_call ${JSON.stringify(generations)}`
        );
      }
      return gen.message.additional_kwargs.function_call.arguments;
    } else {
      throw new Error(
        `No message in generations ${JSON.stringify(generations)}`
      );
    }
  }
}

export class JsonOutputFunctionsParser extends BaseLLMOutputParser<object> {
  lc_namespace = ["langchain", "chains", "openai_functions"];

  lc_serializable = true;

  outputParser = new OutputFunctionsParser();

  async parseResult(
    generations: Generation[] | ChatGeneration[]
  ): Promise<object> {
    const result = await this.outputParser.parseResult(generations);
    if (!result) {
      throw new Error(
        `No result from "OutputFunctionsParser" ${JSON.stringify(generations)}`
      );
    }
    return JSON.parse(result);
  }
}

export class JsonKeyOutputFunctionsParser<
  T = object
> extends BaseLLMOutputParser<T> {
  lc_namespace = ["langchain", "chains", "openai_functions"];

  lc_serializable = true;

  outputParser = new JsonOutputFunctionsParser();

  attrName: string;

  constructor(fields: { attrName: string }) {
    super(fields);
    this.attrName = fields.attrName;
  }

  async parseResult(generations: Generation[] | ChatGeneration[]): Promise<T> {
    const result = await this.outputParser.parseResult(generations);
    return result[this.attrName as keyof typeof result] as T;
  }
}
