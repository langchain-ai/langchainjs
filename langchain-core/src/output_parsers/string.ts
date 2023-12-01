import { BaseTransformOutputParser } from "./transform.js";

/**
 * OutputParser that parses LLMResult into the top likely string.
 * @example
 * ```typescript
 * const promptTemplate = PromptTemplate.fromTemplate(
 *   "Tell me a joke about {topic}",
 * );
 *
 * const chain = RunnableSequence.from([
 *   promptTemplate,
 *   new ChatOpenAI({}),
 *   new StringOutputParser(),
 * ]);
 *
 * const result = await chain.invoke({ topic: "bears" });
 * console.log("What do you call a bear with no teeth? A gummy bear!");
 * ```
 */
export class StringOutputParser extends BaseTransformOutputParser<string> {
  static lc_name() {
    return "StrOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers", "string"];

  lc_serializable = true;

  /**
   * Parses a string output from an LLM call. This method is meant to be
   * implemented by subclasses to define how a string output from an LLM
   * should be parsed.
   * @param text The string output from an LLM call.
   * @param callbacks Optional callbacks.
   * @returns A promise of the parsed output.
   */
  parse(text: string): Promise<string> {
    return Promise.resolve(text);
  }

  getFormatInstructions(): string {
    return "";
  }
}
