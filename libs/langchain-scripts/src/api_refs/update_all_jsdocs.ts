import { glob } from "glob";
import { Project } from "ts-morph";

export function updateAllJSDocWithInheritDoc() {
  // Initialize a new Project instance
  const project = new Project();

  const libsGlob = glob.sync("../../libs/**/src/**/*.ts");
  const langchainGlob = glob.sync("../../langchain/src/**/*.ts");
  const langchainCoreGlob = glob.sync("../../langchain-core/src/**/*.ts");

  const allGlobs = [...libsGlob, ...langchainGlob, ...langchainCoreGlob];
  
  allGlobs.forEach((filePath) => {
    const sourceFile = project.addSourceFileAtPath(filePath);
  
    sourceFile.getClasses().forEach((cls) => {
      const jsDocs = cls.getJsDocs();
      if (jsDocs.length > 0) {
        const jsDoc = jsDocs[0];
        // Get the full JSDoc text, including tags
        const fullText = jsDoc.getText();
        // Check if @inheritDoc is already present to avoid duplication
        if (!fullText.includes("@inheritDoc")) {
          // Append @inheritDoc while preserving existing tags
          const updatedText = `${fullText.slice(0, -2)}\n * @inheritDoc\n */`;
          jsDoc.replaceWithText(updatedText);
        }
      } else {
        cls.addJsDoc({
          description: "@inheritDoc",
        });
      }
    });
  
    sourceFile.saveSync();
  });
}

