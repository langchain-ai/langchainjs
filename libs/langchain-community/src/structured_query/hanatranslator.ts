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
  castValue,
  isFilterEmpty,
} from "@langchain/core/structured_query";
import { HanaDB } from "../vectorstores/hanavector.js";

/**
 * Specialized translator for the HanaDB vector database. It extends the
 * BasicTranslator class and translates internal query language elements
 * to valid filters. The class defines a subset of allowed logical
 * operators and comparators that can be used in the translation process.
 * @example
 * ```typescript
 * const hanaTranslator = new HanaTranslator();
 * const selfQueryRetriever = new SelfQueryRetriever({
 *   llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
 *   vectorStore: new HanaDB(),
 *   documentContents: "Brief summary of a movie",
 *   attributeInfo: [],
 *   structuredQueryTranslator: hanaTranslator,
 * });
 *
 * const relevantDocuments = await selfQueryRetriever.getRelevantDocuments(
 *   "Which movies are directed by Greta Gerwig?",
 * );
 * ```
 */
export class HanaTranslator<T extends HanaDB> extends BaseTranslator<T> {
  allowedOperators: Operator[] = [Operators.and, Operators.or];

  allowedComparators = [
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
          `Comparator ${func} not allowed. Allowed operators: ${this.allowedComparators.join(
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
    structuredQuery: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    let nextArg = {} as this["VisitStructuredQueryOutput"];
    if (structuredQuery.filter) {
      nextArg = {
        filter: structuredQuery.filter.accept(this as Visitor),
      } as this["VisitStructuredQueryOutput"];
    }
    return nextArg;
  }

  mergeFilters(
    defaultFilter: this["VisitStructuredQueryOutput"]["filter"] | undefined,
    generatedFilter: this["VisitStructuredQueryOutput"]["filter"] | undefined,
    mergeType?: "and" | "or" | "replace",
    forceDefaultFilter?: boolean
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
