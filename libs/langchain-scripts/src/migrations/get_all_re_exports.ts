import { Project, SyntaxKind, SourceFile, ExportDeclaration, StringLiteral } from "ts-morph";

export function getExportsFromFiles(filePaths: string[]): Array<{ old: string, new: string, symbol: null }> {
  const project = new Project();
  const starExports: Array<{ old: string, new: string, symbol: null }> = [];

  filePaths.forEach((filePath) => {
    const sourceFile: SourceFile = project.addSourceFileAtPath(filePath);
    const exportDeclarations: ExportDeclaration[] = sourceFile.getExportDeclarations();

    exportDeclarations.forEach((exportDeclaration) => {
      const moduleSpecifier = exportDeclaration.getModuleSpecifier();

      if (moduleSpecifier && moduleSpecifier.getKind() === SyntaxKind.StringLiteral) {
        const importPath = (moduleSpecifier as StringLiteral).getLiteralText();

        if (importPath.startsWith("@langchain")) {
          const namedExports = exportDeclaration.getNamedExports();

          if (namedExports.length > 0) {
            // no-op
          } else {
            console.log("\n-----\nExport all found\n-----\n");
            const found = findExportAllDeclarations(filePath);
            starExports.push(...found)
          }
        }
      }
    });
  });

  return starExports;
}


function findExportAllDeclarations(filePath: string): Array<{ old: string, new: string, symbol: null }> {
  const project = new Project();
  const sourceFile: SourceFile = project.addSourceFileAtPath(filePath);

  const exportAllDeclarations: ExportDeclaration[] = sourceFile
    .getDescendantsOfKind(SyntaxKind.ExportDeclaration);

  const exportInfos: Array<{ old: string, new: string, symbol: null }> = [];

  for (const exportDeclaration of exportAllDeclarations) {
    const moduleSpecifier = exportDeclaration.getModuleSpecifier();
    if (moduleSpecifier) {
      const externalDep = moduleSpecifier.getLiteralText();
      const namedExports = exportDeclaration.getNamedExports();
      if (namedExports.length === 0) {
        const symbolsTexts: string[] = [];
        const exportType = exportDeclaration.getType();
        exportType.getProperties().forEach((prop) => {
          symbolsTexts.push(prop.getName());
        })
        exportInfos.push({ new: externalDep, symbol: null, old: filePath });
      }
    }
  }

  return exportInfos;
}
