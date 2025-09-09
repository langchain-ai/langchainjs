import {
  Comparator as BaseComparator,
  Comparators as BaseComparators,
} from "@langchain/core/structured_query";
import { HanaDB } from "../vectorstores/hanavector.js";

export type DistanceStrategy = "EUCLIDEAN" | "COSINE";

export function validateK(k: number) {
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error("Parameter 'k' must be an integer greater than 0");
  }
}

export function validateKAndFetchK(k: number, fetchK: number) {
  validateK(k);
  if (!Number.isInteger(fetchK) || fetchK < k) {
    throw new Error(
      "Parameter 'fetch_k' must be an integer greater than or equal to 'k'"
    );
  }
  return fetchK;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function executeQuery(client: any, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.exec(query, (err: Error, result: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prepareQuery(client: any, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.prepare(query, (err: Error, statement: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(statement);
      }
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function executeStatement(statement: any, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statement.exec(params, (err: Error, res: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

// Base value types that can be used in comparisons
export type ComparisonRValue =
  | string
  | number
  | boolean
  | DateValue
  | Array<ComparisonRValue>;

export type Comparator =
  | BaseComparator
  | "like"
  | "contains"
  | "in"
  | "nin"
  | "between";

export const Comparators: { [key: string]: Comparator } = {
  ...BaseComparators,
  like: "like",
  contains: "contains",
  in: "in",
  nin: "nin",
  between: "between",
};

// Filter using comparison operators
// Defines the relationship between a comparison operator and its value
export type ComparatorFilter = {
  [K in Comparator as `$${K}`]?: ComparisonRValue;
};

export type LogicalOperator = "$and" | "$or";

export type LogicalFilter = {
  [K in LogicalOperator]?: Filter[];
};
export type PropertyFilter = {
  [property: string]: string | number | boolean | Date | ComparatorFilter;
};

export type Filter = PropertyFilter | LogicalFilter;

interface DateValue {
  type: "date";
  date: string | Date;
}

export const COMPARISONS_TO_SQL: Record<string, string> = {
  $eq: "=",
  $ne: "<>",
  $lt: "<",
  $lte: "<=",
  $gt: ">",
  $gte: ">=",
};

export const IN_OPERATORS_TO_SQL: Record<string, string> = {
  $in: "IN",
  $nin: "NOT IN",
};

export const BETWEEN_OPERATOR = "$between";
export const LIKE_OPERATOR = "$like";
export const CONTAINS_OPERATOR = "$contains";

export const CONTAINS_NEEDS_SPECIAL_SYNTAX = Symbol(
  "CONTAINS_OPERATOR needs special SQL syntax"
);

export const COLUMN_OPERATORS: Record<
  string,
  string | typeof CONTAINS_NEEDS_SPECIAL_SYNTAX
> = {
  ...COMPARISONS_TO_SQL,
  ...IN_OPERATORS_TO_SQL,

  [BETWEEN_OPERATOR]: "BETWEEN",
  [LIKE_OPERATOR]: "LIKE",

  [CONTAINS_OPERATOR]: CONTAINS_NEEDS_SPECIAL_SYNTAX,
};

export const LOGICAL_OPERATORS_TO_SQL = { $and: "AND", $or: "OR" };

export class CreateWhereClause {
  private readonly specificMetadataColumns: string[];

  private readonly metadataColumn: string;

  constructor(hanaDb: HanaDB) {
    this.specificMetadataColumns = hanaDb.getSpecificMetadataColumns();
    this.metadataColumn = hanaDb.getMetadataColumn();
  }

  /**
   * Serializes a filter object to a WHERE clause (prepared statement) and its parameters.
   * The where clause should be appended to an existing SQL statement.
   *
   * @example
   * const [whereClause, parameters] = new CreateWhereClause(hanaDb).build(filter);
   * const [whereStr, queryTuple] = new CreateWhereClause(this).build(filter);
   * const sqlStr = `DELETE FROM "${this.tableName}" ${whereStr}`;
   * const client = this.connection;
   * const stm = await this.prepareQuery(client, sqlStr);
   * await this.executeStatement(stm, queryTuple);
   *
   * @param filter The filter object to serialize.
   * @returns A tuple containing the WHERE clause string and an array of parameters.
   */
  public build(filter?: Filter): [string, string[]] {
    if (!filter || Object.keys(filter).length === 0) {
      return ["", []];
    }

    const [statement, parameters] = this.createWhereClause(filter);

    const placeholderCount = (statement.match(/\?/g) || []).length;
    if (placeholderCount !== parameters.length) {
      throw new Error(
        `Internal error: Mismatch between '?' placeholders (${placeholderCount}) and parameters (${parameters.length})`
      );
    }

    return [`WHERE ${statement}`, parameters];
  }

  private createWhereClause(filter: Filter): [string, string[]] {
    if (!filter || Object.keys(filter).length === 0) {
      throw new Error("Empty filter");
    }
    const statements: string[] = [];
    const parameters: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      let sqlClause: string;
      let queryParams: string[];

      if (key.startsWith("$")) {
        // Generic filter objects may only have logical operators.
        [sqlClause, queryParams] = this.sqlSerializeLogicalOperation(
          key as LogicalOperator,
          value as Filter[]
        );
      } else {
        if (typeof value === "number" && !Number.isInteger(value)) {
          throw new Error(`Unsupported filter value type: ${typeof value}`);
        }
        if (typeof value === "object" && !("type" in value)) {
          if (Object.keys(value).length !== 1) {
            throw new Error(
              `Expecting a single entry 'operator: operands', but got ${JSON.stringify(
                value
              )}`
            );
          }
          const [operator, operands] = Object.entries(value)[0];
          [sqlClause, queryParams] = this.sqlSerializeColumnOperation(
            key,
            operator,
            operands
          );
        } else {
          const [placeholder, paramValue] =
            CreateWhereClause.determineTypedSqlPlaceholder(value);
          sqlClause = `${this.createSelector(key)} = ${placeholder}`;
          queryParams = [paramValue];
        }
      }
      statements.push(sqlClause);
      parameters.push(...queryParams);
    }

    return [
      CreateWhereClause.sqlSerializeLogicalClauses("AND", statements),
      parameters,
    ];
  }

  private sqlSerializeColumnOperation(
    column: string,
    operator: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operands: any
  ): [string, string[]] {
    if (operator in LOGICAL_OPERATORS_TO_SQL) {
      throw new Error(`Did not expect a logical operator, but got ${operator}`);
    }
    if (!(operator in COLUMN_OPERATORS)) {
      throw new Error(`${operator} is not a valid column operator.`);
    }
    if (operands === undefined || operands === null) {
      throw new Error("No operands provided");
    }

    const sqlOperator = COLUMN_OPERATORS[operator];
    const selector = this.createSelector(column);

    if (operator === CONTAINS_OPERATOR) {
      const [placeholder, value] =
        CreateWhereClause.determineTypedSqlPlaceholder(operands);
      const statement = `SCORE(${placeholder} IN ("${column}" EXACT SEARCH MODE 'text')) > 0`;
      return [statement, [value]];
    }

    if (operator === BETWEEN_OPERATOR) {
      if (!Array.isArray(operands) || operands.length !== 2) {
        throw new Error(
          `Expected 2 operands for BETWEEN, but got ${JSON.stringify(operands)}`
        );
      }
      const [fromPlaceholder, fromValue] =
        CreateWhereClause.determineTypedSqlPlaceholder(operands[0]);
      const [toPlaceholder, toValue] =
        CreateWhereClause.determineTypedSqlPlaceholder(operands[1]);
      const statement = `${selector} ${
        sqlOperator as string
      } ${fromPlaceholder} AND ${toPlaceholder}`;
      return [statement, [fromValue, toValue]];
    }

    if (operator in IN_OPERATORS_TO_SQL) {
      if (!Array.isArray(operands)) {
        throw new Error(
          `Expected an array for IN operator, but got ${JSON.stringify(
            operands
          )}`
        );
      }
      const placeholderValueList = operands.map((item) =>
        CreateWhereClause.determineTypedSqlPlaceholder(item)
      );
      const placeholders = placeholderValueList
        .map((item) => item[0])
        .join(", ");
      const values = placeholderValueList.map((item) => item[1]);
      const statement = `${selector} ${
        sqlOperator as string
      } (${placeholders})`;
      return [statement, values];
    }

    // Default behavior for single value operators (e.g., =, >, <).
    const [placeholder, value] =
      CreateWhereClause.determineTypedSqlPlaceholder(operands);
    const statement = `${selector} ${sqlOperator as string} ${placeholder}`;
    return [statement, [value]];
  }

  // hdb requires string while sap/hana-client doesn't
  private static determineTypedSqlPlaceholder(
    value: string | number | boolean | DateValue
  ): [string, string] {
    if (
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      value.type === "date"
    ) {
      return ["TO_DATE(?)", value.date.toString()];
    }
    if (typeof value === "object" && value !== null) {
      throw new Error(`Cannot handle value ${JSON.stringify(value)}`);
    }

    switch (typeof value) {
      case "boolean":
        return ["TO_BOOLEAN(?)", value ? "true" : "false"];
      case "number":
        // TO_DOUBLE can handle both integers and floats in HANA SQL.
        return ["TO_DOUBLE(?)", value.toString()];
      case "string":
        console.warn(
          `Using plain SQL placeholder '?' for string value: ${value}`
        );
        return ["?", value];
      default:
        throw new Error(`Unsupported type for placeholder: ${typeof value}`);
    }
  }

  private static sqlSerializeLogicalClauses(
    sqlOperator: string,
    sqlClauses: string[]
  ): string {
    const supportedOperators = Object.values(LOGICAL_OPERATORS_TO_SQL);
    if (!supportedOperators.includes(sqlOperator)) {
      throw new Error(
        `${sqlOperator} is not in supported operators: ${supportedOperators}`
      );
    }
    if (sqlClauses.length === 0) {
      throw new Error("sqlClauses is empty");
    }
    if (sqlClauses.some((clause) => !clause)) {
      throw new Error(
        `Empty sql clause found in ${JSON.stringify(sqlClauses)}`
      );
    }
    if (sqlClauses.length === 1) {
      return sqlClauses[0];
    }
    return sqlClauses.map((clause) => `(${clause})`).join(` ${sqlOperator} `);
  }

  private sqlSerializeLogicalOperation(
    operator: LogicalOperator,
    operands: Filter[]
  ): [string, string[]] {
    const sqlClauses: string[] = [];
    const queryParams: string[] = [];

    for (const operand of operands) {
      const [clause, params] = this.createWhereClause(operand);
      sqlClauses.push(clause);
      queryParams.push(...params);
    }

    return [
      CreateWhereClause.sqlSerializeLogicalClauses(
        LOGICAL_OPERATORS_TO_SQL[operator],
        sqlClauses
      ),
      queryParams,
    ];
  }

  private createSelector(column: string): string {
    if (this.specificMetadataColumns.includes(column)) {
      return `"${column}"`;
    } else {
      return `JSON_VALUE(${this.metadataColumn}, '$.${column}')`;
    }
  }
}
