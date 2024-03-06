import { glob } from "glob";
import { Project } from "ts-morph";

// Initialize a new Project instance
const project = new Project();

const langchainGlob = glob.sync("../../libs/**/src/**/*.ts");

langchainGlob.forEach((filePath) => {
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

console.log("Processing complete.");
/**
 *
 */
