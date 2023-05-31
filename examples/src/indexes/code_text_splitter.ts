import {
  CodeTextSplitter,
  CodeTextSplitterLanguages,
} from "langchain/text_splitter";

console.log(CodeTextSplitterLanguages); // All available languages

const jsCode = `function helloWorld() {
  console.log("Hello, World!");
}
// Call the function
helloWorld();`;

const jsSplitter = new CodeTextSplitter({
  language: "js",
  chunkSize: 32,
  chunkOverlap: 0,
});
const jsOutput = await jsSplitter.createDocuments([jsCode]);

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

const pythonCode = `def hello_world():
  print("Hello, World!")
# Call the function
hello_world()`;

const pythonSplitter = new CodeTextSplitter({
  language: "python",
  chunkSize: 32,
  chunkOverlap: 0,
});

const pythonOutput = await pythonSplitter.createDocuments([pythonCode]);

console.log(pythonOutput);

/*
  [
    Document {
      pageContent: 'def hello_world():',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'print("Hello, World!")',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '# Call the function',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'hello_world()',
      metadata: { loc: [Object] }
    }
  ]
*/
