import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";
import { BaseOutputParser } from "langchain/schema/output_parser";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";

type LineList = {
  lines: string[];
};

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
const prompt =
  PromptTemplate.fromTemplate(`You are an AI language model assistant. Your task is
to generate {queryCount} different versions of the given user
question to retrieve relevant documents from a vector database.
By generating multiple perspectives on the user question,
your goal is to help the user overcome some of the limitations
of distance-based similarity search.

All questions should be in German.

Provide these alternative questions separated by newlines between XML tags. For example:

<questions>
Question 1
Question 2
Question 3
</questions>

Original question: {question}`);

const vectorstore = await MemoryVectorStore.fromTexts(
  [
    "Gebäude werden aus Ziegelsteinen hergestellt",
    "Gebäude werden aus Holz hergestellt",
    "Gebäude werden aus Stein hergestellt",
    "Autos werden aus Metall hergestellt",
    "Autos werden aus Kunststoff hergestellt",
    "Mitochondrien sind die Energiekraftwerke der Zelle",
    "Mitochondrien bestehen aus Lipiden",
  ],
  [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
  new CohereEmbeddings()
);
const model = new ChatAnthropic({});
const llmChain = new LLMChain({
  llm: model,
  prompt,
  outputParser: new LineListOutputParser(),
});
const retriever = new MultiQueryRetriever({
  retriever: vectorstore.asRetriever(),
  llmChain,
  verbose: true,
});

const query = "What are mitochondria made of?";
const retrievedDocs = await retriever.getRelevantDocuments(query);

/*
  Generated queries: Was besteht ein Mitochondrium?,Aus welchen Komponenten setzt sich ein Mitochondrium zusammen?  ,Welche Moleküle finden sich in einem Mitochondrium?
*/

console.log(retrievedDocs);

/*
  [
    Document {
      pageContent: 'Mitochondrien bestehen aus Lipiden',
      metadata: {}
    },
    Document {
      pageContent: 'Mitochondrien sind die Energiekraftwerke der Zelle',
      metadata: {}
    },
    Document {
      pageContent: 'Autos werden aus Metall hergestellt',
      metadata: { id: 4 }
    },
    Document {
      pageContent: 'Gebäude werden aus Holz hergestellt',
      metadata: { id: 2 }
    },
    Document {
      pageContent: 'Gebäude werden aus Ziegelsteinen hergestellt',
      metadata: { id: 1 }
    }
  ]
*/
