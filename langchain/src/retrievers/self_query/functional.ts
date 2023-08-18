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
import { isFilterEmpty } from "./utils.js";

type ValueType = {
  eq: string | number;
  ne: string | number;
  lt: string | number;
  lte: string | number;
  gt: string | number;
  gte: string | number;
};

export type FunctionFilter = (document: Document) => boolean;

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
        return comparatorFunction(documentValue, value);
      };
    } else {
      throw new Error("Comparator not allowed");
    }
  }

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
