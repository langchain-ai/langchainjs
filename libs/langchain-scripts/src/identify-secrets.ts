import ts from "typescript";
import * as fs from "node:fs";

export function identifySecrets(absTsConfigPath: string) {
  const secrets = new Set();

  const tsConfig = ts.parseJsonConfigFileContent(
    ts.readJsonConfigFile(absTsConfigPath, (p) => fs.readFileSync(p, "utf-8")),
    ts.sys,
    "./src/"
  );

  // `tsConfig.options.target` is not always defined when running this
  // via the `@langchain/scripts` package. Instead, fallback to the raw
  // tsConfig.json file contents.
  const tsConfigFileContentsText =
    "text" in tsConfig.raw
      ? JSON.parse(tsConfig.raw.text as string)
      : { compilerOptions: {} };

  const tsConfigTarget =
    tsConfig.options.target || tsConfigFileContentsText.compilerOptions.target;

  for (const fileName of tsConfig.fileNames.filter(
    (fn) => !fn.endsWith("test.ts")
  )) {
    if (!tsConfigTarget) {
      continue;
    }

    const sourceFile = ts.createSourceFile(
      fileName,
      fs.readFileSync(fileName, "utf-8"),
      tsConfigTarget,
      true
    );

    sourceFile.forEachChild((node) => {
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression: {
          node.forEachChild((node) => {
            // look for get lc_secrets()
            switch (node.kind) {
              case ts.SyntaxKind.GetAccessor: {
                const property = node;
                if (
                  ts.isGetAccessor(property) &&
                  property.name.getText() === "lc_secrets"
                ) {
                  // look for return { ... }
                  property.body?.statements.forEach((stmt) => {
                    if (
                      ts.isReturnStatement(stmt) &&
                      stmt.expression &&
                      ts.isObjectLiteralExpression(stmt.expression)
                    ) {
                      stmt.expression.properties.forEach((element) => {
                        if (ts.isPropertyAssignment(element)) {
                          // Type guard for PropertyAssignment
                          if (
                            element.initializer &&
                            ts.isStringLiteral(element.initializer)
                          ) {
                            const secret = element.initializer.text;

                            if (secret.toUpperCase() !== secret) {
                              throw new Error(
                                `Secret identifier must be uppercase: ${secret} at ${fileName}`
                              );
                            }
                            if (/\s/.test(secret)) {
                              throw new Error(
                                `Secret identifier must not contain whitespace: ${secret} at ${fileName}`
                              );
                            }

                            secrets.add(secret);
                          }
                        }
                      });
                    }
                  });
                }
                break;
              }
              default:
                break;
            }
          });
          break;
        }
        default:
          break;
      }
    });
  }

  return secrets;
}
