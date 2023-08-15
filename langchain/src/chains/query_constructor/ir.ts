import { VectorStore } from "../../vectorstores/base.js";

export type AND = "and";
export type OR = "or";
export type NOT = "not";

export type Operator = AND | OR | NOT;

export type EQ = "eq";
export type NE = "ne";
export type LT = "lt";
export type GT = "gt";
export type LTE = "lte";
export type GTE = "gte";

export type Comparator = EQ | NE | LT | GT | LTE | GTE;

export const Operators: { [key: string]: Operator } = {
  and: "and",
  or: "or",
  not: "not",
};

export const Comparators: { [key: string]: Comparator } = {
  eq: "eq",
  ne: "ne",
  lt: "lt",
  gt: "gt",
  lte: "lte",
  gte: "gte",
};

export type VisitorResult = VisitorOperationResult | VisitorComparisonResult;

export type VisitorOperationResult = {
  [operator: string]: VisitorResult[];
};

export type VisitorComparisonResult = {
  [attr: string]: {
    [comparator: string]: string | number;
  };
};

export type VisitorStructuredQueryResult = {
  filter?: VisitorComparisonResult | VisitorOperationResult;
};

export abstract class Visitor<T extends VectorStore = VectorStore> {
  declare VisitOperationOutput: object;

  declare VisitComparisonOutput: object;

  declare VisitStructuredQueryOutput: { filter?: T["FilterType"] };

  abstract allowedOperators: Operator[];

  abstract allowedComparators: Comparator[];

  abstract visitOperation(operation: Operation): this["VisitOperationOutput"];

  abstract visitComparison(
    comparison: Comparison
  ): this["VisitComparisonOutput"];

  abstract visitStructuredQuery(
    structuredQuery: StructuredQuery
  ): this["VisitStructuredQueryOutput"];
}

export abstract class Expression {
  abstract exprName: "Operation" | "Comparison" | "StructuredQuery";

  accept(visitor: Visitor) {
    if (this.exprName === "Operation") {
      return visitor.visitOperation(this as unknown as Operation);
    } else if (this.exprName === "Comparison") {
      return visitor.visitComparison(this as unknown as Comparison);
    } else if (this.exprName === "StructuredQuery") {
      return visitor.visitStructuredQuery(this as unknown as StructuredQuery);
    } else {
      throw new Error("Unknown Expression type");
    }
  }
}

export abstract class FilterDirective extends Expression {}

export class Comparison extends FilterDirective {
  exprName = "Comparison" as const;

  constructor(
    public comparator: Comparator,
    public attribute: string,
    public value: string | number
  ) {
    super();
  }
}

export class Operation extends FilterDirective {
  exprName = "Operation" as const;

  constructor(public operator: Operator, public args?: FilterDirective[]) {
    super();
  }
}

export class StructuredQuery extends Expression {
  exprName = "StructuredQuery" as const;

  constructor(public query: string, public filter?: FilterDirective) {
    super();
  }
}
