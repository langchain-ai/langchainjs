import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { InMemoryStore } from "langchain/storage/in_memory";
import { ParentDocumentRetriever } from "langchain/retrievers/parent_document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,
  chunkOverlap: 0,
});

const jimDocs = await splitter.createDocuments([`My favorite color is blue.`]);
const jimChunkHeaderOptions = {
  chunkHeader: "DOC NAME: Jim Interview\n---\n",
  appendChunkOverlapHeader: true,
};

const pamDocs = await splitter.createDocuments([`My favorite color is red.`]);
const pamChunkHeaderOptions = {
  chunkHeader: "DOC NAME: Pam Interview\n---\n",
  appendChunkOverlapHeader: true,
};

const vectorstore = await HNSWLib.fromDocuments([], new OpenAIEmbeddings());
const docstore = new InMemoryStore();

const retriever = new ParentDocumentRetriever({
  vectorstore,
  docstore,
  // Very small chunks for demo purposes.
  // Use a bigger chunk size for serious use-cases.
  childSplitter: new RecursiveCharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 0,
  }),
  childK: 50,
  parentK: 5,
});

// We pass additional option `childDocChunkHeaderOptions`
// that will add the chunk header to child documents
await retriever.addDocuments(jimDocs, {
  childDocChunkHeaderOptions: jimChunkHeaderOptions,
});
await retriever.addDocuments(pamDocs, {
  childDocChunkHeaderOptions: pamChunkHeaderOptions,
});

// This will search child documents in vector store with the help of chunk header,
// returning the unmodified parent documents
const retrievedDocs = await retriever.invoke("What is Pam's favorite color?");

// Pam's favorite color is returned first!
console.log(JSON.stringify(retrievedDocs, null, 2));
/*
  [
    {
      "pageContent": "My favorite color is red.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 1,
            "to": 1
          }
        }
      }
    },
    {
      "pageContent": "My favorite color is blue.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 1,
            "to": 1
          }
        }
      }
    }
  ]
*/

const rawDocs = await vectorstore.similaritySearch(
  "What is Pam's favorite color?"
);

// Raw docs in vectorstore are short but have chunk headers
console.log(JSON.stringify(rawDocs, null, 2));

/*
  [
    {
      "pageContent": "DOC NAME: Pam Interview\n---\n(cont'd) color is",
      "metadata": {
        "loc": {
          "lines": {
            "from": 1,
            "to": 1
          }
        },
        "doc_id": "affdcbeb-6bfb-42e9-afe5-80f4f2e9f6aa"
      }
    },
    {
      "pageContent": "DOC NAME: Pam Interview\n---\n(cont'd) favorite",
      "metadata": {
        "loc": {
          "lines": {
            "from": 1,
            "to": 1
          }
        },
        "doc_id": "affdcbeb-6bfb-42e9-afe5-80f4f2e9f6aa"
      }
    },
    {
      "pageContent": "DOC NAME: Pam Interview\n---\n(cont'd) red.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 1,
            "to": 1
          }
        },
        "doc_id": "affdcbeb-6bfb-42e9-afe5-80f4f2e9f6aa"
      }
    },
    {
      "pageContent": "DOC NAME: Pam Interview\n---\nMy",
      "metadata": {
        "loc": {
          "lines": {
            "from": 1,
            "to": 1
          }
        },
        "doc_id": "affdcbeb-6bfb-42e9-afe5-80f4f2e9f6aa"
      }
    }
  ]
*/
