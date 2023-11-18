import {
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
} from "../../chains/query_constructor/ir.js";
import type {
  SupabaseFilterRPCCall,
  SupabaseMetadata,
  SupabaseVectorStore,
} from "../../vectorstores/supabase.js";
import { BaseTranslator } from "./base.js";
import { isFilterEmpty, isFloat, isInt, isObject, isString } from "./utils.js";
import {
  ProxyParamsDuplicator,
  convertObjectFilterToStructuredQuery,
} from "./supabase_utils.js";

/**
 * Represents the possible values that can be used in a comparison in a
 * structured query. It can be a string or a number.
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
 * A specialized translator designed to work with Supabase, extending the
 * BaseTranslator class. It translates structured queries into a format
 * that can be understood by the Supabase database.
 * @example
 * ```typescript
 * const selfQueryRetriever = new SelfQueryRetriever({
 *   llm: new ChatOpenAI(),
 *   vectorStore: new SupabaseVectorStore(),
 *   documentContents: "Brief summary of a movie",
 *   attributeInfo: [],
 *   structuredQueryTranslator: new SupabaseTranslator(),
 * });
 *
 * const queryResult = await selfQueryRetriever.getRelevantDocuments(
 *   "Which movies are directed by Greta Gerwig?",
 * );
 * ```
 */
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

  /**
   * Returns a function that applies the appropriate comparator operation on
   * the attribute and value provided. The function returned is used to
   * filter data in a Supabase database.
   * @param comparator The comparator to be used in the operation.
   * @returns A function that applies the comparator operation on the attribute and value provided.
   */
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

  /**
   * Builds a column name based on the attribute and value provided. The
   * column name is used in filtering data in a Supabase database.
   * @param attr The attribute to be used in the column name.
   * @param value The value to be used in the column name.
   * @param includeType Whether to include the data type in the column name.
   * @returns The built column name.
   */
  buildColumnName(attr: string, value: string | number, includeType = true) {
    let column = "";
    if (isString(value)) {
      column = `metadata->>${attr}`;
    } else if (isInt(value)) {
      column = `metadata->${attr}${includeType ? "::int" : ""}`;
    } else if (isFloat(value)) {
      column = `metadata->${attr}${includeType ? "::float" : ""}`;
    } else {
      throw new Error("Data type not supported");
    }

    return column;
  }

  /**
   * Visits an operation and returns a string representation of it. This is
   * used in translating a structured query into a format that can be
   * understood by Supabase.
   * @param operation The operation to be visited.
   * @returns A string representation of the operation.
   */
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

  /**
   * Visits an operation and returns a function that applies the operation
   * on a Supabase database. This is used in translating a structured query
   * into a format that can be understood by Supabase.
   * @param operation The operation to be visited.
   * @returns A function that applies the operation on a Supabase database.
   */
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

  /**
   * Visits a comparison and returns a string representation of it. This is
   * used in translating a structured query into a format that can be
   * understood by Supabase.
   * @param comparison The comparison to be visited.
   * @returns A string representation of the comparison.
   */
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

  /**
   * Visits a comparison and returns a function that applies the comparison
   * on a Supabase database. This is used in translating a structured query
   * into a format that can be understood by Supabase.
   * @param comparison The comparison to be visited.
   * @returns A function that applies the comparison on a Supabase database.
   */
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

  /**
   * Visits a structured query and returns a function that applies the query
   * on a Supabase database. This is used in translating a structured query
   * into a format that can be understood by Supabase.
   * @param query The structured query to be visited.
   * @returns A function that applies the query on a Supabase database.
   */
  visitStructuredQuery(
    query: StructuredQuery
  ): this["VisitStructuredQueryOutput"] {
    if (!query.filter) {
      return {};
    }
    const filterFunction = query.filter?.accept(this);
    return { filter: (filterFunction as SupabaseFilterRPCCall) ?? {} };
  }

  /**
   * Merges two filters into one. The merged filter can be used to filter
   * data in a Supabase database.
   * @param defaultFilter The default filter to be merged.
   * @param generatedFilter The generated filter to be merged.
   * @param mergeType The type of merge to be performed. It can be 'and', 'or', or 'replace'.
   * @returns The merged filter.
   */
  mergeFilters(
    defaultFilter: SupabaseFilterRPCCall | SupabaseMetadata | undefined,
    generatedFilter: SupabaseFilterRPCCall | undefined,
    mergeType = "and"
  ): SupabaseFilterRPCCall | SupabaseMetadata | undefined {
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

    let myDefaultFilter = defaultFilter;
    if (isObject(defaultFilter)) {
      const { filter } = this.visitStructuredQuery(
        convertObjectFilterToStructuredQuery(defaultFilter)
      );

      // just in case the built filter is empty somehow
      if (isFilterEmpty(filter)) {
        if (isFilterEmpty(generatedFilter)) {
          return undefined;
        }
        return generatedFilter;
      }
      myDefaultFilter = filter;
    }
    // After this point, myDefaultFilter will always be SupabaseFilterRPCCall
    if (mergeType === "or") {
      return (rpc) => {
        const defaultFlattenedParams = ProxyParamsDuplicator.getFlattenedParams(
          rpc,
          myDefaultFilter as SupabaseFilterRPCCall
        );
        const generatedFlattenedParams =
          ProxyParamsDuplicator.getFlattenedParams(rpc, generatedFilter);
        return rpc.or(`${defaultFlattenedParams},${generatedFlattenedParams}`);
      };
    } else if (mergeType === "and") {
      return (rpc) =>
        generatedFilter((myDefaultFilter as SupabaseFilterRPCCall)(rpc));
    } else {
      throw new Error("Unknown merge type");
    }
  }
}
