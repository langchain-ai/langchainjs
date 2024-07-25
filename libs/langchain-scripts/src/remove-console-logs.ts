// import { glob } from "glob";
// import { Project } from "ts-morph";

// /**
//  * Finds all unused variables in a file, and removes the variable. If the variable is e.g const my_var = someFunc(); it should replace it with someFunc();
//  */
// async function main() {
//   try {
//     const allTestFiles = await glob(
//       "/Users/bracesproul/code/lang-chain-ai/langchainjs/libs/**/src/**/*.test.ts"
//     );
//     const project = new Project();
//     project.addSourceFilesAtPaths(allTestFiles);

//     const sourceFiles = project.getSourceFiles();

//     for (const sourceFile of sourceFiles) {
//     }
//   } catch (e: any) {
//     console.error("err occurred", e.message);
//   }
// }

// main().catch(console.error);
