const { Project, SyntaxKind } = require("ts-morph");
const { exec } = require("child_process");

async function updateCodeWithIgnoreTags(tsConfigFilePath) {
  const project = new Project({
    tsConfigFilePath,
  });
  const sourceFiles = project.getSourceFiles();
  /**
   * @type {Array<Record<string, any>>}
   */
  let changes = [];

  const syntaxTypes = [
    SyntaxKind.MethodDeclaration,
    SyntaxKind.PropertyDeclaration,
    SyntaxKind.GetAccessor,
    SyntaxKind.SetAccessor,
    SyntaxKind.MethodSignature,
    SyntaxKind.PropertySignature,
  ];

  sourceFiles.forEach((sourceFile) => {
    sourceFile.getClasses().forEach((cls) => {
      // Check instance members
      cls.getInstanceMembers().forEach((member) => {
        checkMember(member);
      });

      // Check static members
      cls.getStaticMembers().forEach((member) => {
        checkMember(member);
      });
    });
  });

  function checkMember(member) {
    if (syntaxTypes.includes(member.getKind())) {
      const name = member.getName();
      if (name.startsWith("_") || name.startsWith("lc_")) {
        const jsDocs = member.getJsDocs();
        const hasIgnoreTag = jsDocs.some((jsDoc) =>
          jsDoc.getTags().some((tag) => tag.getTagName() === "ignore")
        );
        if (!hasIgnoreTag) {
          const jsDocText = `/** @ignore */\n  `;
          const start = member.getStart();
          changes.push({
            sourceFile: member.getSourceFile(),
            start,
            jsDocText,
          });
        }
      }
    }
  }

  // Sort changes in reverse order by start position so updating
  // the source file doesn't mess up the start position of the next change
  changes.sort((a, b) => b.start - a.start);
  // Apply changes after iterating over the AST
  changes.forEach(({ sourceFile, start, jsDocText }) => {
    sourceFile.insertText(start, jsDocText);
  });

  await project.save();
}

async function copyLangChain(pathToLangChain) {
  try {
    await execAsync(`rm -rf ./langchain`);
  } catch (_) {
    // no-op
  }
  await execAsync(`cp -r ${pathToLangChain} ./langchain`);
  return {
    rootPath: `${process.cwd()}/langchain`,
    tsConfigPath: `${process.cwd()}/langchain/tsconfig.json`,
  };
}

async function deleteLangChain(pathToLangChain) {
  // delete the langchain dir
  await execAsync(`rm -rf ${pathToLangChain}`);
}

const execAsync = async (command, options) => new Promise((resolve, reject) => {
  exec(command, options, (err, stdout, stderr) => {
    if (err) {
      reject(err);
    } else {
      resolve(stdout);
    }
  });
});

async function main() {
  const pathToLangChain = "../../langchain";
  const { rootPath, tsConfigPath } = await copyLangChain(pathToLangChain);
  await updateCodeWithIgnoreTags(tsConfigPath);
  await execAsync("yarn typedoc");
  await deleteLangChain(rootPath);
}
main();
