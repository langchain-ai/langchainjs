import {
  BasicTranslator,
  Comparators,
  Operators,
} from "@langchain/core/structured_query";
import { VectorStore } from "@langchain/core/vectorstores";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "retrievers/self_query/chroma",
  newEntrypointName: "structured_query/chroma",
  newPackageName: "@langchain/community",
});

/**
 * Specialized translator for the Chroma vector database. It extends the
 * BasicTranslator class and translates internal query language elements
 * to valid filters. The class defines a subset of allowed logical
 * operators and comparators that can be used in the translation process.
 * @example
 * ```typescript
 * const chromaTranslator = new ChromaTranslator();
 * const selfQueryRetriever = new SelfQueryRetriever({
 *   llm: new ChatOpenAI(),
 *   vectorStore: new Chroma(),
 *   documentContents: "Brief summary of a movie",
 *   attributeInfo: [],
 *   structuredQueryTranslator: chromaTranslator,
 * });
 *
 * const relevantDocuments = await selfQueryRetriever.getRelevantDocuments(
 *   "Which movies are directed by Greta Gerwig?",
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ChromaTranslator<
  T extends VectorStore
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
