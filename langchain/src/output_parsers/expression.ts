import type { ESTree } from "meriyah";
import { MasterHandler } from "./expression_type_handlers/factory.js";
import { ParsedType } from "./expression_type_handlers/types.js";
import { BaseOutputParser } from "../schema/output_parser.js";
import { ASTParser } from "./expression_type_handlers/base.js";
/**
 * okay so we need to be able to handle the following cases:
 * ExpressionStatement
 *  CallExpression
 *      Identifier | MemberExpression
 *      ExpressionLiterals: [
 *          CallExpression
 *          StringLiteral
 *          NumericLiteral
 *          ArrayLiteralExpression
 *              ExpressionLiterals
 *          ObjectLiteralExpression
 *              PropertyAssignment
 *                  Identifier
 *                  ExpressionLiterals
 *      ]
 */

export class ExpressionParser extends BaseOutputParser<ParsedType> {
  async parse(text: string) {
    const parse = await ASTParser.importASTParser();

    try {
      const program = parse(text);

      if (program.body.length > 1) {
        throw new Error(`Expected 1 statement, got ${program.body.length}`);
      }

      const [node] = program.body;
      if (!ASTParser.isExpressionStatement(node)) {
        throw new Error(
          `Expected ExpressionStatement, got ${(node as ESTree.Node).type}`
        );
      }

      const { expression: expressionStatement } = node;
      if (!ASTParser.isCallExpression(expressionStatement)) {
        throw new Error("Expected CallExpression");
      }
      const masterHandler = MasterHandler.createMasterHandler();
      return await masterHandler.handle(expressionStatement);
    } catch (err) {
      throw new Error(`Error parsing ${err}: ${text}`);
    }
  }

  getFormatInstructions(): string {
    return "";
  }
}

export * from "./expression_type_handlers/types.js";

export { MasterHandler } from "./expression_type_handlers/factory.js";
