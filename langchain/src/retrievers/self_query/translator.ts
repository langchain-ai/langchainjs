import {
  Comparator,
  Comparators,
  Comparison,
  Operation,
  Operator,
  Operators,
  StructuredQuery,
  Visitor,
  VisitorComparisonResult,
  VisitorOperationResult,
  VisitorResult,
  VisitorStructuredQueryResult,
} from "../../chains/query_constructor/ir.js";

export abstract class BaseTranslator extends Visitor {
  abstract allowedOperators: Operator[];

  abstract allowedComparators: Comparator[];

  abstract formatFunction(func: Operator | Comparator): string;
}

export class BasicTranslator extends BaseTranslator {
  allowedOperators: Operator[] = [Operators.and, Operators.or];

  allowedComparators: Comparator[] = [
    Comparators.eq,
    Comparators.neq,
    Comparators.gt,
    Comparators.gte,
    Comparators.lt,
    Comparators.lte,
  ];

  formatFunction(func: Operator | Comparator): string {
    if (func in Comparators) {
      if (
        this.allowedComparators.length > 0 &&
        this.allowedComparators.indexOf(func as Comparator) === -1
      ) {
        throw new Error(
          `Comparator ${func} not allowed. Allowed operators: ${this.allowedComparators.join(
            ", "
          )}`
        );
      }
    } else if (func in Operators) {
      if (
        this.allowedOperators.length > 0 &&
        this.allowedOperators.indexOf(func as Operator) === -1
      ) {
        throw new Error(
          `Operator ${func} not allowed. Allowed operators: ${this.allowedOperators.join(
            ", "
          )}`
        );
      }
    } else {
      throw new Error("Unknown comparator or operator");
    }
    return `$${func}`;
  }

  visitOperation(operation: Operation): VisitorOperationResult {
    const args = operation.args?.map((arg) =>
      arg.accept(this)
    ) as VisitorResult[];
    return {
      [this.formatFunction(operation.operator)]: args,
    };
  }

  visitComparison(comparison: Comparison): VisitorComparisonResult {
    return {
      [comparison.attribute]: {
        [this.formatFunction(comparison.comparator)]: comparison.value,
      },
    };
  }

  visitStructuredQuery(query: StructuredQuery): VisitorStructuredQueryResult {
    let nextArg = {};
    if (query.filter) {
      nextArg = {
        filter: query.filter.accept(this),
      };
    }
    return nextArg;
  }
}
