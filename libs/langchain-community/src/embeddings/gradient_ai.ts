import { Gradient } from "@gradientai/nodejs-sdk";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "../utils/chunk.js";

/**
 * Interface for GradientEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the GradientEmbeddings class.
 */
export interface GradientEmbeddingsParams extends EmbeddingsParams {
  /**
   * Gradient AI Access Token.
   * Provide Access Token if you do not wish to automatically pull from env.
   */
  gradientAccessKey?: string;
  /**
   * Gradient Workspace Id.
   * Provide workspace id if you do not wish to automatically pull from env.
   */
  workspaceId?: string;
}

/**
 * Class for generating embeddings using the Gradient AI's API. Extends the
 * Embeddings class and implements GradientEmbeddingsParams and
 */
export class GradientEmbeddings
  extends Embeddings
  implements GradientEmbeddingsParams
{
  gradientAccessKey?: string;

  workspaceId?: string;

  batchSize = 128;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;

  constructor(fields: GradientEmbeddingsParams) {
    super(fields);

    this.gradientAccessKey =
      fields?.gradientAccessKey ??
      getEnvironmentVariable("GRADIENT_ACCESS_TOKEN");
    this.workspaceId =
      fields?.workspaceId ?? getEnvironmentVariable("GRADIENT_WORKSPACE_ID");

    if (!this.gradientAccessKey) {
      throw new Error("Missing Gradient AI Access Token");
    }

    if (!this.workspaceId) {
      throw new Error("Missing Gradient AI Workspace ID");
    }
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the Gradient API to generate
   * embeddings.
   * @param texts Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    await this.setModel();

    const mappedTexts = texts.map((text) => ({ input: text }));

    const batches = chunkArray(mappedTexts, this.batchSize);

    const batchRequests = batches.map((batch) =>
      this.caller.call(async () =>
        this.model.generateEmbeddings({
          inputs: batch,
        })
      )
    );
    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];
    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { embeddings: batchResponse } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        embeddings.push(batchResponse[j].embedding);
      }
    }
    return embeddings;
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embedDocuments method with the document as the input.
   * @param text Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const data = await this.embedDocuments([text]);
    return data[0];
  }

  /**
   * Method to set the model to use for generating embeddings.
   * @sets the class' `model` value to that of the retrieved Embeddings Model.
   */
  async setModel() {
    if (this.model) return;

    const gradient = new Gradient({
      accessToken: this.gradientAccessKey,
      workspaceId: this.workspaceId,
    });
    this.model = await gradient.getEmbeddingsModel({
      slug: "bge-large",
    });
  }
}
