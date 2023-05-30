import { GRAMMAR } from "./grammar/parser_grammar.js";

export abstract class NodeHandler {
  constructor(protected parentHandler?: NodeHandler) {}

  abstract accepts(node: ExpressionNode): Promise<ExpressionNode | boolean>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract handle(node: ExpressionNode): Promise<any>;
}

export class ASTParser {
  static astParseInstance: ParseFunction;

  static async importASTParser() {
    try {
      if (!ASTParser.astParseInstance) {
        const { default: peggy } = await import("peggy");
        const parser = peggy.generate(GRAMMAR);
        const { parse } = parser;
        ASTParser.astParseInstance = parse as ParseFunction;
      }
      return ASTParser.astParseInstance;
    } catch (e) {
      throw new Error(
        `Failed to import peggy. Please install peggy (i.e. "npm install peggy" or "yarn add peggy").`
      );
    }
  }

  static isProgram(node: ExpressionNode): node is Program {
    return node.type === "Program";
  }

  static isExpressionStatement(
    node: ExpressionNode
  ): node is ExpressionStatement {
    return node.type === "ExpressionStatement";
  }

  static isCallExpression(node: ExpressionNode): node is CallExpression {
    return node.type === "CallExpression";
  }

  static isStringLiteral(node: ExpressionNode): node is StringLiteral {
    return node.type === "StringLiteral" && typeof node.value === "string";
  }

  static isNumericLiteral(node: ExpressionNode): node is NumericLiteral {
    return node.type === "NumericLiteral" && typeof node.value === "number";
  }

  static isBooleanLiteral(node: ExpressionNode): node is BooleanLiteral {
    return node.type === "BooleanLiteral" && typeof node.value === "boolean";
  }

  static isIdentifier(node: ExpressionNode): node is Identifier {
    return node.type === "Identifier";
  }

  static isObjectExpression(node: ExpressionNode): node is ObjectExpression {
    return node.type === "ObjectExpression";
  }

  static isArrayExpression(node: ExpressionNode): node is ArrayExpression {
    return node.type === "ArrayExpression";
  }

  static isPropertyAssignment(
    node: ExpressionNode
  ): node is PropertyAssignment {
    return node.type === "PropertyAssignment";
  }

  static isMemberExpression(node: ExpressionNode): node is MemberExpression {
    return node.type === "MemberExpression";
  }
}
