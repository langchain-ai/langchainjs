import type tst from "typescript";
import { MasterHandler } from "./type_handlers/factory.js";
import { ParsedType } from "./type_handlers/types.js";
import { BaseOutputParser } from "../schema/output_parser.js";
import { TSImporter } from "./type_handlers/base.js";

type ESourceFile = tst.SourceFile & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseDiagnostics: any[];
};

/**
 * okay so we need to be able to handle the following cases:
 * ExpressionStatement
 *  CallExpression
 *      Identifier | PropertyAccessExpression | ElementAccessExpression
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
    const source = await this.createSourceFile(text);
    const ts = await TSImporter.importTS();

    if (source.statements.length > 1) {
      throw new Error(`Expected 1 statement, got ${source.statements.length}`);
    }

    const [node] = source.statements;
    if (!ts.isExpressionStatement(node)) {
      throw new Error(`Expected ExpressionStatement, got ${node.kind}`);
    }

    const { expression: expressionStatement } = node;
    if (!ts.isCallExpression(expressionStatement)) {
      throw new Error("Expected CallExpression");
    }
    const masterHandler = MasterHandler.createMasterHandler();
    return (await masterHandler.handle(expressionStatement)) as ParsedType;
  }

  getFormatInstructions(): string {
    return "";
  }

  async createSourceFile(expression: string): Promise<tst.SourceFile> {
    const ts = await TSImporter.importTS();
    try {
      const source = ts.createSourceFile(
        "temp.ts",
        expression,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      ) as ESourceFile;
      const diagnostics: string[] = [];
      if (source.parseDiagnostics.length > 0) {
        source.parseDiagnostics.forEach((diagnostic) => {
          if (diagnostic.category === ts.DiagnosticCategory.Error) {
            diagnostics.push(diagnostic.messageText as string);
          }
        });
        if (diagnostics.length > 0) {
          throw diagnostics.join(", ");
        }
      }
      return source;
    } catch (err) {
      throw new Error(`Error parsing ${err}: ${expression}`);
    }
  }
}

export * from "./type_handlers/types.js";

export { MasterHandler } from "./type_handlers/factory.js";
