import { readFile } from "fs/promises";
import * as glob from "glob";

async function main() {
  const examplesDir = "../examples/src";
  const docsDir = "../docs/core_docs/docs";

  const examplesFiles = await glob.glob(`${examplesDir}/**/*`);

  const examplesAsRecord: Record<string, boolean> = {};
  examplesFiles.forEach((file) => {
    if (file.endsWith(".d.ts") || file.endsWith("/examples/src/index.ts")|| file.endsWith(".test.ts")) {
      return;
    }
    if (file.endsWith(".ts")) {
      const formattedFile = file.replace("../examples/src/", "examples/");
      examplesAsRecord[formattedFile] = false;
    }
  });

  const allDocsFiles = await glob.glob(`${docsDir}/**/*`);

  await Promise.all(
    allDocsFiles.map(async (file) => {
      if (!file.endsWith(".mdx")) {
        return;
      }
      const fileContents = await readFile(file, "utf8");
      const allNonTrueExamples = Object.entries(examplesAsRecord)
        .filter(([, value]) => !value)
        .map(([key]) => key);
      if (allNonTrueExamples.length === 0) {
        return;
      }
      const foundExamples = allNonTrueExamples.filter((example) =>
        fileContents.includes(example)
      );
      foundExamples.forEach((example) => {
        examplesAsRecord[example] = true;
      });
    })
  );

  const nonTrueExamples = Object.entries(examplesAsRecord)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  const nonTrueExamplesAsActualPaths = nonTrueExamples.map((file) =>
    file.replace("examples/", "../examples/src/")
  );

  console.log(nonTrueExamplesAsActualPaths.join("\n"));
  return;
}
main();
