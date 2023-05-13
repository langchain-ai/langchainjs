import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, PropertyAccessType } from "./types.js";

export class PropertyAccessExpressionHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.PropertyAccessExpression | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isPropertyAccessExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(
    node: tst.PropertyAccessExpression
  ): Promise<PropertyAccessType> {
    const ts = await TSImporter.importTS();
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const { expression, name } = node;
    let identifier: string | PropertyAccessType;
    if (ts.isIdentifier(expression)) {
      identifier = expression
        .getText()
        .replace(/^["'](.+(?=["']$))["']$/, "$1");
    } else if (ts.isPropertyAccessExpression(expression)) {
      identifier = await new PropertyAccessExpressionHandler(
        this.parentHandler
      ).handle(expression);
    } else {
      throw new Error("Unknown property access expression identifier type");
    }
    const property = name.getText().replace(/^["'](.+(?=["']$))["']$/, "$1");
    return { type: "property_access_expression", identifier, property };
  }
}
