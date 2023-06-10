import { NodeHandler, ASTParser } from "./base.js";
import { PropertyAssignmentHandler } from "./property_assignment_handler.js";
import { ObjectLiteralType, PropertyAssignmentType } from "./types.js";

export class ObjectLiteralExpressionHandler extends NodeHandler {
  async accepts(node: ExpressionNode): Promise<ObjectExpression | boolean> {
    if (ASTParser.isObjectExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: ObjectExpression): Promise<ObjectLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const values: PropertyAssignmentType[] = [];
    const { properties } = node;
    for (const property of properties) {
      if (ASTParser.isPropertyAssignment(property)) {
        values.push(
          await new PropertyAssignmentHandler(this.parentHandler).handle(
            property
          )
        );
      }
    }
    return { type: "object_literal", values };
  }
}
