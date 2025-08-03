import type { VectorStoreRetrieverInterface } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import {
  BaseMemory,
  getInputValue,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "@langchain/core/memory";
import { formatDocumentsAsString } from "../util/document.js";

type Metadata = Record<string, unknown>;
type MetadataFunction = (
  inputValues?: InputValues,
  outputValues?: OutputValues
) => Metadata;

/**
 * Interface for the parameters required to initialize a
 * VectorStoreRetrieverMemory instance.
 */
export interface VectorStoreRetrieverMemoryParams {
  vectorStoreRetriever: VectorStoreRetrieverInterface;
  inputKey?: string;
  outputKey?: string;
  memoryKey?: string;
  returnDocs?: boolean;
  /**
   * Metadata to be added to the document when saving context.
   */
  metadata?: Metadata | MetadataFunction;
}

/**
 * Class for managing long-term memory in Large Language Model (LLM)
 * applications. It provides a way to persist and retrieve relevant
 * documents from a vector store database, which can be useful for
 * maintaining conversation history or other types of memory in an LLM
 * application.
 * @example
 * ```typescript
 * const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
 * const memory = new VectorStoreRetrieverMemory({
 *   vectorStoreRetriever: vectorStore.asRetriever(1),
 *   memoryKey: "history",
 * });
 *
 * // Saving context to memory
 * await memory.saveContext(
 *   { input: "My favorite food is pizza" },
 *   { output: "thats good to know" },
 * );
 * await memory.saveContext(
 *   { input: "My favorite sport is soccer" },
 *   { output: "..." },
 * );
 * await memory.saveContext({ input: "I don't the Celtics" }, { output: "ok" });
 *
 * // Loading memory variables
 * console.log(
 *   await memory.loadMemoryVariables({ prompt: "what sport should i watch?" }),
 * );
 * ```
 */
export class VectorStoreRetrieverMemory
  extends BaseMemory
  implements VectorStoreRetrieverMemoryParams
{
  vectorStoreRetriever: VectorStoreRetrieverInterface;

  inputKey?: string;

  memoryKey: string;

  returnDocs: boolean;

  metadata?: Metadata | MetadataFunction;

  constructor(fields: VectorStoreRetrieverMemoryParams) {
    super();
    this.vectorStoreRetriever = fields.vectorStoreRetriever;
    this.inputKey = fields.inputKey;
    this.memoryKey = fields.memoryKey ?? "memory";
    this.returnDocs = fields.returnDocs ?? false;
    this.metadata = fields.metadata;
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  /**
   * Method to load memory variables. It uses the vectorStoreRetriever to
   * get relevant documents based on the query obtained from the input
   * values.
   * @param values An InputValues object.
   * @returns A Promise that resolves to a MemoryVariables object.
   */
  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    const query = getInputValue(values, this.inputKey);
    const results = await this.vectorStoreRetriever.getRelevantDocuments(query);
    return {
      [this.memoryKey]: this.returnDocs
        ? results
        : formatDocumentsAsString(results),
    };
  }

  /**
   * Method to save context. It constructs a document from the input and
   * output values (excluding the memory key) and adds it to the vector
   * store database using the vectorStoreRetriever.
   * @param inputValues An InputValues object.
   * @param outputValues An OutputValues object.
   * @returns A Promise that resolves to void.
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const metadata =
      typeof this.metadata === "function"
        ? this.metadata(inputValues, outputValues)
        : this.metadata;
    const text = Object.entries(inputValues)
      .filter(([k]) => k !== this.memoryKey)
      .concat(Object.entries(outputValues))
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    await this.vectorStoreRetriever.addDocuments([
      new Document({ pageContent: text, metadata }),
    ]);
  }
}
