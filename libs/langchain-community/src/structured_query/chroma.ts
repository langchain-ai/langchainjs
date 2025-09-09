import {
  BaseTranslator,
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
  Visitor,
  isFilterEmpty,
  castValue,
} from "@langchain/core/structured_query";
import { Chroma } from "../vectorstores/chroma.js";

/**
 * Specialized translator for the Chroma vector database. It extends the
 * BasicTranslator class and translates internal query language elements
 * to valid filters. The class defines a subset of allowed logical
 * operators and comparators that can be used in the translation process.
 * @example
 * ```typescript
 * const chromaTranslator = new ChromaTranslator();
 * const selfQueryRetriever = new SelfQueryRetriever({
 *   llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
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
export class ChromaTranslator<T extends Chroma> extends BaseTranslator<T> {
  declare VisitOperationOutput: T["FilterType"];

  declare VisitComparisonOutput: T["FilterType"];

  allowedOperators: Operator[] = [Operators.and, Operators.or];

  allowedComparators: Comparator[] = [
    Comparators.eq,
    Comparators.ne,
    Comparators.gt,
    Comparators.gte,
    Comparators.lt,
    Comparators.lte,
  ];

  formatFunction(func: Operator | Comparator): string {
    if (func in Comparators) {
      if (
        this.allowedComparators.length > 0 &&
        this.allowedComparators.indexOf(func as Comparator) === -1
      ) {
        throw new Error(
          `Comparator ${func} not allowed. Allowed comparators: ${this.allowedComparators.join(
            ", "
          )}`
        );
      }
    } else if (func in Operators) {
      if (
        this.allowedOperators.length > 0 &&
        this.allowedOperators.indexOf(func as Operator) === -1
      ) {
        throw new Error(
          `Operator ${func} not allowed. Allowed operators: ${this.allowedOperators.join(
            ", "
          )}`
        );
      }
    } else {
      throw new Error("Unknown comparator or operator");
    }
    return `$${func}`;
  }

  visitOperation(operation: Operation): this["VisitOperationOutput"] {
    const args = operation.args?.map((arg) => arg.accept(this as Visitor));
    return {
      [this.formatFunction(operation.operator)]: args,
    } as this["VisitOperationOutput"];
  }

  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    return {
      [comparison.attribute]: {
        [this.formatFunction(comparison.comparator)]: castValue(
          comparison.value
        ),
      },
    } as this["VisitComparisonOutput"];
  }

  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    let nextArg = {} as this["VisitStructuredQueryOutput"];
    if (query.filter) {
      nextArg = {
        filter: query.filter.accept(this as Visitor),
      } as this["VisitStructuredQueryOutput"];
    }
    return nextArg;
  }

  mergeFilters(
    defaultFilter: this["VisitStructuredQueryOutput"]["filter"] | undefined,
    generatedFilter: this["VisitStructuredQueryOutput"]["filter"] | undefined,
    mergeType: "and" | "or" | "replace" = "and",
    forceDefaultFilter = false
  ): this["VisitStructuredQueryOutput"]["filter"] | undefined {
    if (isFilterEmpty(defaultFilter) && isFilterEmpty(generatedFilter)) {
      return undefined;
    }
    if (isFilterEmpty(defaultFilter) || mergeType === "replace") {
      if (isFilterEmpty(generatedFilter)) {
        return undefined;
      }
      return generatedFilter;
    }
    if (isFilterEmpty(generatedFilter)) {
      if (forceDefaultFilter) {
        return defaultFilter;
      }
      if (mergeType === "and") {
        return undefined;
      }
      return defaultFilter;
    }
    if (mergeType === "and") {
      return {
        $and: [defaultFilter, generatedFilter],
      } as this["VisitStructuredQueryOutput"]["filter"];
    } else if (mergeType === "or") {
      return {
        $or: [defaultFilter, generatedFilter],
      } as this["VisitStructuredQueryOutput"]["filter"];
    } else {
      throw new Error("Unknown merge type");
    }
  }
}
