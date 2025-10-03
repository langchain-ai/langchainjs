import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import {
  BaseRetriever,
  type BaseRetrieverInput,
  type BaseRetrieverInterface,
} from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { BaseOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate, BasePromptTemplate } from "@langchain/core/prompts";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { LLMChain } from "../chains/llm_chain.js";
import type { BaseDocumentCompressor } from "./document_compressors/index.js";

interface LineList {
  lines: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MultiDocs = Document<Record<string, any>>[];

class LineListOutputParser extends BaseOutputParser<LineList> {
  static lc_name() {
    return "LineListOutputParser";
  }

  lc_namespace = ["langchain", "retrievers", "multiquery"];

  async parse(text: string): Promise<LineList> {
    const startKeyIndex = text.indexOf("<questions>");
    const endKeyIndex = text.indexOf("</questions>");
    const questionsStartIndex =
      startKeyIndex === -1 ? 0 : startKeyIndex + "<questions>".length;
    const questionsEndIndex = endKeyIndex === -1 ? text.length : endKeyIndex;
    const lines = text
      .slice(questionsStartIndex, questionsEndIndex)
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");
    return { lines };
  }

  getFormatInstructions(): string {
    throw new Error("Not implemented.");
  }
}

// Create template
const DEFAULT_QUERY_PROMPT = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["question", "queryCount"],
  template: `You are an AI language model assistant. Your task is
to generate {queryCount} different versions of the given user
question to retrieve relevant documents from a vector database.
By generating multiple perspectives on the user question,
your goal is to help the user overcome some of the limitations
of distance-based similarity search.

Provide these alternative questions separated by newlines between XML tags. For example:

<questions>
Question 1
Question 2
Question 3
</questions>

Original question: {question}`,
});

export interface MultiQueryRetrieverInput extends BaseRetrieverInput {
  retriever: BaseRetrieverInterface;
  /** @deprecated Pass a custom prompt into `.fromLLM` instead. */
  llmChain: LLMChain<LineList>;
  queryCount?: number;
  parserKey?: string;
  documentCompressor?: BaseDocumentCompressor | undefined;
  documentCompressorFilteringFn?: (docs: MultiDocs) => MultiDocs;
}

/**
 * @example
 * ```typescript
 * const retriever = new MultiQueryRetriever.fromLLM({
 *   llm: new ChatAnthropic({}),
 *   retriever: new MemoryVectorStore().asRetriever(),
 *   verbose: true,
 * });
 * const retrievedDocs = await retriever.getRelevantDocuments(
 *   "What are mitochondria made of?",
 * );
 * ```
 */
export class MultiQueryRetriever extends BaseRetriever {
  static lc_name() {
    return "MultiQueryRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "multiquery"];

  private retriever: BaseRetrieverInterface;

  private llmChain: LLMChain<LineList>;

  private queryCount = 3;

  private parserKey = "lines";

  documentCompressor: BaseDocumentCompressor | undefined;

  documentCompressorFilteringFn?: MultiQueryRetrieverInput["documentCompressorFilteringFn"];

  constructor(fields: MultiQueryRetrieverInput) {
    super(fields);
    this.retriever = fields.retriever;
    this.llmChain = fields.llmChain;
    this.queryCount = fields.queryCount ?? this.queryCount;
    this.parserKey = fields.parserKey ?? this.parserKey;
    this.documentCompressor = fields.documentCompressor;
    this.documentCompressorFilteringFn = fields.documentCompressorFilteringFn;
  }

  static fromLLM(
    fields: Omit<MultiQueryRetrieverInput, "llmChain"> & {
      llm: BaseLanguageModelInterface;
      prompt?: BasePromptTemplate;
    }
  ): MultiQueryRetriever {
    const {
      retriever,
      llm,
      prompt = DEFAULT_QUERY_PROMPT,
      queryCount,
      parserKey,
      ...rest
    } = fields;
    const outputParser = new LineListOutputParser();
    const llmChain = new LLMChain({ llm, prompt, outputParser });
    return new this({ retriever, llmChain, queryCount, parserKey, ...rest });
  }

  // Generate the different queries for each retrieval, using our llmChain
  private async _generateQueries(
    question: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<string[]> {
    const response = await this.llmChain.call(
      { question, queryCount: this.queryCount },
      runManager?.getChild()
    );
    const lines = response.text[this.parserKey] || [];
    if (this.verbose) {
      console.log(`Generated queries: ${lines}`);
    }
    return lines;
  }

  // Retrieve documents using the original retriever
  private async _retrieveDocuments(
    queries: string[],
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const documents: Document[] = [];
    await Promise.all(
      queries.map(async (query) => {
        const docs = await this.retriever.getRelevantDocuments(
          query,
          runManager?.getChild()
        );
        documents.push(...docs);
      })
    );
    return documents;
  }

  // Deduplicate the documents that were returned in multiple retrievals
  private _uniqueUnion(documents: Document[]): Document[] {
    const uniqueDocumentsDict: { [key: string]: Document } = {};

    for (const doc of documents) {
      const key = `${doc.pageContent}:${JSON.stringify(
        Object.entries(doc.metadata).sort()
      )}`;
      uniqueDocumentsDict[key] = doc;
    }

    const uniqueDocuments = Object.values(uniqueDocumentsDict);
    return uniqueDocuments;
  }

  async _getRelevantDocuments(
    question: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const queries = await this._generateQueries(question, runManager);
    const documents = await this._retrieveDocuments(queries, runManager);
    const uniqueDocuments = this._uniqueUnion(documents);

    let outputDocs = uniqueDocuments;
    if (this.documentCompressor && uniqueDocuments.length) {
      outputDocs = await this.documentCompressor.compressDocuments(
        uniqueDocuments,
        question,
        runManager?.getChild()
      );
      if (this.documentCompressorFilteringFn) {
        outputDocs = this.documentCompressorFilteringFn(outputDocs);
      }
    }

    return outputDocs;
  }
}
