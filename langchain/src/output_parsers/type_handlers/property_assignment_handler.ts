import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, PropertyAssignmentType } from "./types.js";

export class PropertyAssignmentHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.PropertyAssignment | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isPropertyAssignment(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.PropertyAssignment): Promise<PropertyAssignmentType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const identifier = node.name
      .getText()
      .replace(/^["'](.+(?=["']$))["']$/, "$1");
    const value = await this.parentHandler.handle(
      node.initializer as AcceptableNodeTypes
    );
    return { type: "property_assignment", identifier, value };
  }
}
