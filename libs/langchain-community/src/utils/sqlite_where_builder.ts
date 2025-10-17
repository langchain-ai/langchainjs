import { InStatement, InValue } from "@libsql/client";

export type WhereCondition<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> = {
  [Key in keyof Metadata]:
    | {
        operator: "=" | ">" | "<" | ">=" | "<=" | "<>" | "LIKE";
        value: InValue;
      }
    | {
        operator: "IN";
        value: InValue[];
      };
};

type WhereInStatement = Exclude<InStatement, string>;

export class SqliteWhereBuilder {
  private conditions: WhereCondition;

  constructor(conditions: WhereCondition) {
    this.conditions = conditions;
  }

  buildWhereClause(): WhereInStatement {
    const sqlParts: string[] = [];
    const args: Record<string, InValue> = {};

    for (const [column, condition] of Object.entries(this.conditions)) {
      const { operator, value } = condition;

      if (operator === "IN") {
        const placeholders = value
          .map((_, index) => `:${column}${index}`)
          .join(", ");
        sqlParts.push(
          `json_extract(metadata, '$.${column}') IN (${placeholders})`
        );

        const values = value.reduce(
          (previousValue: Record<string, InValue>, currentValue, index) => {
            return { ...previousValue, [`${column}${index}`]: currentValue };
          },
          {}
        );

        Object.assign(args, values);
      } else {
        sqlParts.push(
          `json_extract(metadata, '$.${column}') ${operator} :${column}`
        );
        args[column] = value;
      }
    }

    const sql = sqlParts.length ? `${sqlParts.join(" AND ")}` : "";
    return { sql, args };
  }
}
