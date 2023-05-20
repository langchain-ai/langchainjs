import type meriyahT from "meriyah";

export abstract class NodeHandler {
  constructor(protected parentHandler?: NodeHandler) {}

  abstract accepts(
    node: meriyahT.ESTree.Node
  ): Promise<meriyahT.ESTree.Node | boolean>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract handle(node: meriyahT.ESTree.Node): Promise<any>;
}

export class ASTParser {
  static astParseInstance: typeof meriyahT.parseScript;

  static async importASTParser() {
    try {
      if (!ASTParser.astParseInstance) {
        const meriyah = await import("meriyah");
        ASTParser.astParseInstance =
          meriyah.parseScript as typeof meriyahT.parseScript;
      }
      return ASTParser.astParseInstance;
    } catch (e) {
      console.log(e);
      throw new Error(
        "Failed to import meriyah. Please install meriyah (i.e. npm install meriyah)."
      );
    }
  }

  static isProgram(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.Program {
    return node.type === "Program";
  }

  static isExpressionStatement(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.ExpressionStatement {
    return node.type === "ExpressionStatement";
  }

  static isCallExpression(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.CallExpression {
    return node.type === "CallExpression";
  }

  static isLiteral(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.Literal {
    return node.type === "Literal";
  }

  static isStringLiteral(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.Literal {
    return node.type === "Literal" && typeof node.value === "string";
  }

  static isNumericLiteral(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.Literal {
    return node.type === "Literal" && typeof node.value === "number";
  }

  static isBooleanLiteral(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.Literal {
    return node.type === "Literal" && typeof node.value === "boolean";
  }

  static isIdentifier(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.Identifier {
    return node.type === "Identifier";
  }

  static isObjectExpression(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.ObjectExpression {
    return node.type === "ObjectExpression";
  }

  static isArrayExpression(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.ArrayExpression {
    return node.type === "ArrayExpression";
  }

  static isProperty(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.Property {
    return node.type === "Property";
  }

  static isMemberExpression(
    node: meriyahT.ESTree.Node
  ): node is meriyahT.ESTree.MemberExpression {
    return node.type === "MemberExpression";
  }
}
