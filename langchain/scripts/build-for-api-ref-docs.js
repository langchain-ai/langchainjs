import { Project, SyntaxKind } from "ts-morph";

async function main() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const sourceFiles = project.getSourceFiles();

  let changes = [];

  sourceFiles.forEach((sourceFile) => {
    sourceFile.getClasses().forEach((cls) => {
      cls.getInstanceMembers().forEach((member) => {
        if (
          member.getKind() === SyntaxKind.MethodDeclaration ||
          member.getKind() === SyntaxKind.PropertyDeclaration
        ) {
          const name = member.getName();
          if (name.startsWith("_") || name.startsWith("lc_")) {
            const jsDocs = member.getJsDocs();
            const hasIgnoreTag = jsDocs.some(jsDoc => jsDoc.getTags().some(tag => tag.getTagName() === 'ignore'));
            if (!hasIgnoreTag) {
              console.log('FOUND ONE!')
              const jsDocText = `/** @ignore */\n  `;
              const start = member.getStart();
              changes.push({sourceFile, start, jsDocText});
            }
          }
        }
      });
    });
  });

  // Sort changes in reverse order by start position
  changes.sort((a, b) => b.start - a.start);

  // Apply changes after iterating over the AST
  changes.forEach(({sourceFile, start, jsDocText}) => {
    sourceFile.insertText(start, jsDocText);
  });

  await project.save();
}
main();
