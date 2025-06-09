import fs from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import type { Plugin, PluginContext, OutputOptions } from "rolldown";

interface SecretPluginOptions {
  /**
   * Whether to enable secret scanning
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to throw errors on validation failures
   * @default true
   */
  strict?: boolean;

  /**
   * Path for the generated secret map file relative to package src directory
   * @default "load/import_type.ts"
   */
  outputPath?: string;

  /**
   * File patterns to exclude from scanning
   * @default [".test.ts", "test.ts", ".spec.ts", "spec.ts"]
   */
  excludePatterns?: string[];

  /**
   * Root directory to scan for secrets
   * @default process.cwd()
   */
  packagePath?: string;
}

interface SecretInfo {
  name: string;
  fileName: string;
  line: number;
}

/**
 * Rolldown plugin for scanning lc_secrets patterns and generating TypeScript interfaces.
 *
 * ## What is the lc_secrets pattern?
 *
 * LangChain uses a standardized convention where classes that need access to sensitive
 * configuration (API keys, tokens, passwords) declare them via a special getter method
 * called `lc_secrets`. This getter returns a mapping between internal property names
 * and environment variable names:
 *
 * ```typescript
 * class OpenAIProvider {
 *   get lc_secrets(): { [key: string]: string } {
 *     return {
 *       apiKey: "OPENAI_API_KEY",        // Maps this.apiKey -> process.env.OPENAI_API_KEY
 *       organization: "OPENAI_ORG_ID",   // Maps this.organization -> process.env.OPENAI_ORG_ID
 *     };
 *   }
 * }
 * ```
 *
 * ## What this plugin does:
 *
 * 1. **Scans** all TypeScript files in your package for classes with `lc_secrets` getters
 * 2. **Extracts** the environment variable names (e.g., "OPENAI_API_KEY", "OPENAI_ORG_ID")
 * 3. **Validates** that they follow LangChain conventions (UPPERCASE, no spaces)
 * 4. **Generates** a TypeScript interface (`SecretMap`) that documents all secrets used
 * 5. **Reports** any validation errors and prevents builds with invalid secret names
 *
 * This ensures consistency across all LangChain packages, provides type safety for
 * environment variables, and helps developers understand what secrets each package requires.
 */
export function lcSecretsPlugin(options: SecretPluginOptions = {}): Plugin {
  const opts = {
    enabled: true,
    strict: true,
    outputPath: "load/import_type.ts",
    excludePatterns: [".test.ts", "test.ts", ".spec.ts", "spec.ts"],
    ...options,
  };

  let secrets: SecretInfo[] = [];
  let packagePath = "";

  return {
    name: "lc-secrets",

    buildStart(this: PluginContext) {
      // @ts-expect-error - outputOptions is available in rolldown plugin context but not typed
      const outputOptions = this.outputOptions as OutputOptions;

      /**
       * only run plugin if:
       * - enabled is true
       * - outputOptions.format is es so we only run during ESM build
       */
      if (!opts.enabled || outputOptions.format !== "es") {
        return;
      }

      packagePath = opts.packagePath ?? process.cwd();
      secrets = [];

      // Scan for secrets at build start
      try {
        secrets = scanForSecrets(packagePath, opts.excludePatterns);
        if (secrets.length > 0) {
          console.log(`🔑 Found ${secrets.length} secrets in package`);

          // Validate secrets
          const errors = validateSecrets(secrets);
          if (errors.length > 0) {
            console.error("❌ Secret validation errors:");
            errors.forEach((error) => console.error(`   - ${error}`));

            if (opts.strict) {
              throw new Error("Secret validation failed");
            }
          }

          // Generate secret map file once
          try {
            generateSecretMap(packagePath, secrets, opts.outputPath);
            console.log(`📝 Generated secret map: ${opts.outputPath}`);
          } catch (error) {
            console.error("❌ Failed to generate secret map:", error);
          }
        }
      } catch (error) {
        if (opts.strict) {
          throw error;
        } else {
          console.warn("⚠️ Secret scanning failed:", error);
        }
      }
    },
  };
}

