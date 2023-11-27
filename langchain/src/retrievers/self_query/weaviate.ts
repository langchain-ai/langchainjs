import {
  Comparator,
  Comparators,
  Comparison,
  NOT,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
  Visitor,
} from "../../chains/query_constructor/ir.js";
import { WeaviateFilter, WeaviateStore } from "../../vectorstores/weaviate.js";
import { BaseTranslator } from "./base.js";
import { isFilterEmpty, isString, isInt, isFloat } from "./utils.js";

type AllowedOperator = Exclude<Operator, NOT>;

type WeaviateOperatorValues = {
  valueText: string;
  valueInt: number;
  valueNumber: number;
  valueBoolean: boolean;
};

type WeaviateOperatorKeys = keyof WeaviateOperatorValues;

type ExclusiveOperatorValue = {
  [L in WeaviateOperatorKeys]: {
    [key in L]: WeaviateOperatorValues[key];
  } & Omit<{ [key in WeaviateOperatorKeys]?: never }, L>;
}[WeaviateOperatorKeys];

export type WeaviateVisitorResult =
  | WeaviateOperationResult
  | WeaviateComparisonResult
  | WeaviateStructuredQueryResult;

export type WeaviateOperationResult = {
  operator: string;
  operands: WeaviateVisitorResult[];
};
export type WeaviateComparisonResult = {
  path: [string];
  operator: string;
} & ExclusiveOperatorValue;

export type WeaviateStructuredQueryResult = {
  filter?: {
    where?: WeaviateComparisonResult | WeaviateOperationResult;
  };
};

/**
 * A class that translates or converts data into a format that can be used
 * with Weaviate, a vector search engine. It extends the `BaseTranslator`
 * class and provides specific implementation for Weaviate.
 * @example
 * ```typescript
 * const selfQueryRetriever = new SelfQueryRetriever({
 *   llm: new ChatOpenAI(),
 *   vectorStore: new WeaviateStore(),
 *   documentContents: "Brief summary of a movie",
 *   attributeInfo: [],
 *   structuredQueryTranslator: new WeaviateTranslator(),
 * });
 *
 * const relevantDocuments = await selfQueryRetriever.getRelevantDocuments(
 *   "Which movies are rated higher than 8.5?",
 * );
 * ```
 */
export class WeaviateTranslator<
  T extends WeaviateStore
> extends BaseTranslator<T> {
  declare VisitOperationOutput: WeaviateOperationResult;

  declare VisitComparisonOutput: WeaviateComparisonResult;

  allowedOperators: Operator[] = [Operators.and, Operators.or];

  allowedComparators: Comparator[] = [
    Comparators.eq,
    Comparators.ne,
    Comparators.lt,
    Comparators.lte,
    Comparators.gt,
    Comparators.gte,
  ];

  /**
   * Formats the given function into a string representation. Throws an
   * error if the function is not a known comparator or operator, or if it
   * is not allowed.
   * @param func The function to format, which can be an Operator or Comparator.
   * @returns A string representation of the function.
   */
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
    const dict = {
      and: "And",
      or: "Or",
      eq: "Equal",
      ne: "NotEqual",
      lt: "LessThan",
      lte: "LessThanEqual",
      gt: "GreaterThan",
      gte: "GreaterThanEqual",
    };
    return dict[func as Comparator | AllowedOperator];
  }

  /**
   * Visits an operation and returns a WeaviateOperationResult. The
   * operation's arguments are visited and the operator is formatted.
   * @param operation The operation to visit.
   * @returns A WeaviateOperationResult.
   */
  visitOperation(operation: Operation): this["VisitOperationOutput"] {
    const args = operation.args?.map((arg) =>
      arg.accept(this as Visitor)
    ) as WeaviateVisitorResult[];
    return {
      operator: this.formatFunction(operation.operator),
      operands: args,
    };
  }

  /**
   * Visits a comparison and returns a WeaviateComparisonResult. The
   * comparison's value is checked for type and the comparator is formatted.
   * Throws an error if the value type is not supported.
   * @param comparison The comparison to visit.
   * @returns A WeaviateComparisonResult.
   */
  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    if (isString(comparison.value)) {
      return {
        path: [comparison.attribute],
        operator: this.formatFunction(comparison.comparator),
        valueText: comparison.value as string,
      };
    }
    if (isInt(comparison.value)) {
      return {
        path: [comparison.attribute],
        operator: this.formatFunction(comparison.comparator),
        valueInt: parseInt(comparison.value as string, 10),
      };
    }
    if (isFloat(comparison.value)) {
      return {
        path: [comparison.attribute],
        operator: this.formatFunction(comparison.comparator),
        valueNumber: parseFloat(comparison.value as string),
      };
    }

    throw new Error("Value type is not supported");
  }

  /**
   * Visits a structured query and returns a WeaviateStructuredQueryResult.
   * If the query has a filter, it is visited.
   * @param query The structured query to visit.
   * @returns A WeaviateStructuredQueryResult.
   */
  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    let nextArg = {};
    if (query.filter) {
      nextArg = {
        filter: { where: query.filter.accept(this as Visitor) },
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
   * @returns A merged WeaviateFilter, or undefined if both filters are empty.
   */
  mergeFilters(
    defaultFilter: WeaviateFilter | undefined,
    generatedFilter: WeaviateFilter | undefined,
    mergeType = "and"
  ): WeaviateFilter | undefined {
    if (
      isFilterEmpty(defaultFilter?.where) &&
      isFilterEmpty(generatedFilter?.where)
    ) {
      return undefined;
    }
    if (isFilterEmpty(defaultFilter?.where) || mergeType === "replace") {
      if (isFilterEmpty(generatedFilter?.where)) {
        return undefined;
      }
      return generatedFilter;
    }
    if (isFilterEmpty(generatedFilter?.where)) {
      if (mergeType === "and") {
        return undefined;
      }
      return defaultFilter;
    }
    const merged: WeaviateOperationResult = {
      operator: "And",
      operands: [
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        defaultFilter!.where as WeaviateVisitorResult,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        generatedFilter!.where as WeaviateVisitorResult,
      ],
    };
    if (mergeType === "and") {
      return {
        where: merged,
      } as WeaviateFilter;
    } else if (mergeType === "or") {
      merged.operator = "Or";
      return {
        where: merged,
      } as WeaviateFilter;
    } else {
      throw new Error("Unknown merge type");
    }
  }
}
