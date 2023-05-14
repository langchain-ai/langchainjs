import type * as tst from "typescript";
import { NodeHandler } from "./base.js";
import { ArrayLiteralExpressionHandler } from "./array_literal_expression_handler.js";
import { BooleanLiteralHandler } from "./boolean_literal_handler.js";
import { CallExpressionHandler } from "./call_expression_handler.js";
import { ElementAccessExpressionHandler } from "./element_access_expression_handler.js";
import { NumericLiteralHandler } from "./numeric_literal_handler.js";
import { ObjectLiteralExpressionHandler } from "./object_literal_expression_handler.js";
import { PropertyAccessExpressionHandler } from "./property_access_expression_handler.js";
import { PropertyAssignmentHandler } from "./property_assignment_handler.js";
import { StringLiteralHandler } from "./string_literal_handler.js";
import { AcceptableNodeTypes, ParsedType } from "./types.js";
import { IdentifierHandler } from "./indentifier_handler.js";

const handlers = [
  ArrayLiteralExpressionHandler,
  BooleanLiteralHandler,
  CallExpressionHandler,
  ElementAccessExpressionHandler,
  NumericLiteralHandler,
  ObjectLiteralExpressionHandler,
  PropertyAccessExpressionHandler,
  PropertyAssignmentHandler,
  StringLiteralHandler,
  IdentifierHandler,
];

export class MasterHandler extends NodeHandler {
  nodeHandlers: NodeHandler[] = [];

  async accepts(
    node: AcceptableNodeTypes
  ): Promise<AcceptableNodeTypes | boolean> {
    throw new Error(`Master handler does not accept any nodes: ${node}`);
  }

  async handle(node: tst.CallExpression): Promise<ParsedType> {
    for (const handler of this.nodeHandlers) {
      const accepts = await handler.accepts(node);
      if (accepts) {
        return handler.handle(node);
      }
    }

    throw new Error(`No handler found for node: ${node}`);
  }

  static createMasterHandler(): MasterHandler {
    const masterHandler = new MasterHandler();
    handlers.forEach((Handler) => {
      const handlerInstance = new Handler(masterHandler);
      masterHandler.nodeHandlers.push(handlerInstance);
    });
    return masterHandler;
  }
}
