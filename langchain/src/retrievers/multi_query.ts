import { LLMChain } from "../chains/llm_chain.js";
import { PromptTemplate } from "../prompts/prompt.js";
import { Document } from "../document.js";
import { BaseLLM } from "../llms/base.js";
import { BaseOutputParser } from "../schema/output_parser.js";
import { BaseRetriever } from "../schema/retriever.js";
import { CallbackManagerForRetrieverRun } from "../callbacks/index.js";

interface LineList {
    lines: string[];
}

class LineListOutputParser extends BaseOutputParser<LineList> {
    static lc_name() {
        return "LineListOutputParser";
    }
    lc_namespace: string[] = ["langchain", "retrievers", "multiquery"];
    async parse(text: string): Promise<LineList> {
        const lines = text.trim().split("\n");
        return { lines };
    }
    getFormatInstructions() {
        return "";
    }
}

// Create template
const DEFAULT_QUERY_PROMPT = new PromptTemplate({
    inputVariables: ["question","k"],
    template: `You are an AI language model assistant. Your task is 
to generate {k} different versions of the given user 
question to retrieve relevant documents from a vector  database. 
By generating multiple perspectives on the user question, 
your goal is to help the user overcome some of the limitations 
of distance-based similarity search. Provide these alternative 
questions separated by newlines. Original question: {question}`,
})

// Export class
export class MultiQueryRetriever extends BaseRetriever {
    static lc_name() {
        return "MultiQueryRetriever";
    }
    lc_namespace: string[] = ["langchain", "retrievers", "multiquery"];
    private retriever: BaseRetriever;
    private llmChain: LLMChain<LineList>;
    private k:number;
    private parserKey: string;

    constructor({
        retriever,
        llmChain,
        verbose = true,
        k = 3, // The amount of different questions you'd like to generate. Provided to the prompt template
        parserKey = "lines"
    }: {
        retriever: BaseRetriever
        llmChain: LLMChain<LineList>
        verbose?: boolean
        k?: number
        parserKey?: string
    }) {
        //@ts-ignore
        super({retriever,llmChain,verbose,k,parserKey});
        this.retriever = retriever;
        this.llmChain = llmChain;
        this.verbose = verbose;
        this.k = k;
        this.parserKey = parserKey;
    }

    static fromLLM({
        retriever,
        llm,
        prompt = DEFAULT_QUERY_PROMPT,
        k = 3, // The amount of different questions you'd like to generate. Provided to the prompt template
        parserKey = "lines"
    }:{
        retriever: BaseRetriever,
        llm: BaseLLM,
        prompt?: PromptTemplate,
        k?:number, // The amount of different questions you'd like to generate. Provided to the prompt template
        parserKey?:string
    }): MultiQueryRetriever {
        const outputParser = new LineListOutputParser();
        const llmChain = new LLMChain({ llm, prompt, outputParser });
        return new MultiQueryRetriever({ retriever, llmChain, k, parserKey });
    }

    // Generate the different queries for each retrieval, using our llmChain
    private async generateQueries(question: string, k: number, runManager?: CallbackManagerForRetrieverRun): Promise<string[]> {
        const response = await this.llmChain._call({ question, k }, runManager?.getChainChild());
        const lines = response.text[this.parserKey] || [];
        if (this.verbose) {
            console.log(`Generated queries: ${lines}`);
        }
        return lines;
    }

    // Retrieve documents using the original retriever
    private async retrieveDocuments(queries: string[], runManager?: CallbackManagerForRetrieverRun): Promise<Document[]> {
        const documents: Document[] = [];
        for (const query of queries) {
            const docs = await this.retriever.getRelevantDocuments(query, runManager?.getChild());
            documents.push(...docs);
        }
        return documents;
    }

    // Deduplicate the documents that were returned in multiple retrievals
    private uniqueUnion(documents: Document[]): Document[] {
        const uniqueDocumentsDict: { [key: string]: Document } = {};

        for (const doc of documents) {
            const key = `${doc.pageContent}:${JSON.stringify(Object.entries(doc.metadata).sort())}`;
            uniqueDocumentsDict[key] = doc;
        }

        const uniqueDocuments = Object.values(uniqueDocumentsDict);
        return uniqueDocuments;
    }

    async _getRelevantDocuments(question: string, runManager?: CallbackManagerForRetrieverRun): Promise<Document[]> {
        const queries = await this.generateQueries(question, this.k, runManager);
        const documents = await this.retrieveDocuments(queries, runManager);
        const uniqueDocuments = this.uniqueUnion(documents);
        return uniqueDocuments;
    }
}