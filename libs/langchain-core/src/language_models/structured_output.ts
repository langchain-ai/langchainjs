import { BaseMessage } from "../messages/index.js";
import {
  BaseLLMOutputParser,
  JsonOutputParser,
  StandardSchemaOutputParser,
  StructuredOutputParser,
} from "../output_parsers/index.js";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "../runnables/index.js";
import {
  isSerializableSchema,
  SerializableSchema,
} from "../utils/standard_schema.js";
import { InteropZodType, isInteropZodSchema } from "../utils/types/index.js";
import { BaseLanguageModelInput } from "./base.js";

/**
 * Creates the appropriate content-based output parser for a schema. Use this for
 * jsonMode/jsonSchema methods where the LLM returns JSON text.
 *
 * - Zod schema -> StructuredOutputParser (Zod validation)
 * - Standard schema -> StandardSchemaOutputParser (standard schema validation)
 * - Plain JSON schema -> JsonOutputParser (no validation)
 */
export function createContentParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
>(
  schema:
    | InteropZodType<RunOutput>
    | SerializableSchema<RunOutput, RunOutput>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
>(
  llm: Runnable<BaseLanguageModelInput>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
