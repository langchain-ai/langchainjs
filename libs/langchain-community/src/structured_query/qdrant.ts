import {
  isFilterEmpty,
  castValue,
  isInt,
  isFloat,
  BaseTranslator,
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
  Visitor,
} from "@langchain/core/structured_query";

import {
  QdrantVectorStore,
  QdrantFilter,
  QdrantCondition,
} from "../vectorstores/qdrant.js";

/**
 * A class that translates or converts `StructuredQuery` to equivalent Qdrant filters.
 * @example
 * ```typescript
 * const selfQueryRetriever = new SelfQueryRetriever({
 *   llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
 *   vectorStore: new QdrantVectorStore(...),
 *   documentContents: "Brief summary of a movie",
 *   attributeInfo: [],
 *   structuredQueryTranslator: new QdrantTranslator(),
 * });
 *
 * const relevantDocuments = await selfQueryRetriever.getRelevantDocuments(
 *   "Which movies are rated higher than 8.5?",
 * );
 * ```
 */
export class QdrantTranslator<
  T extends QdrantVectorStore
> extends BaseTranslator<T> {
  declare VisitOperationOutput: QdrantFilter;

  declare VisitComparisonOutput: QdrantCondition;

  allowedOperators: Operator[] = [Operators.and, Operators.or, Operators.not];

  allowedComparators: Comparator[] = [
    Comparators.eq,
    Comparators.ne,
    Comparators.lt,
    Comparators.lte,
    Comparators.gt,
    Comparators.gte,
  ];

  /**
   * Visits an operation and returns a QdrantFilter.
   * @param operation The operation to visit.
   * @returns A QdrantFilter.
   */
  visitOperation(operation: Operation): this["VisitOperationOutput"] {
    const args = operation.args?.map((arg) => arg.accept(this as Visitor));

    const operator = {
      [Operators.and]: "must",
      [Operators.or]: "should",
      [Operators.not]: "must_not",
    }[operation.operator];

    return {
      [operator]: args,
    };
  }

  /**
   * Visits a comparison and returns a QdrantCondition.
   * The value is casted to the correct type.
   * The attribute is prefixed with "metadata.",
   * since metadata is nested in the Qdrant payload.
   * @param comparison The comparison to visit.
   * @returns A QdrantCondition.
   */
  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    const attribute = `metadata.${comparison.attribute}`;
    const value = castValue(comparison.value);

    if (comparison.comparator === "eq") {
      return {
        key: attribute,
        match: {
          value,
        },
      };
    } else if (comparison.comparator === "ne") {
      return {
        key: attribute,
        match: {
          except: [value],
        },
      };
    }

    if (!isInt(value) && !isFloat(value)) {
      throw new Error("Value for gt, gte, lt, lte must be a number");
    }

    // For gt, gte, lt, lte, we need to use the range filter
    return {
      key: attribute,
      range: {
        [comparison.comparator]: value,
      },
    };
  }

  /**
   * Visits a structured query and returns a VisitStructuredQueryOutput.
   * If the query has a filter, it is visited.
   * @param query The structured query to visit.
   * @returns An instance of VisitStructuredQueryOutput.
   */
  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    let nextArg = {};
    if (query.filter) {
      nextArg = {
        filter: { must: [query.filter.accept(this as Visitor)] },
      };
    }
    return nextArg;
  }

  /**
   * Merges two filters into one. If both filters are empty, returns
   * undefined. If one filter is empty or the merge type is 'replace',
   * returns the other filter. If the merge type is 'and' or 'or', returns a
   * new filter with the merged results. Throws an error for unknown merge
   * types.
   * @param defaultFilter The default filter to merge.
   * @param generatedFilter The generated filter to merge.
   * @param mergeType The type of merge to perform. Can be 'and', 'or', or 'replace'. Defaults to 'and'.
   * @param forceDefaultFilter If true, the default filter is always returned if the generated filter is empty. Defaults to false.
   * @returns A merged QdrantFilter, or undefined if both filters are empty.
   */
  mergeFilters(
    defaultFilter: QdrantFilter | undefined,
    generatedFilter: QdrantFilter | undefined,
    mergeType = "and",
    forceDefaultFilter = false
  ): QdrantFilter | undefined {
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
        must: [defaultFilter, generatedFilter],
      };
    } else if (mergeType === "or") {
      return {
        should: [defaultFilter, generatedFilter],
      };
    } else {
      throw new Error("Unknown merge type");
    }
  }

  formatFunction(): string {
    throw new Error("Not implemented");
  }
}
