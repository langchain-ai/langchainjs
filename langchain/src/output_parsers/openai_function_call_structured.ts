import { ChatCompletionFunctions } from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonSchema7Type } from "zod-to-json-schema/src/parseDef.js";

import { StructuredOutputParser } from "./structured.js";
import { OutputParserException } from "../schema/output_parser.js";
import { JsonOutputFunctionsParser } from "./openai_functions.js";
import { Generation, ChatGeneration } from "../schema/index.js";

export class FunctionCallStructuredOutputParser<
  T extends z.ZodTypeAny
> extends StructuredOutputParser<T> {
  public outputFunctionName = "__lc_output__";

  public outputFunctionDescription = `Output formatter. Should always be used to format your response to the user.`;

  public jsonSchema: JsonSchema7Type;

  protected functionOutputParser = new JsonOutputFunctionsParser();

  constructor(schema: T) {
    super(schema);
    this.jsonSchema = zodToJsonSchema(schema);
  }

  get openAiFunctionSchema(): ChatCompletionFunctions {
    return {
      name: this.outputFunctionName,
      description: this.outputFunctionDescription,
      parameters: this.jsonSchema,
    };
  }

  get llmKwargs() {
    return {
      functions: [this.openAiFunctionSchema],
      function_call: {
        name: this.outputFunctionName,
      },
    };
  }

  async parseResult(generations: Generation[] | ChatGeneration[]) {
    return this.functionOutputParser.parseResult(generations);
  }

  async parse(text: string): Promise<z.infer<T>> {
    try {
      return this.schema.parseAsync(JSON.parse(text).arguments);
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`,
        text
      );
    }
  }

  getFormatInstructions(): string {
    return `You must use the provided function when responding, making sure to format your response to match the function's schema.`;
  }
}
