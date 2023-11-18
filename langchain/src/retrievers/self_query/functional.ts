import {
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
} from "../../chains/query_constructor/ir.js";
import { Document } from "../../document.js";
import { BaseTranslator } from "./base.js";
import { castValue, isFilterEmpty } from "./utils.js";

/**
 * A type alias for an object that maps comparison operators to string or
 * number values. This is used in the comparison functions to determine
 * the result of a comparison operation.
 */
type ValueType = {
  eq: string | number;
  ne: string | number;
  lt: string | number;
  lte: string | number;
  gt: string | number;
  gte: string | number;
};

/**
 * A type alias for a function that takes a `Document` as an argument and
 * returns a boolean. This function is used as a filter for documents.
 */
export type FunctionFilter = (document: Document) => boolean;

/**
 * A class that extends `BaseTranslator` to translate structured queries
 * into functional filters.
 * @example
 * ```typescript
 * const functionalTranslator = new FunctionalTranslator();
 * const relevantDocuments = await functionalTranslator.getRelevantDocuments(
 *   "Which movies are rated higher than 8.5?",
 * );
 * ```
 */
export class FunctionalTranslator extends BaseTranslator {
  declare VisitOperationOutput: FunctionFilter;

  declare VisitComparisonOutput: FunctionFilter;

  declare VisitStructuredQueryOutput:
    | { filter: FunctionFilter }
    | { [k: string]: never };

  allowedOperators: Operator[] = [Operators.and, Operators.or];

  allowedComparators: Comparator[] = [
    Comparators.eq,
    Comparators.ne,
    Comparators.gt,
    Comparators.gte,
    Comparators.lt,
    Comparators.lte,
  ];

  formatFunction(): string {
    throw new Error("Not implemented");
  }

  /**
   * Returns a function that performs a comparison based on the provided
   * comparator.
   * @param comparator The comparator to base the comparison function on.
   * @returns A function that takes two arguments and returns a boolean based on the comparison.
   */
  getComparatorFunction<C extends Comparator>(
    comparator: Comparator
  ): (a: string | number, b: ValueType[C]) => boolean {
    switch (comparator) {
      case Comparators.eq: {
        return (a: string | number, b: ValueType[C]) => a === b;
      }
      case Comparators.ne: {
        return (a: string | number, b: ValueType[C]) => a !== b;
      }
      case Comparators.gt: {
        return (a: string | number, b: ValueType[C]) => a > b;
      }
      case Comparators.gte: {
        return (a: string | number, b: ValueType[C]) => a >= b;
      }
      case Comparators.lt: {
        return (a: string | number, b: ValueType[C]) => a < b;
      }
      case Comparators.lte: {
        return (a: string | number, b: ValueType[C]) => a <= b;
      }
      default: {
        throw new Error("Unknown comparator");
      }
    }
  }

  /**
   * Returns a function that performs an operation based on the provided
   * operator.
   * @param operator The operator to base the operation function on.
   * @returns A function that takes two boolean arguments and returns a boolean based on the operation.
   */
  getOperatorFunction(operator: Operator): (a: boolean, b: boolean) => boolean {
    switch (operator) {
      case Operators.and: {
        return (a, b) => a && b;
      }
      case Operators.or: {
        return (a, b) => a || b;
      }
      default: {
        throw new Error("Unknown operator");
      }
    }
  }

  /**
   * Visits the operation part of a structured query and translates it into
   * a functional filter.
   * @param operation The operation part of a structured query.
   * @returns A function that takes a `Document` as an argument and returns a boolean based on the operation.
   */
  visitOperation(operation: Operation): this["VisitOperationOutput"] {
    const { operator, args } = operation;
    if (this.allowedOperators.includes(operator)) {
      const operatorFunction = this.getOperatorFunction(operator);
      return (document: Document) => {
        if (!args) {
          return true;
        }

        return args.reduce((acc, arg) => {
          const result = arg.accept(this);
          if (typeof result === "function") {
            return operatorFunction(acc, result(document));
          } else {
            throw new Error("Filter is not a function");
          }
        }, true);
      };
    } else {
      throw new Error("Operator not allowed");
    }
  }

  /**
   * Visits the comparison part of a structured query and translates it into
   * a functional filter.
   * @param comparison The comparison part of a structured query.
   * @returns A function that takes a `Document` as an argument and returns a boolean based on the comparison.
   */
  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    const { comparator, attribute, value } = comparison;
    const undefinedTrue = [Comparators.ne];
    if (this.allowedComparators.includes(comparator)) {
      const comparatorFunction = this.getComparatorFunction(comparator);
      return (document: Document) => {
        const documentValue = document.metadata[attribute];
        if (documentValue === undefined) {
          if (undefinedTrue.includes(comparator)) {
            return true;
          }
          return false;
        }
        return comparatorFunction(documentValue, castValue(value));
      };
    } else {
      throw new Error("Comparator not allowed");
    }
  }

  /**
   * Visits a structured query and translates it into a functional filter.
   * @param query The structured query to translate.
   * @returns An object containing a `filter` property, which is a function that takes a `Document` as an argument and returns a boolean based on the structured query.
   */
  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    if (!query.filter) {
      return {};
    }
    const filterFunction = query.filter?.accept(this);
    if (typeof filterFunction !== "function") {
      throw new Error("Structured query filter is not a function");
    }
    return { filter: filterFunction as FunctionFilter };
  }

  /**
   * Merges two filters into one, based on the specified merge type.
   * @param defaultFilter The default filter function.
   * @param generatedFilter The generated filter function.
   * @param mergeType The type of merge to perform. Can be 'and', 'or', or 'replace'. Default is 'and'.
   * @returns A function that takes a `Document` as an argument and returns a boolean based on the merged filters, or `undefined` if both filters are empty.
   */
  mergeFilters(
    defaultFilter: FunctionFilter,
    generatedFilter: FunctionFilter,
    mergeType = "and"
  ): FunctionFilter | undefined {
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
      if (mergeType === "and") {
        return undefined;
      }
      return defaultFilter;
    }

    if (mergeType === "and") {
      return (document: Document) =>
        defaultFilter(document) && generatedFilter(document);
    } else if (mergeType === "or") {
      return (document: Document) =>
        defaultFilter(document) || generatedFilter(document);
    } else {
      throw new Error("Unknown merge type");
    }
  }
}
