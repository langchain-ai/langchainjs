/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
} from "../../chains/query_constructor/ir.js";
import {
  SupabaseFilter,
  SupabaseFilterRPCCall,
  SupabaseVectorStore,
} from "../../vectorstores/supabase.js";
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

type SupabaseFilterProps = keyof SupabaseFilter;

class ProxyParamsDuplicator {
  duplicationAllowedOps: string[] = [
    "eq",
    "ne",
    "lt",
    "lte",
    "gt",
    "gte",
    "like",
    "ilike",
    "or",
    "in",
    "contains",
    "textSearch",
    "filter",
  ];

  values: [string, string][] = [];

  buildProxyHandler() {
    const proxyHandler: ProxyHandler<SupabaseFilter> = {
      get: (target, prop, receiver) => {
        if (typeof target[prop as SupabaseFilterProps] === "function") {
          return (...args: any[]) => {
            if (this.duplicationAllowedOps.includes(String(prop))) {
              if (String(prop) === "or") {
                const filters = args[0] as string;
                const { foreignTable } = args[1] as { foreignTable?: string };
                this.or(filters, foreignTable);
              } else if (String(prop) === "filter") {
                const column = args[0] as string;
                const operator = args[1] as string;
                const value = args[2] as unknown;
                this.filter(column, operator, value);
              } else if (String(prop) === "in") {
                const column = args[0] as string;
                const values = args[1] as unknown[];
                this.in(column, values);
              } else if (String(prop) === "contains") {
                const column = args[0] as string;
                const value = args[1] as unknown[];
                this.contains(column, value);
              } else if (String(prop) === "textSearch") {
                const column = args[0] as string;
                const query = args[1] as string[];
                const { config, type } = (args[2] ?? {}) as {
                  config?: string;
                  type?: "plain" | "phrase" | "websearch";
                };
                this.textSearch(column, query, { config, type });
              } else {
                const column = args[0] as string;
                const value = args[1] as string;
                this.values.push([
                  this.removeType(column),
                  `${String(prop)}.${value}`,
                ]);
              }
              return new Proxy(target, proxyHandler);
            } else {
              throw new Error(
                "Duplication operation not supported for 'or' mergeFiltersOperator"
              );
            }
          };
        } else {
          return Reflect.get(target, prop, receiver);
        }
      },
    };

    return proxyHandler;
  }

  addToValues(column: string, value: string) {
    this.values.push([column, value]);
  }

  removeType(value: string) {
    if (value.includes("::int")) {
      return value.replace("::int", "");
    }
    return value;
  }

  or(filters: string, foreignTable?: string) {
    const key = foreignTable ? `${foreignTable}.or` : "or";
    this.values.push([this.removeType(key), `(${filters})`]);
  }

  filter(column: string, operator: string, value: unknown) {
    this.values.push([this.removeType(column), `${operator}.${value}`]);
  }

  in(column: string, values: unknown[]) {
    const cleanedValues = values
      .map((s) => {
        if (typeof s === "string" && /[,()]/.test(s)) return `"${s}"`;
        else return `${s}`;
      })
      .join(",");
    this.values.push([this.removeType(column), `in.(${cleanedValues})`]);
  }

  contains(column: string, value: unknown) {
    if (typeof value === "string") {
      this.values.push([this.removeType(column), `cs.${value}`]);
    } else if (Array.isArray(value)) {
      this.values.push([this.removeType(column), `cs.{${value.join(",")}}`]);
    } else {
      this.values.push([
        this.removeType(column),
        `cs.${JSON.stringify(value)}`,
      ]);
    }
  }

  textSearch(
    column: string,
    query: string[],
    {
      config,
      type,
    }: { config?: string; type?: "plain" | "phrase" | "websearch" } = {}
  ) {
    let typePart = "";
    if (type === "plain") {
      typePart = "pl";
    } else if (type === "phrase") {
      typePart = "ph";
    } else if (type === "websearch") {
      typePart = "w";
    }
    const configPart = config === undefined ? "" : `(${config})`;
    this.values.push([
      this.removeType(column),
      `${typePart}fts${configPart}.${query}`,
    ]);
  }

  flattenedParams() {
    const mapped = this.values.map(([k, v]) => `${k}.${v}`);
    if (mapped.length === 1) return mapped[0];
    return `and(${mapped.join(",")})`;
  }

  static getFlattenedParams(
    rpc: SupabaseFilter,
    filter: SupabaseFilterRPCCall
  ) {
    const proxiedDuplicator = new ProxyParamsDuplicator();
    const proxiedRpc = new Proxy(rpc, proxiedDuplicator.buildProxyHandler());
    void filter(proxiedRpc);
    return proxiedDuplicator.flattenedParams();
  }
}

export class SupabaseTranslator<
  T extends SupabaseVectorStore
> extends BaseTranslator<T> {
  declare VisitOperationOutput: SupabaseFilterRPCCall;

  declare VisitComparisonOutput: SupabaseFilterRPCCall;

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
    if (!query.filter) {
      return {};
    }
    const filterFunction = query.filter?.accept(this);
    return { filter: (filterFunction as SupabaseFilterRPCCall) ?? {} };
  }

  mergeFilters(
    defaultFilter: SupabaseFilterRPCCall | undefined,
    generatedFilter: SupabaseFilterRPCCall | undefined,
    mergeType = "and"
  ): SupabaseFilterRPCCall | undefined {
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

    if (mergeType === "or") {
      return (rpc) => {
        const defaultFlattenedParams = ProxyParamsDuplicator.getFlattenedParams(
          rpc,
          defaultFilter
        );
        const generatedFlattenedParams =
          ProxyParamsDuplicator.getFlattenedParams(rpc, generatedFilter);
        return rpc.or(`${defaultFlattenedParams},${generatedFlattenedParams}`);
      };
    } else if (mergeType === "and") {
      return (rpc) => generatedFilter(defaultFilter(rpc));
    } else {
      throw new Error("Unknown merge type");
    }
  }
}
