import {
  Comparators,
  Comparison,
  Operation,
  Operators,
  StructuredQuery,
} from "../../chains/query_constructor/ir.js";
import type {
  SupabaseFilter,
  SupabaseFilterRPCCall,
  SupabaseMetadata,
} from "../../vectorstores/supabase.js";

type SupabaseFilterProps = keyof SupabaseFilter;

export class ProxyParamsDuplicator {
  duplicationAllowedOps: string[] = [
    "eq",
    "neq",
    "lt",
    "lte",
    "gt",
    "gte",
    "like",
    "ilike",
    "or",
    "in",
    "contains",
    "match",
    "not",
    "textSearch",
    "filter",
  ];

  values: [string, string][] = [];

  buildProxyHandler() {
    const proxyHandler: ProxyHandler<SupabaseFilter> = {
      get: (target, prop, receiver) => {
        if (typeof target[prop as SupabaseFilterProps] === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (...args: any[]) => {
            if (this.duplicationAllowedOps.includes(String(prop))) {
              switch (String(prop)) {
                case "or":
                  // args[0]: filters, args[1]: { foreignTable }
                  this.addOrClause(args[0], args[1]);
                  break;
                case "filter":
                  // args[0]: column, args[1]: operator, args[2]: value
                  this.addFilterClause(args[0], args[1], args[2]);
                  break;
                case "in":
                  // args[0]: column, args[1]: values
                  this.addInClause(args[0], args[1]);
                  break;
                case "contains":
                  // args[0]: column, args[1]: value
                  this.addContainsClause(args[0], args[1]);
                  break;
                case "textSearch":
                  // args[0]: column, args[1]: query, args[2]: { config, type }
                  this.addTextSearchClause(args[0], args[1], args[2]);
                  break;
                case "match":
                  // args[0]: query
                  this.addMatchClause(args[0]);
                  break;
                case "not":
                  // args[0]: column, args[1]: operator, args[2]: value
                  this.addNotClause(args[0], args[1], args[2]);
                  break;
                default:
                  // args[0]: column, args[1]: value
                  this.addDefaultOpClause(prop as string, args[0], args[1]);
              }
              return new Proxy(target, proxyHandler);
            } else {
              throw new Error(
                "Filter operation not supported for 'or' mergeFiltersOperator"
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

  removeType(value: string) {
    let cleanedValue = value;
    if (cleanedValue.includes("::float")) {
      cleanedValue = cleanedValue.replace("::float", "");
    }
    if (cleanedValue.includes("::int")) {
      cleanedValue = cleanedValue.replace("::int", "");
    }
    return cleanedValue;
  }

  addDefaultOpClause(prop: string, column: string, value: unknown) {
    this.values.push([this.removeType(column), `${String(prop)}.${value}`]);
  }

  addOrClause(
    filters: string,
    { foreignTable }: { foreignTable?: string } = {}
  ) {
    const key = foreignTable ? `${foreignTable}.or` : "or";
    this.values.push([this.removeType(key), `(${filters})`]);
  }

  addFilterClause(column: string, operator: string, value: unknown) {
    this.values.push([this.removeType(column), `${operator}.${value}`]);
  }

  addInClause(column: string, values: unknown[]) {
    const cleanedValues = values
      .map((s) => {
        if (typeof s === "string" && /[,()]/.test(s)) return `"${s}"`;
        else return `${s}`;
      })
      .join(",");
    this.values.push([this.removeType(column), `in.(${cleanedValues})`]);
  }

  addContainsClause(column: string, value: unknown) {
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

  addTextSearchClause(
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

  addNotClause(column: string, operator: string, value: unknown) {
    this.values.push([column, `not.${operator}.${value}`]);
  }

  addMatchClause(query: Record<string, unknown>) {
    Object.entries(query).forEach(([column, value]) => {
      this.values.push([column, `eq.${value}`]);
    });
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

export function convertObjectFilterToStructuredQuery(
  objFilter: SupabaseMetadata
): StructuredQuery {
  return new StructuredQuery(
    "",
    new Operation(
      Operators.and,
      Object.entries(objFilter).map(
        ([column, value]) => new Comparison(Comparators.eq, column, value)
      )
    )
  );
}
