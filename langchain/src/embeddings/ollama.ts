import { Embeddings, EmbeddingsParams } from "./base.js";
import {
    OllamaEmbeddingsRequestParams,
    OllamaEmbeddingsReturnParams,
} from "../util/ollama.js";

/**
 * Interface for OllamaEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the OllamaEmbeddings class.
 */
export interface OllamaEmbeddingsParams extends EmbeddingsParams {
    baseUrl?: string,
    model?: string
}

export class OllamaEmbeddings
    extends Embeddings {
    model = "llama2";

    baseUrl = "http://localhost:11434";

    constructor(
        fields?: Partial<OllamaEmbeddingsParams>,
    ) {
        const fieldsWithDefaults = { ...fields };

        super(fieldsWithDefaults);

        this.baseUrl = fields?.baseUrl ?? this.baseUrl
        this.model = fields?.model ?? this.model

    }

    async embedDocuments(documents: string[]): Promise<number[][]> {
        const batchRequests = documents.map((d) => this.embedQuery(d))
        const batchResponses = await Promise.all(batchRequests);

        return batchResponses
    }

    async embedQuery(document: string): Promise<number[]> {

        let params: OllamaEmbeddingsRequestParams = {
            model: this.model,
            prompt: document
        }

        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: "POST",
            body: JSON.stringify(params),
            headers: {
                "Content-Type": "application/json",
            },
        });

        let result: OllamaEmbeddingsReturnParams = await response.json()
        return result.embedding
    }

}