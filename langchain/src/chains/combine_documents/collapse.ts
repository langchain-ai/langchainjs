import { LanguageModelLike } from "@langchain/core/language_models/base";
import { BasePromptTemplate } from "@langchain/core/prompts";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnablePick,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Document } from "@langchain/core/documents";

import {
  DEFAULT_DOCUMENT_PROMPT,
  DEFAULT_DOCUMENT_SEPARATOR,
  DOCUMENTS_KEY,
  formatDocuments,
} from "./base.js";

export async function createCollapseDocumentsChain({
  llm,
  prompt,
  maxTokens,
  documentPrompt = DEFAULT_DOCUMENT_PROMPT,
  documentSeparator = DEFAULT_DOCUMENT_SEPARATOR,
  getTokenCount,
}: {
  llm: LanguageModelLike;
  prompt: BasePromptTemplate;
  maxTokens: number;
  documentPrompt?: BasePromptTemplate;
  documentSeparator?: string;
  getTokenCount?: (str: string) => number;
}) {
  if (!prompt.inputVariables.includes(DOCUMENTS_KEY)) {
    throw new Error(`Prompt must include a "${DOCUMENTS_KEY}" variable`);
  }

  if (!getTokenCount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (llm as any).getNumTokens === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-param-reassign
      getTokenCount = (llm as any).getNumTokens.bind(llm);
    } else {
      throw new Error(`Must provide a "getTokenCount" function`);
    }
  }

  // formatter bound to these args
  const formatter = formatDocuments.bind(
    null,
    documentPrompt,
    documentSeparator
  );

  // chain that returns a single document combining the input documents
  // usually this will be used with a prompt that summarizes or extracts
  // excerpts from the input documents, otherwise the total size doesn't reduce
  const docsToDoc = RunnableSequence.from(
    [
      RunnableMap.from({
        pageContent: RunnableSequence.from([
          new RunnablePick(DOCUMENTS_KEY),
          formatter,
          prompt,
          llm,
          new StringOutputParser(),
        ]),
        metadata: new RunnablePick(DOCUMENTS_KEY).pipe(collapseDocsMetadata),
      }),
      (fields) => new Document(fields),
    ],
    "docs_to_doc"
  );

  // chain that splits a single list of documents into multiple lists of documents
  // each list will then be collapsed into a single document
  const partitionDocs = (fields: Record<string, Document[]>) => {
    const docs = fields[DOCUMENTS_KEY];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return splitListOfDocs(formatter, getTokenCount!, maxTokens, docs).map(
      (docsList) => ({ ...fields, [DOCUMENTS_KEY]: docsList })
    );
  };

  // chain that takes a list of documents and returns a list of documents
  // whose combined length is less than the original. this is done by combining
  // sub-lists of documents into a single document, obtaining a new list of
  // (smaller) documents
  const partitionAndReduceDocs = RunnableSequence.from(
    [partitionDocs, docsToDoc.map()],
    "partition_and_reduce_docs"
  );

  // chain that recursively applies partitionAndReduceDocs until the total
  // number of tokens is less than the maxTokens. Each application of
  // partitionAndReduceDocs will reduce the number of documents in the list,
  // and the total number of tokens will decrease as well.
  const loop: RunnableLambda<
    Record<string, unknown>,
    Document[]
  > = RunnableLambda.from((fields: Record<string, unknown>) => {
    const docs = fields[DOCUMENTS_KEY] as Document[];
    const tokens = getTokenCount!(formatter(docs));
    if (tokens <= maxTokens) {
      return docs;
    } else {
      return RunnablePassthrough.assign({
        [DOCUMENTS_KEY]: partitionAndReduceDocs,
      }).pipe(loop);
    }
  });

  return loop.withConfig({ runName: "collapse_documents_chain" });
}

export function collapseDocsMetadata(docs: Document[]): Document["metadata"] {
  const combinedMetadata: Record<string, string> = {};
  for (const key in docs[0].metadata) {
    if (key in docs[0].metadata) {
      combinedMetadata[key] = String(docs[0].metadata[key]);
    }
  }
  for (const doc of docs.slice(1)) {
    for (const key in doc.metadata) {
      if (key in combinedMetadata) {
        combinedMetadata[key] += `, ${doc.metadata[key]}`;
      } else {
        combinedMetadata[key] = String(doc.metadata[key]);
      }
    }
  }
  return combinedMetadata;
}

export function splitListOfDocs(
  formatDocuments: (docs: Document[]) => string,
  getTokenCount: (str: string) => number,
  maxTokens: number,
  docs: Document[]
): Document[][] {
  const newResultDocList: Document[][] = [];
  let subResultDocs: Document[] = [];
  for (const doc of docs) {
    subResultDocs.push(doc);
    const numTokens = getTokenCount(formatDocuments(subResultDocs));
    if (numTokens > maxTokens) {
      if (subResultDocs.length === 1) {
        throw new Error(
          "A single document was longer than the context length, we cannot handle this."
        );
      }
      newResultDocList.push(subResultDocs.slice(0, -1));
      subResultDocs = subResultDocs.slice(-1);
    }
  }
  newResultDocList.push(subResultDocs);
  return newResultDocList;
}
