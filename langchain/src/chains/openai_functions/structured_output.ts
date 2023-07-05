import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { LLMChain, LLMChainInput } from "../llm_chain.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BasePromptTemplate } from "../../prompts/index.js";
import {
  BaseLLMOutputParser,
  OutputParserException,
} from "../../schema/output_parser.js";
import { OutputFunctionsParser } from "../../output_parsers/openai_functions.js";
import { ChatGeneration } from "../../schema/index.js";

export type FunctionCallStructuredOutputChainInput<T extends z.ZodTypeAny> =
  Omit<LLMChainInput, "outputParser" | "llm"> & {
    outputSchema: T;
    prompt: BasePromptTemplate;
    llm?: ChatOpenAI;
  };

class FunctionCallStructuredOutputParser<
  T extends z.ZodTypeAny
> extends BaseLLMOutputParser<z.infer<T>> {
  lc_namespace = ["langchain", "chains", "openai_functions"];

  protected functionOutputParser = new OutputFunctionsParser();

  constructor(public schema: T) {
    super();
  }

  async parseResult(generations: ChatGeneration[]) {
    const initialParseResult = await this.functionOutputParser.parseResult(
      generations
    );
    try {
      return this.schema.parseAsync(JSON.parse(initialParseResult));
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${initialParseResult}". Error: ${e}`,
        initialParseResult
      );
    }
  }
}

/**
 * Create a chain for querying an API from a OpenAPI spec.
 * @param spec OpenAPISpec or url/file/text string corresponding to one.
 * @param options Custom options passed into the chain
 * @returns OpenAPIChain
 */
export function createStructuredOutputChain<T extends z.ZodTypeAny>(
  input: FunctionCallStructuredOutputChainInput<T>
) {
  const {
    outputSchema,
    llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 0 }),
    outputKey = "output",
    llmKwargs = {},
    ...rest
  } = input;
  const functionName = "__lc_output__";
  return new LLMChain({
    llm,
    llmKwargs: {
      ...llmKwargs,
      functions: [
        {
          name: functionName,
          description: `Output formatter. Should always be used to format your response to the user.`,
          parameters: zodToJsonSchema(outputSchema),
        },
      ],
      function_call: {
        name: functionName,
      },
    },
    outputKey,
    outputParser: new FunctionCallStructuredOutputParser(outputSchema),
    ...rest,
  });
}
