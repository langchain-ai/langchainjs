export enum Operator {
  and = "and",
  or = "or",
  not = "not",
}

export enum Comparator {
  eq = "eq",
  lt = "lt",
  gt = "gt",
  lte = "lte",
  gte = "gte",
}

export abstract class Visitor {
  abstract visitOperation(operation: Operation): object;

  abstract visitComparison(comparison: Comparison): object;

  abstract visitStructuredQuery(structuredQuery: StructuredQuery): object;
}

export declare abstract class Expression {
  accept(visitor: Visitor): object;
}

export abstract class FilterDirective extends Expression {}

export class Comparison extends FilterDirective {
  constructor(
    public comparator: Comparator,
    public attribute: string,
    public value: string | number
  ) {
    super();
  }
}

export class Operation extends FilterDirective {
  constructor(public operator: Operator, public args?: FilterDirective[]) {
    super();
  }
}

export class StructuredQuery extends Expression {
  constructor(public query: string, public filter?: FilterDirective) {
    super();
  }
}

Expression.prototype.accept = function accept(visitor: Visitor) {
  // eslint-disable-next-line no-instanceof/no-instanceof
  if (this instanceof Operation) {
    return visitor.visitOperation(this);

    // eslint-disable-next-line no-instanceof/no-instanceof
  } else if (this instanceof Comparison) {
    return visitor.visitComparison(this);

    // eslint-disable-next-line no-instanceof/no-instanceof
  } else if (this instanceof StructuredQuery) {
    return visitor.visitStructuredQuery(this);
  } else {
    throw new Error("Unknown Expression type");
  }
};
