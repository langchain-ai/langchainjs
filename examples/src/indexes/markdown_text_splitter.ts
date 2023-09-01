import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const text = `
---
sidebar_position: 1
---
# Document transformers

Once you've loaded documents, you'll often want to transform them to better suit your application. The simplest example
is you may want to split a long document into smaller chunks that can fit into your model's context window. LangChain
has a number of built-in document transformers that make it easy to split, combine, filter, and otherwise manipulate documents.

## Text splitters

When you want to deal with long pieces of text, it is necessary to split up that text into chunks.
As simple as this sounds, there is a lot of potential complexity here. Ideally, you want to keep the semantically related pieces of text together. What "semantically related" means could depend on the type of text.
This notebook showcases several ways to do that.

At a high level, text splitters work as following:

1. Split the text up into small, semantically meaningful chunks (often sentences).
2. Start combining these small chunks into a larger chunk until you reach a certain size (as measured by some function).
3. Once you reach that size, make that chunk its own piece of text and then start creating a new chunk of text with some overlap (to keep context between chunks).

That means there are two different axes along which you can customize your text splitter:

1. How the text is split
2. How the chunk size is measured

## Get started with text splitters

import GetStarted from "@snippets/modules/data_connection/document_transformers/get_started.mdx"

<GetStarted/>
`;

const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: 500,
  chunkOverlap: 0,
});
const output = await splitter.createDocuments([text]);

console.log(output);

/*
  [
    Document {
      pageContent: '---\n' +
        'sidebar_position: 1\n' +
        '---\n' +
        '# Document transformers\n' +
        '\n' +
        "Once you've loaded documents, you'll often want to transform them to better suit your application. The simplest example\n" +
        "is you may want to split a long document into smaller chunks that can fit into your model's context window. LangChain\n" +
        'has a number of built-in document transformers that make it easy to split, combine, filter, and otherwise manipulate documents.',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '## Text splitters\n' +
        '\n' +
        'When you want to deal with long pieces of text, it is necessary to split up that text into chunks.\n' +
        'As simple as this sounds, there is a lot of potential complexity here. Ideally, you want to keep the semantically related pieces of text together. What "semantically related" means could depend on the type of text.\n' +
        'This notebook showcases several ways to do that.\n' +
        '\n' +
        'At a high level, text splitters work as following:',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '1. Split the text up into small, semantically meaningful chunks (often sentences).\n' +
        '2. Start combining these small chunks into a larger chunk until you reach a certain size (as measured by some function).\n' +
        '3. Once you reach that size, make that chunk its own piece of text and then start creating a new chunk of text with some overlap (to keep context between chunks).\n' +
        '\n' +
        'That means there are two different axes along which you can customize your text splitter:',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '1. How the text is split\n2. How the chunk size is measured',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '## Get started with text splitters\n' +
        '\n' +
        'import GetStarted from "@snippets/modules/data_connection/document_transformers/get_started.mdx"\n' +
        '\n' +
        '<GetStarted/>',
      metadata: { loc: [Object] }
    }
  ]
*/
