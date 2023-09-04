import { NodeHandler, ASTParser } from "./base.js";
import { PropertyAssignmentType } from "./types.js";

/**
 * Handler for `PropertyAssignment` nodes in an AST. Extends the
 * `NodeHandler` base class.
 */
export class PropertyAssignmentHandler extends NodeHandler {
  /**
   * Checks if a given node is a `PropertyAssignment` and returns the node
   * if true, or false otherwise.
   * @param node The node to check.
   * @returns The node if it is a `PropertyAssignment`, or false otherwise.
   */
  async accepts(node: ExpressionNode): Promise<PropertyAssignment | boolean> {
    if (ASTParser.isPropertyAssignment(node)) {
      return node;
    } else {
      return false;
    }
  }

  /**
   * Processes a `PropertyAssignment` node. Extracts the key and value of
   * the property assignment and returns an object of type
   * `PropertyAssignmentType` with the extracted identifier and value.
   * @param node The `PropertyAssignment` node to process.
   * @returns An object of type `PropertyAssignmentType` with the extracted identifier and value.
   */
  async handle(node: PropertyAssignment): Promise<PropertyAssignmentType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    let name;
    if (ASTParser.isIdentifier(node.key)) {
      name = node.key.name;
    } else if (ASTParser.isStringLiteral(node.key)) {
      name = node.key.value;
    } else {
      throw new Error("Invalid property key type");
    }
    if (!name) {
      throw new Error("Invalid property key");
    }
    const identifier = (`${name}` as string).replace(
      /^["'](.+(?=["']$))["']$/,
      "$1"
    );
    const value = await this.parentHandler.handle(node.value);
    return { type: "property_assignment", identifier, value };
  }
}
