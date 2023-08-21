import { VectorStore } from "../../vectorstores/base.js";

/**
 * Represents logical AND operator.
 */
export type AND = "and";
/**
 * Represents logical OR operator.
 */
export type OR = "or";
/**
 * Represents logical NOT operator.
 */
export type NOT = "not";

/**
 * Represents a logical operator which can be AND, OR, or NOT.
 */
export type Operator = AND | OR | NOT;

/**
 * Represents equality comparison operator.
 */
export type EQ = "eq";
/**
 * Represents inequality comparison operator.
 */
export type NE = "ne";
/**
 * Represents less than comparison operator.
 */
export type LT = "lt";
/**
 * Represents greater than comparison operator.
 */
export type GT = "gt";
/**
 * Represents less than or equal to comparison operator.
 */
export type LTE = "lte";
/**
 * Represents greater than or equal to comparison operator.
 */
export type GTE = "gte";

/**
 * Represents a comparison operator which can be EQ, NE, LT, GT, LTE, or
 * GTE.
 */
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

/**
 * Represents the result of visiting an operation or comparison
 * expression.
 */
export type VisitorResult = VisitorOperationResult | VisitorComparisonResult;

/**
 * Represents the result of visiting an operation expression.
 */
export type VisitorOperationResult = {
  [operator: string]: VisitorResult[];
};

/**
 * Represents the result of visiting a comparison expression.
 */
export type VisitorComparisonResult = {
  [attr: string]: {
    [comparator: string]: string | number;
  };
};

/**
 * Represents the result of visiting a structured query expression.
 */
export type VisitorStructuredQueryResult = {
  filter?: VisitorComparisonResult | VisitorOperationResult;
};

/**
 * Abstract class for visiting expressions. Subclasses must implement
 * visitOperation, visitComparison, and visitStructuredQuery methods.
 */
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

/**
 * Abstract class representing an expression. Subclasses must implement
 * the exprName property and the accept method.
 */
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

/**
 * Abstract class representing a filter directive. It extends the
 * Expression class.
 */
export abstract class FilterDirective extends Expression {}

/**
 * Class representing a comparison filter directive. It extends the
 * FilterDirective class.
 */
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

/**
 * Class representing an operation filter directive. It extends the
 * FilterDirective class.
 */
export class Operation extends FilterDirective {
  exprName = "Operation" as const;

  constructor(public operator: Operator, public args?: FilterDirective[]) {
    super();
  }
}

/**
 * Class representing a structured query expression. It extends the
 * Expression class.
 */
export class StructuredQuery extends Expression {
  exprName = "StructuredQuery" as const;

  constructor(public query: string, public filter?: FilterDirective) {
    super();
  }
}
