import { Project, SyntaxKind } from "ts-morph";

async function main() {
  const project = new Project({
    tsConfigFilePath: "../tsconfig.json",
  });

  const sourceFiles = project.getSourceFiles("./src/**/*.ts");

  sourceFiles.forEach((sourceFile) => {
    sourceFile.getClasses().forEach((cls) => {
      cls.getInstanceMembers().forEach((member) => {
        if (
          member.getKind() === SyntaxKind.MethodDeclaration ||
          member.getKind() === SyntaxKind.PropertyDeclaration
        ) {
          const name = member.getName();
          if (name.startsWith("_") || name.startsWith("lc_")) {
            const jsDocText = `/** @ignore */\n`;
            const start = member.getStart();
            sourceFile.insertText(start, jsDocText);
          }
        }
      });
    });
  });
  await project.save();
}
main();
