import { Project, SourceFile, Symbol, SymbolFlags } from 'ts-morph';
import { glob } from "glob";

function logLangChainExports(sourceFiles: SourceFile[]) {
  sourceFiles.forEach((sourceFile) => {
    const exports = sourceFile.getExportSymbols();
    exports.forEach((exportSymbol) => {
      const rootExport = traverseToRootExport(exportSymbol);
      if (rootExport) {
        const exportPath = getExportPath(rootExport);
        if (
          exportPath.startsWith('@langchain/core') ||
          exportPath.startsWith('@langchain/community')
        ) {
          console.log(exportPath);
        }
      }
    });
  });
}

function traverseToRootExport(symbol: Symbol): Symbol | undefined {
  if (symbol.getFlags() & SymbolFlags.Alias) {
    const aliasedSymbol = symbol.getAliasedSymbol();
    if (aliasedSymbol) {
      return traverseToRootExport(aliasedSymbol);
    }
  }
  return symbol;
}

function getExportPath(symbol: Symbol): string {
  const declarations = symbol.getDeclarations();
  if (declarations.length > 0) {
    // const declaration = declarations[0];
    // console.log(declaration.getText())
    // throw new Error("Stop here")
    // const importDeclaration = declaration
    // if (importDeclaration) {
    //   const moduleSpecifier = importDeclaration.getModuleSpecifier();
    //   if (moduleSpecifier) {
    //     return moduleSpecifier.getLiteralText();
    //   }
    // }
  } else {
    console.log(symbol.getExports().map((symbol) => symbol.getName()));
    const declaration = declarations[0];
    console.log(declaration.getText())
    throw new Error("Stop here")
  }
  return '';
}

function main() {
  const project = new Project();
  const allTsFiles = glob.globSync('../../langchain/src/**/*.ts');
  const sourceFiles = project.addSourceFilesAtPaths(allTsFiles);
  logLangChainExports(sourceFiles);
}

main()