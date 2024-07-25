// import { glob } from "glob";
// import {
//   Project,
//   SyntaxKind,
//   VariableDeclaration,
//   Node,
//   ForOfStatement,
// } from "ts-morph";

// const ignoreComment = `// @eslint-disable-next-line/@typescript-eslint/ban-ts-comment\n// @ts-expect-error unused var\n`;

// async function main() {
//   try {
//     // const allTestFiles = await glob("/Users/bracesproul/code/lang-chain-ai/langchainjs/libs/langchain-anthropic/src/**/*.test.ts");
//     const allTestFiles = await glob(
//       "/Users/bracesproul/code/lang-chain-ai/langchainjs/libs/**/src/**/*.test.ts"
//     );
//     const project = new Project();
//     project.addSourceFilesAtPaths(allTestFiles);

//     const sourceFiles = project.getSourceFiles();

//     for (const sourceFile of sourceFiles) {
//       const insertPositions: Set<number> = new Set();

//       const checkForUnusedVar = (
//         node: VariableDeclaration | ForOfStatement
//       ) => {
//         if (Node.isForOfStatement(node)) {
//           const initializer = node.getInitializer();
//           if (Node.isVariableDeclarationList(initializer)) {
//             const declaration = initializer.getDeclarations()[0];
//             const refs = declaration.findReferences();
//             if (refs.length === 1 && refs[0].getReferences().length === 1) {
//               insertPositions.add(node.getStart());
//             }
//           }
//         } else if (!node.getFirstAncestorByKind(SyntaxKind.ForOfStatement)) {
//           // Only check variables not inside a ForOfStatement
//           const refs = node.findReferences();
//           if (refs.length === 1 && refs[0].getReferences().length === 1) {
//             insertPositions.add(node.getParent()!.getStart());
//           }
//         }
//       };

//       sourceFile
//         .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
//         .forEach(checkForUnusedVar);
//       sourceFile
//         .getDescendantsOfKind(SyntaxKind.ForOfStatement)
//         .forEach(checkForUnusedVar);

//       // Sort positions in descending order to avoid shifting issues
//       const sortedPositions = Array.from(insertPositions).sort((a, b) => b - a);

//       // Insert comments at collected positions
//       sortedPositions.forEach((pos) => {
//         const precedingText = sourceFile
//           .getFullText()
//           .substring(Math.max(0, pos - ignoreComment.length), pos);
//         if (!precedingText.includes(ignoreComment.trim())) {
//           sourceFile.insertText(pos, ignoreComment);
//         }
//       });

//       // Save changes for each file individually
//       await sourceFile.save();
//     }
//   } catch (e: any) {
//     console.error("err occurred", e.message);
//   }
// }

// main().catch(console.error);
