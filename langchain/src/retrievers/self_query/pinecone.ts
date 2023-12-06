import { Comparators, Operators } from "../../chains/query_constructor/ir.js";
import { PineconeStore } from "../../vectorstores/pinecone.js";
import { BasicTranslator } from "./base.js";

/**
 * Specialized translator class that extends the BasicTranslator. It is
 * designed to work with PineconeStore, a type of vector store in
 * LangChain. The class is initialized with a set of allowed operators and
 * comparators, which are used in the translation process to construct
 * queries and compare results.
 * @example
 * ```typescript
 * const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
 *   llm: new ChatOpenAI(),
 *   vectorStore: new PineconeStore(),
 *   documentContents: "Brief summary of a movie",
 *   attributeInfo: [],
 *   structuredQueryTranslator: new PineconeTranslator(),
 * });
 *
 * const queryResult = await selfQueryRetriever.getRelevantDocuments(
 *   "Which movies are directed by Greta Gerwig?",
 * );
 * ```
 */
export class PineconeTranslator<
  T extends PineconeStore
> extends BasicTranslator<T> {
  constructor() {
    super({
      allowedOperators: [Operators.and, Operators.or],
      allowedComparators: [
        Comparators.eq,
        Comparators.ne,
        Comparators.gt,
        Comparators.gte,
        Comparators.lt,
        Comparators.lte,
      ],
    });
  }
}
