/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  SupabaseFilter,
  SupabaseFilterRPCCall,
} from "../../vectorstores/supabase.js";

export function isObject(obj: any): obj is object {
  return obj && typeof obj === "object" && !Array.isArray(obj);
}

export function isFilterEmpty(
  filter: ((q: any) => any) | object | string | undefined
): filter is undefined {
  if (!filter) return true;
  // for Milvus
  if (typeof filter === "string" && filter.length > 0) {
    return false;
  }
  if (typeof filter === "function") {
    return false;
  }
  return isObject(filter) && Object.keys(filter).length === 0;
}

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
          return (...args: any[]) => {
            if (this.duplicationAllowedOps.includes(String(prop))) {
              if (String(prop) === "or") {
                const filters = args[0] as string;
                const { foreignTable } =
                  args[1] ?? ({} as { foreignTable?: string });
                this.or(filters, { foreignTable });
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
              } else if (String(prop) === "match") {
                const query = args[0] as Record<string, unknown>;
                this.match(query);
              } else if (String(prop) === "not") {
                const column = args[0] as string;
                const operator = args[1] as string;
                const value = args[2] as unknown;
                this.not(column, operator, value);
              } else {
                const column = args[0] as string;
                const value = args[1] as string;
                this.defaultOp(prop as string, column, value);
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

  defaultOp(prop: string, column: string, value: unknown) {
    this.values.push([this.removeType(column), `${String(prop)}.${value}`]);
  }

  or(filters: string, { foreignTable }: { foreignTable?: string } = {}) {
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

  not(column: string, operator: string, value: unknown) {
    this.values.push([column, `not.${operator}.${value}`]);
  }

  match(query: Record<string, unknown>) {
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
