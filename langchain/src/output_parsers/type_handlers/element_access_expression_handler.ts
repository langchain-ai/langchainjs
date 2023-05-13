import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, ElementAccessExpressionType } from "./types.js";

export class ElementAccessExpressionHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.ElementAccessExpression | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isElementAccessExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(
    node: tst.ElementAccessExpression
  ): Promise<ElementAccessExpressionType> {
    const ts = await TSImporter.importTS();
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const { argumentExpression, expression } = node;

    const cleanedExpression = expression
      .getText()
      .replace(/^["'](.+(?=["']$))["']$/, "$1");
    const cleanedArgumentExpression = argumentExpression
      .getText()
      .replace(/^["'](.+(?=["']$))["']$/, "$1");

    if (ts.isStringLiteral(argumentExpression)) {
      return {
        type: "element_access_expression",
        identifier: cleanedExpression,
        key: cleanedArgumentExpression,
      };
    } else if (ts.isNumericLiteral(argumentExpression)) {
      return {
        type: "element_access_expression",
        identifier: cleanedExpression,
        key: Number(cleanedArgumentExpression),
      };
    } else if (ts.isIdentifier(argumentExpression)) {
      return {
        type: "element_access_expression",
        identifier: [cleanedExpression, cleanedArgumentExpression],
      };
    }
    throw new Error("Unknown argument expression type");
  }
}
