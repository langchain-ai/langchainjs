import {
  Comparator,
  Comparators,
  Comparison,
  FilterDirective,
  Operation,
  Operator,
  Operators,
} from "./ir.js";
import {
  CallExpressionType,
  ExpressionParser,
  ParsedType,
} from "../../output_parsers/expression.js";

/**
 * A type representing the possible types that can be traversed in an
 * expression.
 */
export type TraverseType =
  | boolean
  | Operation
  | Comparison
  | string
  | number
  | { [key: string]: TraverseType }
  | TraverseType[];

/**
 * A class for transforming and parsing query expressions.
 */
export class QueryTransformer {
  constructor(
    public allowedComparators: Comparator[] = [],
    public allowedOperators: Operator[] = []
  ) {}

  /**
   * Matches a function name to a comparator or operator. Throws an error if
   * the function name is unknown or not allowed.
   * @param funcName The function name to match.
   * @returns The matched function name.
   */
  private matchFunctionName(funcName: string) {
    if (funcName in Comparators) {
      if (this.allowedComparators.length > 0) {
        if (this.allowedComparators.includes(funcName as Comparator)) {
          return funcName;
        } else {
          throw new Error("Received comparator not allowed");
        }
      } else {
        return funcName;
      }
    }
    if (funcName in Operators) {
      if (this.allowedOperators.length > 0) {
        if (this.allowedOperators.includes(funcName as Operator)) {
          return funcName;
        } else {
          throw new Error("Received operator not allowed");
        }
      } else {
        return funcName;
      }
    }
    throw new Error("Unknown function name");
  }

  /**
   * Transforms a parsed expression into an operation or comparison. Throws
   * an error if the parsed expression is not supported.
   * @param parsed The parsed expression to transform.
   * @returns The transformed operation or comparison.
   */
  private transform(parsed: CallExpressionType): Operation | Comparison {
    const traverse = (node: ParsedType): TraverseType => {
      switch (node.type) {
        case "call_expression": {
          if (typeof node.funcCall !== "string") {
            throw new Error(
              "Property access expression and element access expression not supported"
            );
          }
          const funcName = this.matchFunctionName(node.funcCall);
          if (funcName in Operators) {
            return new Operation(
              funcName as Operator,
              node.args?.map((arg) => traverse(arg)) as FilterDirective[]
            );
          }
          if (funcName in Comparators) {
            if (node.args && node.args.length === 2) {
              return new Comparison(
                funcName as Comparator,
                traverse(node.args[0]) as string,
                traverse(node.args[1]) as string | number
              );
            }
            throw new Error("Comparator must have exactly 2 arguments");
          }
          throw new Error("Function name neither operator nor comparator");
        }
        case "string_literal": {
          return node.value;
        }
        case "numeric_literal": {
          return node.value;
        }
        case "array_literal": {
          return node.values.map((value) => traverse(value));
        }
        case "object_literal": {
          return node.values.reduce((acc, value) => {
            acc[value.identifier] = traverse(value.value);
            return acc;
          }, {} as { [key: string]: TraverseType });
        }
        case "boolean_literal": {
          return node.value;
        }
        default: {
          throw new Error("Unknown node type");
        }
      }
    };
    return traverse(parsed) as Operation | Comparison;
  }

  /**
   * Parses an expression and returns the transformed operation or
   * comparison. Throws an error if the expression cannot be parsed.
   * @param expression The expression to parse.
   * @returns A Promise that resolves to the transformed operation or comparison.
   */
  async parse(expression: string): Promise<Operation | Comparison> {
    const expressionParser = new ExpressionParser();
    const parsed = (await expressionParser.parse(
      expression
    )) as CallExpressionType;
    if (!parsed) {
      throw new Error("Could not parse expression");
    }
    return this.transform(parsed);
  }
}
