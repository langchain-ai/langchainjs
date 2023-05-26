import { LatexTextSplitter } from "langchain/text_splitter";

const text = `\\begin{document}
\\title{🦜️🔗 LangChain}
⚡ Building applications with LLMs through composability ⚡

\\section{Quick Install}

\\begin{verbatim}
Hopefully this code block isn't split
yarn add langchain
\\end{verbatim}

As an open source project in a rapidly developing field, we are extremely open to contributions.

\\end{document}`;

const splitter = new LatexTextSplitter({
  chunkSize: 100,
  chunkOverlap: 0,
});
const output = await splitter.createDocuments([text]);

console.log(output)

/*
[
  Document {
    pageContent: '\\begin{document}\n' +
      '\\title{🦜️🔗 LangChain}\n' +
      '⚡ Building applications with LLMs through composability ⚡',
    metadata: { loc: [Object] }
  },
  Document {
    pageContent: 'Quick Install}',
    metadata: { loc: [Object] }
  },
  Document {
    pageContent: "Hopefully this code block isn't split\n" +
      'yarn add langchain\n' +
      '\\end{verbatim}\n' +
      '\n' +
      'As an open source project in a rapidly',
    metadata: { loc: [Object] }
  },
  Document {
    pageContent: 'developing field, we are extremely open to contributions.\n' +
      '\n' +
      '\\end{document}',
    metadata: { loc: [Object] }
  }
]
*/
