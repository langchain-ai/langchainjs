import { NodeHandler, ASTParser } from "./base.js";
import { BooleanLiteralType } from "./types.js";

/**
 * Handler for boolean literal nodes in the abstract syntax tree (AST).
 * Extends the NodeHandler class.
 */
export class BooleanLiteralHandler extends NodeHandler {
  /**
   * Checks if a given node is a boolean literal. If it is, the method
   * returns the node; otherwise, it returns false.
   * @param node The node to check.
   * @returns The node if it is a boolean literal, or false otherwise.
   */
  async accepts(node: ExpressionNode): Promise<BooleanLiteral | boolean> {
    if (ASTParser.isBooleanLiteral(node)) {
      return node;
    } else {
      return false;
    }
  }

  /**
   * Handles the boolean literal node. Throws an error if there is no parent
   * handler. If there is a parent handler, it returns an object of type
   * BooleanLiteralType which includes the type of the node
   * ("boolean_literal") and the value of the boolean literal.
   * @param node The boolean literal node to handle.
   * @returns An object of type BooleanLiteralType representing the handled node.
   */
  async handle(node: BooleanLiteral): Promise<BooleanLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    return {
      type: "boolean_literal",
      value: node.value as boolean,
    };
  }
}
