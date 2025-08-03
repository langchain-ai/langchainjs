import { NodeHandler, ASTParser } from "./base.js";
import { MemberExpressionType } from "./types.js";

/**
 * Handles member expressions in the LangChain Expression Language (LCEL).
 * Extends the NodeHandler base class.
 */
export class MemberExpressionHandler extends NodeHandler {
  /**
   * Checks if a given node is a member expression. If it is, the method
   * returns the node; otherwise, it returns false.
   * @param node The node to check.
   * @returns The node if it is a member expression, or false otherwise.
   */
  async accepts(node: ExpressionNode): Promise<MemberExpression | boolean> {
    if (ASTParser.isMemberExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  /**
   * Processes a member expression node. It extracts the object and property
   * from the node, validates their types, and returns an object with the
   * type of the expression, the identifier, and the property.
   * @param node The member expression node to process.
   * @returns An object with the type of the expression, the identifier, and the property.
   */
  async handle(node: MemberExpression): Promise<MemberExpressionType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const { object, property } = node;
    let prop: string;
    if (ASTParser.isIdentifier(property)) {
      prop = property.name.replace(/^["'](.+(?=["']$))["']$/, "$1");
    } else if (ASTParser.isStringLiteral(property)) {
      prop = (`${property.value}` as string).replace(
        /^["'](.+(?=["']$))["']$/,
        "$1"
      );
    } else {
      throw new Error("Invalid property key type");
    }
    let identifier: string;
    if (ASTParser.isIdentifier(object)) {
      identifier = object.name.replace(/^["'](.+(?=["']$))["']$/, "$1");
    } else if (ASTParser.isStringLiteral(object)) {
      identifier = (`${object.value}` as string).replace(
        /^["'](.+(?=["']$))["']$/,
        "$1"
      );
    } else {
      throw new Error("Invalid object type");
    }
    if (object.type !== "Identifier" && object.type !== "StringLiteral") {
      throw new Error("ArrayExpression is not supported");
    }

    return { type: "member_expression", identifier, property: prop };
  }
}
