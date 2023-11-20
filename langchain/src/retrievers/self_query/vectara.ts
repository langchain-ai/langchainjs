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
import { VectaraFilter, VectaraStore } from "../../vectorstores/vectara.js";
import { BaseTranslator } from "./base.js";
import { isFilterEmpty } from "./utils.js";

type AllowedOperator = Exclude<Operator, NOT>;

export type VectaraVisitorResult =
  | VectaraOperationResult
  | VectaraComparisonResult
  | VectaraVisitorStructuredQueryResult;
// eslint-disable-next-line @typescript-eslint/ban-types
export type VectaraOperationResult = String;
// eslint-disable-next-line @typescript-eslint/ban-types
export type VectaraComparisonResult = String;
export type VectaraVisitorStructuredQueryResult = {
  filter?: { filter?: VectaraOperationResult | VectaraComparisonResult };
};

type Value = number | string;
function processValue(value: Value): string {
  /** Convert a value to a string and add single quotes if it is a string. */
  if (typeof value === "string") {
    return `'${value}'`;
  } else {
    return String(value);
  }
}

export class VectaraTranslator<
  T extends VectaraStore
> extends BaseTranslator<T> {
  declare VisitOperationOutput: VectaraOperationResult;

  declare VisitComparisonOutput: VectaraComparisonResult;

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

    const mapDict = {
      and: " and ",
      or: " or ",
      eq: "=",
      ne: "!=",
      lt: "<",
      lte: "<=",
      gt: ">",
      gte: ">=",
    };
    return mapDict[func as Comparator | AllowedOperator];
  }

  /**
   * Visits an operation and returns a VectaraOperationResult. The
   * operation's arguments are visited and the operator is formatted.
   * @param operation The operation to visit.
   * @returns A VectaraOperationResult.
   */
  visitOperation(operation: Operation): this["VisitOperationOutput"] {
    const args = operation.args?.map((arg) =>
      arg.accept(this as Visitor)
    ) as VectaraVisitorResult[];
    const operator = this.formatFunction(operation.operator);
    return `( ${args.join(operator)} )`;
  }

  /**
   * Visits a comparison and returns a VectaraComparisonResult. The
   * comparison's value is checked for type and the comparator is formatted.
   * Throws an error if the value type is not supported.
   * @param comparison The comparison to visit.
   * @returns A VectaraComparisonResult.
   */
  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    const comparator = this.formatFunction(comparison.comparator);
    return `( doc.${comparison.attribute} ${comparator} ${processValue(
      comparison.value
    )} )`;
  }

  /**
   * Visits a structured query and returns a VectaraStructuredQueryResult.
   * If the query has a filter, it is visited.
   * @param query The structured query to visit.
   * @returns A VectaraStructuredQueryResult.
   */
  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    let nextArg = {};
    if (query.filter) {
      nextArg = {
        filter: { filter: query.filter.accept(this as Visitor) },
      };
    }
    return nextArg;
  }

  mergeFilters(
    defaultFilter: VectaraFilter | undefined,
    generatedFilter: VectaraFilter | undefined,
    mergeType = "and",
    forceDefaultFilter = false
  ): VectaraFilter | undefined {
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
        filter: `${defaultFilter} and ${generatedFilter}`,
      } as VectaraFilter;
    } else if (mergeType === "or") {
      return {
        filter: `${defaultFilter} or ${generatedFilter}`,
      };
    } else {
      throw new Error("Unknown merge type");
    }
  }
}
