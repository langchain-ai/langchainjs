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
import { BaseTranslator } from "./base.js";

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
  filter?:
    | WeaviateComparisonResult
    | WeaviateOperationResult
    | WeaviateStructuredQueryResult;
};

export class WeaviateTranslator extends BaseTranslator {
  declare VisitOperationOutput: WeaviateOperationResult;

  declare VisitComparisonOutput: WeaviateComparisonResult;

  declare VisitStructuredQueryOutput: WeaviateStructuredQueryResult;

  allowedOperators: Operator[] = [Operators.and, Operators.or];

  allowedComparators: Comparator[] = [
    Comparators.eq,
    Comparators.ne,
    Comparators.lt,
    Comparators.lte,
    Comparators.gt,
    Comparators.gte,
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

  visitOperation(operation: Operation): this["VisitOperationOutput"] {
    const args = operation.args?.map((arg) =>
      arg.accept(this as Visitor)
    ) as WeaviateVisitorResult[];
    return {
      operator: this.formatFunction(operation.operator),
      operands: args,
    };
  }

  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    if (typeof comparison.value === "string") {
      return {
        path: [comparison.attribute],
        operator: this.formatFunction(comparison.comparator),
        valueText: comparison.value,
      };
    }
    if (typeof comparison.value === "number") {
      if (Number.isInteger(comparison.value)) {
        return {
          path: [comparison.attribute],
          operator: this.formatFunction(comparison.comparator),
          valueInt: comparison.value,
        };
      } else {
        return {
          path: [comparison.attribute],
          operator: this.formatFunction(comparison.comparator),
          valueNumber: comparison.value,
        };
      }
    }
    throw new Error("Value type is not supported");
  }

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
}
