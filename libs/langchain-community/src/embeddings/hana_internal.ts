import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";

/**
 * Parameters for initializing HanaInternalEmbeddings.
 */
export interface HanaInternalEmbeddingsParams extends EmbeddingsParams {
  /**
   * The ID of the internal embedding model used by the HANA database.
   */
  internalEmbeddingModelId: string;
}

/**
 * A dummy embeddings class for use with HANA's internal embedding functionality.
 * This class prevents the use of standard embedding methods and ensures that
 * internal embeddings are handled exclusively via database queries.
 *
 * @example
 *  const internalEmbeddings = new HanaInternalEmbeddings({
 *    internalEmbeddingModelId: "your_model_id_here",
 *  });
 *
 *  // The following calls will throw errors:
 *  await internalEmbeddings.embedQuery("sample text"); // Throws error
 *  await internalEmbeddings.embedDocuments(["text one", "text two"]); // Throws error
 *
 *  // Retrieve the internal model id:
 *  console.log(internalEmbeddings.getModelId());
 */
export class HanaInternalEmbeddings extends Embeddings {
  private modelId: string;

  /**
   * A flag to indicate this class is HANA-specific.
   */
  public readonly isHanaInternalEmbeddings = true;

  constructor(fields: HanaInternalEmbeddingsParams) {
    super(fields);
    this.modelId = fields.internalEmbeddingModelId;
  }

  /**
   * This method is not applicable for HANA internal embeddings.
   * @throws Error indicating that internal embeddings cannot be used externally.
   */
  async embedQuery(_text: string): Promise<number[]> {
    throw new Error(
      "Internal embeddings cannot be used externally. Use HANA's internal embedding functionality instead."
    );
  }

  /**
   * This method is not applicable for HANA internal embeddings.
   * @throws Error indicating that internal embeddings cannot be used externally.
   */
  async embedDocuments(_texts: string[]): Promise<number[][]> {
    throw new Error(
      "Internal embeddings cannot be used externally. Use HANA's internal embedding functionality instead."
    );
  }

  /**
   * Retrieves the internal embedding model ID.
   * @returns The internal embedding model ID.
   */
  getModelId(): string {
    return this.modelId;
  }
}
