import ts from "typescript";
import * as fs from "fs";

export function identifySecrets() {
  const secrets = new Set();

  const tsConfig = ts.parseJsonConfigFileContent(
    ts.readJsonConfigFile("./tsconfig.json", (p) =>
      fs.readFileSync(p, "utf-8")
    ),
    ts.sys,
    "./src/"
  );

  for (const fileName of tsConfig.fileNames.filter(
    (fn) => !fn.endsWith("test.ts")
  )) {
    const sourceFile = ts.createSourceFile(
      fileName,
      fs.readFileSync(fileName, "utf-8"),
      tsConfig.options.target,
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
                if (property.name.getText() === "lc_secrets") {
                  // look for return { ... }
                  property.body.statements.forEach((stmt) => {
                    if (
                      stmt.kind === ts.SyntaxKind.ReturnStatement &&
                      stmt.expression.kind ===
                        ts.SyntaxKind.ObjectLiteralExpression
                    ) {
                      // collect secret identifier
                      stmt.expression.properties.forEach((element) => {
                        if (
                          element.initializer.kind ===
                          ts.SyntaxKind.StringLiteral
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
                      });
                    }
                  });
                }
                break;
              }
            }
          });
          break;
        }
      }
    });
  }

  return secrets;
}
