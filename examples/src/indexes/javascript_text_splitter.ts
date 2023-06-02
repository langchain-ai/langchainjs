import {
  SupportedTextSplitterLanguages,
  RecursiveCharacterTextSplitter,
} from "langchain/text_splitter";

console.log(SupportedTextSplitterLanguages); // Array of supported languages

/*
  [
    'cpp',      'go',
    'java',     'js',
    'php',      'proto',
    'python',   'rst',
    'ruby',     'rust',
    'scala',    'swift',
    'markdown', 'latex',
    'html'
  ]
*/

const jsCode = `function helloWorld() {
  console.log("Hello, World!");
}
// Call the function
helloWorld();`;

const splitter = RecursiveCharacterTextSplitter.fromLanguage("js", {
  chunkSize: 32,
  chunkOverlap: 0,
});
const jsOutput = await splitter.createDocuments([jsCode]);

console.log(jsOutput);

/*
  [
    Document {
      pageContent: 'function helloWorld() {',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'console.log("Hello, World!");',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '}\n// Call the function',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'helloWorld();',
      metadata: { loc: [Object] }
    }
  ]
*/
