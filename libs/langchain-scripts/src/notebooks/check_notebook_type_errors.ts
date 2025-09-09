import fs from "node:fs";
import ts from "typescript";
import { Project } from "ts-morph";

const SKIP_VALIDATION = ["lcel_cheatsheet.ipynb"];

export function extract(filepath: string) {
  const { cells } = JSON.parse(fs.readFileSync(filepath).toString());
  if (cells[0]?.source.includes("lc_docs_skip_validation: true\n")) {
    return "";
  }
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.ts", "");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cells.forEach((cell: Record<string, any>) => {
    const source = cell.source
      .join("")
      .replace(/\/\/ ?@lc-ts-ignore/g, "// @ts-ignore");
    if (cell.cell_type === "code") {
      sourceFile.addStatements(source);
    }
  });

  // Deduplicate imports
  const importDeclarations = sourceFile.getImportDeclarations();
  const uniqueImports = new Map<
    string,
    { default?: string; namespace?: string; named: Set<string> }
  >();

  importDeclarations.forEach((importDecl) => {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    if (!uniqueImports.has(moduleSpecifier)) {
      uniqueImports.set(moduleSpecifier, { named: new Set() });
    }
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      uniqueImports.get(moduleSpecifier)!.default = defaultImport.getText();
    }
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) {
      uniqueImports.get(moduleSpecifier)!.namespace = namespaceImport.getText();
    }
    importDecl.getNamedImports().forEach((namedImport) => {
      uniqueImports.get(moduleSpecifier)!.named.add(namedImport.getText());
    });
  });

  // Remove all existing imports
  importDeclarations.forEach((importDecl) => importDecl.remove());

  // Add deduplicated imports at the top
  uniqueImports.forEach(
    ({ default: defaultImport, namespace, named }, moduleSpecifier) => {
      sourceFile.addImportDeclaration({
        moduleSpecifier,
        defaultImport,
        namespaceImport: namespace,
        namedImports: Array.from(named),
      });
    }
  );

  return sourceFile.getFullText();
}

const [pathname] = process.argv.slice(2);

if (!pathname) {
  throw new Error("No pathname provided.");
}

export async function checkNotebookTypeErrors() {
  if (!pathname.endsWith(".ipynb")) {
    throw new Error("Only .ipynb files are supported.");
  }
  const notebookName = pathname.split("/")[pathname.split("/").length - 1];
  if (SKIP_VALIDATION.includes(notebookName)) {
    return;
  }
  const filename = notebookName.replace(".ipynb", ".mts");
  const tempFilepath = `./tmp/${filename}`;
  try {
    const typescriptSource = extract(pathname);
    if (!fs.existsSync("./tmp")) {
      fs.mkdirSync("./tmp");
    }
    fs.writeFileSync(tempFilepath, typescriptSource);
    const program = ts.createProgram([tempFilepath], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2021,
      alwaysStrict: true,
      skipLibCheck: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const issueStrings: string[] = [];
    if (diagnostics.length === 0) {
      console.log("No type errors found.");
    } else {
      diagnostics.forEach((diagnostic) => {
        if (diagnostic.file) {
          const { line, character } =
            diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
          const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n"
          );
          issueStrings.push(
            `${diagnostic.file.fileName} (${line + 1},${
              character + 1
            }): ${message}`
          );
        } else {
          issueStrings.push(
            ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
          );
        }
      });
    }
    if (issueStrings.length) {
      const issues = issueStrings.join("\n");
      console.error(issues);
      const err = new Error("Found type errors in new notebook.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).details = issues;
      throw err;
    }
  } finally {
    try {
      fs.rmSync(tempFilepath);
    } catch {
      // Do nothing
    }
  }
}
