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
import { isFilterEmpty } from "./utils.js";

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

function isInt(value: unknown): boolean {
  const numberValue = parseFloat(value as string);
  return !Number.isNaN(numberValue) && numberValue % 1 === 0;
}

function isFloat(value: unknown): boolean {
  const numberValue = parseFloat(value as string);
  return !Number.isNaN(numberValue) && numberValue % 1 !== 0;
}

function isString(value: unknown): boolean {
  return typeof value === "string" && Number.isNaN(parseFloat(value as string));
}

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
