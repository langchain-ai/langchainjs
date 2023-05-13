import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import {
  AcceptableNodeTypes,
  CallExpressionType,
  ElementAccessExpressionType,
  PropertyAccessType,
} from "./types.js";

export class CallExpressionHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.CallExpression | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isCallExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.CallExpression): Promise<CallExpressionType> {
    const ts = await TSImporter.importTS();
    const checkCallExpressionArgumentType =
      function checkCallExpressionArgumentType(arg: tst.Expression): boolean {
        return [
          ts.isStringLiteral,
          ts.isNumericLiteral,
          ts.isArrayLiteralExpression,
          ts.isObjectLiteralExpression,
          ts.isCallExpression,
          ts.isIdentifier,
          function isBooleanLiteral(node: tst.Expression) {
            return (
              node.kind === ts.SyntaxKind.TrueKeyword ||
              node.kind === ts.SyntaxKind.FalseKeyword
            );
          },
        ].reduce((acc, func) => acc || func(arg), false);
      };
    if (this.parentHandler === undefined) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const { expression } = node;
    let funcCall;
    if (ts.isIdentifier(expression)) {
      funcCall = expression.getText().replace(/^["'](.+(?=["']$))["']$/, "$1");
    } else if (
      ts.isElementAccessExpression(expression) ||
      ts.isPropertyAccessExpression(expression)
    ) {
      funcCall = (await this.parentHandler.handle(
        expression as tst.PropertyAccessExpression | tst.ElementAccessExpression
      )) as ElementAccessExpressionType | PropertyAccessType;
    } else {
      throw new Error("Unknown expression type");
    }

    const args = await Promise.all(
      node.arguments.map((arg) => {
        if (!checkCallExpressionArgumentType(arg)) {
          throw new Error("Unknown argument type");
        }
        if (!this.parentHandler) {
          throw new Error("CallExpressionHandler must have a parent handler");
        }
        return this.parentHandler.handle(arg as AcceptableNodeTypes);
      })
    );
    return { type: "call_expression", funcCall, args };
  }
}
