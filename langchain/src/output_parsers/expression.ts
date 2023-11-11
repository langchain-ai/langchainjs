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
  lc_namespace = ["langchain", "output_parsers", "expression"];

  parser: ParseFunction;

  /**
   * We should separate loading the parser into its own function
   * because loading the grammar takes some time. If there are
   * multiple concurrent parse calls, it's faster to just wait
   * for building the parser once and then use it for all
   * subsequent calls. See expression.test.ts for an example.
   */
  async ensureParser() {
    if (!this.parser) {
      this.parser = await ASTParser.importASTParser();
    }
  }

  /**
   * Parses the given text. It first ensures the parser is loaded, then
   * tries to parse the text. If the parsing fails, it throws an error. If
   * the parsing is successful, it returns the parsed expression.
   * @param text The text to be parsed.
   * @returns The parsed expression
   */
  async parse(text: string) {
    await this.ensureParser();

    try {
      const program = this.parser(text);

      const node = program.body;
      if (!ASTParser.isExpressionStatement(node)) {
        throw new Error(
          `Expected ExpressionStatement, got ${(node as ExpressionNode).type}`
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

  /**
   * This method is currently empty, but it could be used to provide
   * instructions on the format of the input text.
   * @returns string
   */
  getFormatInstructions(): string {
    return "";
  }
}

export * from "./expression_type_handlers/types.js";

export { MasterHandler } from "./expression_type_handlers/factory.js";
