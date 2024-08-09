import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Embeddings } from "@langchain/core/embeddings";
import { BedrockEmbeddingsParams } from "./bedrock.js";

export class BedrockCohereEmbeddings
  extends Embeddings
  implements BedrockEmbeddingsParams
{
  model: string;

  client: BedrockRuntimeClient;

  batchSize = 512;

  constructor(fields?: BedrockEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? "cohere.embed-english-v3";

    this.client =
      fields?.client ??
      new BedrockRuntimeClient({
        region: fields?.region,
        credentials: fields?.credentials,
      });
  }

  /**
   * Embeds an array of documents using the Bedrock model.
   * @param documents The array of documents to be embedded.
   * @param inputType The input type for the embedding process.
   * @returns A promise that resolves to a 2D array of embeddings.
   * @throws If an error occurs while embedding documents with Bedrock.
   */
  protected async _embedDocuments(
    documents: string[],
    inputType: string
  ): Promise<number[][]> {
    return this.caller.call(async () => {
      try {
        const res = await this.client.send(
          new InvokeModelCommand({
            modelId: this.model,
            body: JSON.stringify({
              texts: documents.map((doc) => doc.replace(/\n+/g, " ")),
              input_type: inputType,
            }),
            contentType: "application/json",
            accept: "application/json",
          })
        );

        const body = new TextDecoder().decode(res.body);
        return JSON.parse(body).embeddings;
      } catch (e) {
        console.error({
          error: e,
        });
        if (e instanceof Error) {
          throw new Error(
            `An error occurred while embedding documents with Bedrock: ${e.message}`
          );
        }

        throw new Error(
          "An error occurred while embedding documents with Bedrock"
        );
      }
    });
  }

  /**
   * Method that takes a document as input and returns a promise that
   * resolves to an embedding for the document.
   * @param document Document for which to generate an embedding.
   * @returns Promise that resolves to an embedding for the input document.
   */
  async embedQuery(document: string): Promise<number[]> {
    return this._embedDocuments([document], "search_query").then(
      (embeddings) => embeddings[0]
    );
  }

  /**
   * Method to generate embeddings for an array of texts.
   * @param documents Array of texts for which to generate embeddings.
   * @returns Promise that resolves to a 2D array of embeddings for each input document.
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embedDocuments(documents, "search_document");
  }
}