/**
 * Scan TypeScript files for lc_secrets patterns
 */
function scanForSecrets(
  packagePath: string,
  excludePatterns: string[]
): SecretInfo[] {
  const secrets: SecretInfo[] = [];

  // Find tsconfig.json
  const tsConfigPath = resolve(packagePath, "tsconfig.json");
  if (!fs.existsSync(tsConfigPath)) {
    return secrets;
  }

  const tsConfig = ts.parseJsonConfigFileContent(
    ts.readJsonConfigFile(tsConfigPath, (p) => fs.readFileSync(p, "utf-8")),
    ts.sys,
    resolve(packagePath, "src")
  );

  const tsConfigTarget = tsConfig.options.target || ts.ScriptTarget.ES2020;

  // Filter files to scan
  const filesToScan = tsConfig.fileNames.filter(
    (fileName) => !excludePatterns.some((pattern) => fileName.includes(pattern))
  );

  for (const fileName of filesToScan) {
    if (!fs.existsSync(fileName)) {
      continue;
    }

    try {
      const sourceFile = ts.createSourceFile(
        fileName,
        fs.readFileSync(fileName, "utf-8"),
        tsConfigTarget,
        true
      );

      scanSourceFile(sourceFile, fileName, secrets);
    } catch (error) {
      console.warn(`⚠️ Error scanning ${fileName}:`, error);
    }
  }

  return secrets;
}

/**
 * Scan a single source file for lc_secrets patterns
 */
function scanSourceFile(
  sourceFile: ts.SourceFile,
  fileName: string,
  secrets: SecretInfo[]
) {
  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      ts.forEachChild(node, (classNode) => {
        if (
          ts.isGetAccessor(classNode) &&
          classNode.name?.getText() === "lc_secrets"
        ) {
          classNode.body?.statements.forEach((stmt) => {
            if (
              ts.isReturnStatement(stmt) &&
              stmt.expression &&
              ts.isObjectLiteralExpression(stmt.expression)
            ) {
              stmt.expression.properties.forEach((element) => {
                if (
                  ts.isPropertyAssignment(element) &&
                  element.initializer &&
                  ts.isStringLiteral(element.initializer)
                ) {
                  const secretName = element.initializer.text;
                  const position = sourceFile.getLineAndCharacterOfPosition(
                    element.initializer.getStart()
                  );

                  secrets.push({
                    name: secretName,
                    fileName,
                    line: position.line + 1,
                  });
                }
              });
            }
          });
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/**
 * Validate secret names according to LangChain conventions
 */
function validateSecrets(secrets: SecretInfo[]): string[] {
  const errors: string[] = [];

  for (const secret of secrets) {
    // Must be uppercase
    if (secret.name.toUpperCase() !== secret.name) {
      errors.push(
        `Secret identifier must be uppercase: ${secret.name} at ${secret.fileName}:${secret.line}`
      );
    }

    // No whitespace
    if (/\s/.test(secret.name)) {
      errors.push(
        `Secret identifier must not contain whitespace: ${secret.name} at ${secret.fileName}:${secret.line}`
      );
    }
  }

  return errors;
}

/**
 * Generate TypeScript interface for discovered secrets
 */
function generateSecretMap(
  packagePath: string,
  secrets: SecretInfo[],
  outputPath: string
) {
  const secretMapPath = resolve(packagePath, "src", outputPath);

  // Ensure directory exists
  fs.mkdirSync(resolve(packagePath, "src", "load"), { recursive: true });

  const uniqueSecrets = [...new Set(secrets.map((s) => s.name))].sort();

  const content = `// Auto-generated by lc-secrets plugin. Do not edit manually.

export interface OptionalImportMap {}

export interface SecretMap {
${uniqueSecrets.map((secret) => `  ${secret}?: string;`).join("\n")}
}
`;

  fs.writeFileSync(secretMapPath, content);
}
