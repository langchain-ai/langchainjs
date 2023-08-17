import {
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
  Visitor,
  VisitorComparisonResult,
  VisitorOperationResult,
  VisitorResult,
  VisitorStructuredQueryResult,
} from "../../chains/query_constructor/ir.js";
import { VectorStore } from "../../vectorstores/base.js";
import { isFilterEmpty } from "./utils.js";

export type TranslatorOpts = {
  allowedOperators: Operator[];
  allowedComparators: Comparator[];
};

export abstract class BaseTranslator<
  T extends VectorStore = VectorStore
> extends Visitor<T> {
  abstract formatFunction(func: Operator | Comparator): string;

  abstract mergeFilters(
    defaultFilter: this["VisitStructuredQueryOutput"]["filter"] | undefined,
    generatedFilter: this["VisitStructuredQueryOutput"]["filter"] | undefined,
    mergeType?: "and" | "or" | "replace"
  ): this["VisitStructuredQueryOutput"]["filter"] | undefined;
}

export class BasicTranslator<
  T extends VectorStore = VectorStore
> extends BaseTranslator<T> {
  declare VisitOperationOutput: VisitorOperationResult;

  declare VisitComparisonOutput: VisitorComparisonResult;

  declare VisitStructuredQueryOutput: VisitorStructuredQueryResult;

  allowedOperators: Operator[];

  allowedComparators: Comparator[];

  constructor(opts?: TranslatorOpts) {
    super();
    this.allowedOperators = opts?.allowedOperators ?? [
      Operators.and,
      Operators.or,
    ];
    this.allowedComparators = opts?.allowedComparators ?? [
      Comparators.eq,
      Comparators.ne,
      Comparators.gt,
      Comparators.gte,
      Comparators.lt,
      Comparators.lte,
    ];
  }

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
    const args = operation.args?.map((arg) =>
      arg.accept(this)
    ) as VisitorResult[];
    return {
      [this.formatFunction(operation.operator)]: args,
    };
  }

  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    return {
      [comparison.attribute]: {
        [this.formatFunction(comparison.comparator)]: comparison.value,
      },
    };
  }

  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    let nextArg = {};
    if (query.filter) {
      nextArg = {
        filter: query.filter.accept(this),
      };
    }
    return nextArg;
  }

  mergeFilters(
    defaultFilter: VisitorStructuredQueryResult["filter"] | undefined,
    generatedFilter: VisitorStructuredQueryResult["filter"] | undefined,
    mergeType = "and"
  ): VisitorStructuredQueryResult["filter"] | undefined {
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
      return {
        $and: [defaultFilter, generatedFilter],
      };
    } else if (mergeType === "or") {
      return {
        $or: [defaultFilter, generatedFilter],
      };
    } else {
      throw new Error("Unknown merge type");
    }
  }
}
