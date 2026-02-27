import { BaseMessage } from "../messages";
import {
  BaseLLMOutputParser,
  JsonOutputParser,
  StandardSchemaOutputParser,
  StructuredOutputParser,
} from "../output_parsers";
import { Runnable, RunnablePassthrough, RunnableSequence } from "../runnables";
import {
  isSerializableSchema,
  SerializableSchema,
} from "../utils/standard_schema";
import { InteropZodType, isInteropZodSchema } from "../utils/types";
import { BaseLanguageModelInput } from "./base";

/**
 * Creates the appropriate content-based output parser for a schema. Use this for
 * jsonMode/jsonSchema methods where the LLM returns JSON text.
 *
 * - Zod schema -> StructuredOutputParser (Zod validation)
 * - Standard schema -> StandardSchemaOutputParser (standard schema validation)
 * - Plain JSON schema -> JsonOutputParser (no validation)
 */
export function createContentParser<
  // eslint-disable-next-lint @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
>(
  schema:
    | InteropZodType<RunOutput>
    | SerializableSchema<RunOutput, RunOutput>
    // eslint-disable-next-lint @typescript-eslint/no-explicit-any
    | Record<string, any>
): BaseLLMOutputParser<RunOutput> {
  if (isInteropZodSchema(schema)) {
    return StructuredOutputParser.fromZodSchema(schema);
  }
  if (isSerializableSchema(schema)) {
    return StandardSchemaOutputParser.fromStandardSchema(schema);
  }
  return new JsonOutputParser<RunOutput>();
}

/**
 * Pipes an LLM through an output parser, optionally wrapping the result
 * to include the raw LLM response alongside the parsed output.
 *
 * When `includeRaw` is true, returns `{ raw: BaseMessage, parsed: RunOutput }`.
 * If parsing fails, `parsed` falls back to null.
 */
export function assembleStructuredOutputPipeline<
  // eslint-disable-next-lint @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
>(
  llm: Runnable<BaseLanguageModelInput>,
  outputParser: Runnable<any, RunOutput>,
  includeRaw?: boolean,
  runName?: string
):
  | Runnable<BaseLanguageModelInput, RunOutput>
  | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }> {
  if (!includeRaw) {
    const result = llm.pipe(outputParser);
    return runName ? result.withConfig({ runName }) : result;
  }

  const parserAssign = RunnablePassthrough.assign({
    // eslint-disable-next-lint @typescript-eslint/no-explicit-any
    parsed: (input: any, config) => outputParser.invoke(input.raw, config),
  });
  const parserNone = RunnablePassthrough.assign({
    parsed: () => null,
  });
  const parsedWithFallback = parserAssign.withFallbacks({
    fallbacks: [parserNone],
  });
  const result = RunnableSequence.from<
    BaseLanguageModelInput,
    { raw: BaseMessage; parsed: RunOutput }
  >([{ raw: llm }, parsedWithFallback]);
  return runName ? result.withConfig({ runName }) : result;
}
