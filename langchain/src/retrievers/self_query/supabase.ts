import {
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
} from "../../chains/query_constructor/ir.js";
import { SupabaseFilterRPCCall } from "../../vectorstores/supabase.js";
import { BaseTranslator } from "./base.js";

type ValueType = {
  eq: string | number;
  ne: string | number;
  lt: string | number;
  lte: string | number;
  gt: string | number;
  gte: string | number;
};

export class SupabaseTranslator extends BaseTranslator {
  declare VisitOperationOutput: SupabaseFilterRPCCall;

  declare VisitComparisonOutput: SupabaseFilterRPCCall;

  declare VisitStructuredQueryOutput: { filter: SupabaseFilterRPCCall };

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
  ): (attr: string, value: ValueType[C]) => SupabaseFilterRPCCall {
    switch (comparator) {
      case Comparators.eq: {
        return (attr: string, value: ValueType[C]) => (rpc) =>
          rpc.eq(this.buildColumnName(attr, value), value);
      }
      case Comparators.ne: {
        return (attr: string, value: ValueType[C]) => (rpc) =>
          rpc.neq(this.buildColumnName(attr, value), value);
      }
      case Comparators.gt: {
        return (attr: string, value: ValueType[C]) => (rpc) =>
          rpc.gt(this.buildColumnName(attr, value), value);
      }
      case Comparators.gte: {
        return (attr: string, value: ValueType[C]) => (rpc) =>
          rpc.gte(this.buildColumnName(attr, value), value);
      }
      case Comparators.lt: {
        return (attr: string, value: ValueType[C]) => (rpc) =>
          rpc.lt(this.buildColumnName(attr, value), value);
      }
      case Comparators.lte: {
        return (attr: string, value: ValueType[C]) => (rpc) =>
          rpc.lte(this.buildColumnName(attr, value), value);
      }
      default: {
        throw new Error("Unknown comparator");
      }
    }
  }

  buildColumnName(attr: string, value: string | number, includeType = true) {
    let column = "";
    if (typeof value === "string") {
      column = `metadata->>${attr}`;
    } else if (typeof value === "number") {
      column = `metadata->${attr}${includeType ? "::int" : ""}`;
    } else {
      throw new Error("Data type not supported");
    }

    return column;
  }

  visitOperationAsString(operation: Operation): string {
    const { args } = operation;
    if (!args) {
      return "";
    }
    return args
      ?.reduce((acc, arg) => {
        if (arg.exprName === "Comparison") {
          acc.push(this.visitComparisonAsString(arg as Comparison));
        } else if (arg.exprName === "Operation") {
          const { operator: innerOperator } = arg as Operation;
          acc.push(
            `${innerOperator}(${this.visitOperationAsString(arg as Operation)})`
          );
        }
        return acc;
      }, [] as string[])
      .join(",");
  }

  visitOperation(operation: Operation): this["VisitOperationOutput"] {
    const { operator, args } = operation;
    if (this.allowedOperators.includes(operator)) {
      if (operator === Operators.and) {
        if (!args) {
          return (rpc) => rpc;
        }
        const filter: SupabaseFilterRPCCall = (rpc) =>
          args.reduce((acc, arg) => {
            const filter = arg.accept(this) as SupabaseFilterRPCCall;
            return filter(acc);
          }, rpc);
        return filter;
      } else if (operator === Operators.or) {
        return (rpc) => rpc.or(this.visitOperationAsString(operation));
      } else {
        throw new Error("Unknown operator");
      }
    } else {
      throw new Error("Operator not allowed");
    }
  }

  visitComparisonAsString(comparison: Comparison): string {
    let { value } = comparison;
    const { comparator: _comparator, attribute } = comparison;
    let comparator = _comparator as string;
    if (comparator === Comparators.ne) {
      comparator = "neq";
    }
    if (Array.isArray(value)) {
      value = `(${value
        .map((v) => {
          if (typeof v === "string" && /[,()]/.test(v)) return `"${v}"`;
          return v;
        })
        .join(",")})`;
    }
    return `${this.buildColumnName(
      attribute,
      value,
      false
    )}.${comparator}.${value}}`;
  }

  visitComparison(comparison: Comparison): this["VisitComparisonOutput"] {
    const { comparator, attribute, value } = comparison;
    if (this.allowedComparators.includes(comparator)) {
      const comparatorFunction = this.getComparatorFunction(
        comparator as Comparator
      );
      return comparatorFunction(attribute, value);
    } else {
      throw new Error("Comparator not allowed");
    }
  }

  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    const filterFunction = query.filter?.accept(this);
    if (typeof filterFunction !== "function") {
      throw new Error("Structured query filter is not a function");
    }
    return { filter: filterFunction as SupabaseFilterRPCCall };
  }
}
