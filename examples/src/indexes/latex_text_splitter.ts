import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

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

const splitter = RecursiveCharacterTextSplitter.fromLanguage("latex", {
  chunkSize: 100,
  chunkOverlap: 0,
});
const output = await splitter.createDocuments([text]);

console.log(output);

/*
  [
    Document {
      pageContent: '\\begin{document}\n' +
        '\\title{🦜️🔗 LangChain}\n' +
        '⚡ Building applications with LLMs through composability ⚡',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '\\section{Quick Install}',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '\\begin{verbatim}\n' +
        "Hopefully this code block isn't split\n" +
        'yarn add langchain\n' +
        '\\end{verbatim}',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'As an open source project in a rapidly developing field, we are extremely open to contributions.',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '\\end{document}',
      metadata: { loc: [Object] }
    }
  ]
*/
