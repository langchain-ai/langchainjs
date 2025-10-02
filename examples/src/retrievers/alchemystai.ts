import { AlchemystRetriever } from "@langchain/community/retrievers/alchemystai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import dotenv from "dotenv";
// filepath: /Users/anuran/Alchemyst/integrations/playground/example.ts

dotenv.config();

// Instantiate the retriever with your API key and optional config
const retriever = new AlchemystRetriever({
  apiKey: process.env.ALCHEMYST_AI_API_KEY!,
  similarityThreshold: 0.8,
  minimumSimilarityThreshold: 0.5,
  scope: "internal"
});

// Example: Use the retriever in a LangChain pipeline
async function main() {
  // Create a simple pipeline that retrieves documents and outputs their content
  const pipeline = RunnableSequence.from([
    async (input: string) => {
      const docs = await retriever.getRelevantDocuments(input);
      return docs.map(doc => doc.pageContent).join("\n---\n");
    },
    new StringOutputParser()
  ]);

  const query = "Tell me about Quantum Entanglement"; // Put your query here
  const result = await pipeline.invoke(query);

  console.log("Retrieved Documents:\n", result);
}

main().catch(console.error);