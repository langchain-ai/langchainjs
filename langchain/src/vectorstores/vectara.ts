import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { OpenAIEmbeddings } from "../embeddings/openai.js";
import { getEnvironmentVariable } from "../util/env.js";
import { VectorStore } from "./base.js";

export interface VectaraLibArgs {
  customer_id: number;
  corpus_id: number;
  api_key: string;
}

interface VectaraCallHeader {
  headers: {
    "x-api-key": string;
    "Content-Type": string;
    "customer-id": string;
  };
}

export class VectaraStore extends VectorStore {
  private api_endpoint = "api.vectara.io";

  private api_key: string;
  private corpus_id: number;
  private customer_id: number;

  constructor(args: VectaraLibArgs) {
    super(new OpenAIEmbeddings(), args);

    const apiKey = args.api_key ?? getEnvironmentVariable("VECTARA_API_KEY");
    if (!apiKey) {
      throw new Error("Vectara api key is not provided.");
    }
    this.api_key = apiKey;

    const corpusId =
      args.corpus_id ?? getEnvironmentVariable("VECTARA_CORPUS_ID");
    if (!corpusId) {
      throw new Error("Vectara corpus id is not provided.");
    }
    this.corpus_id = corpusId;

    const customerId =
      args.customer_id ?? getEnvironmentVariable("VECTARA_CUSTOMER_ID");
    if (!customerId) {
      throw new Error("Vectara customer id is not provided.");
    }
    this.customer_id = customerId;
  }

  async getHeader(): Promise<VectaraCallHeader> {
    return {
      headers: {
        "x-api-key": this.api_key,
        "Content-Type": "application/json",
        "customer-id": this.customer_id.toString(),
      },
    };
  }

  async addVectors(
    _vectors: number[][],
    _documents: Document<Record<string, any>>[]
  ): Promise<void> {
    throw new Error(
      "Method not implemented. Please call addDocuments instead."
    );
  }

  async addDocuments(
    documents: Document<Record<string, any>>[]
  ): Promise<any> {
    const headers = await this.getHeader();
    let countAdded: number = 0;
    for (const document of documents) {
      const data = {
        customer_id: this.customer_id,
        corpus_id: this.corpus_id,
        document: {
          document_id: document.metadata.document_id,
          title: document.metadata.title ?? "",
          metadata_json: JSON.stringify(document.metadata),
          section: [
            {
              text: document.pageContent,
            } as any,
          ],
        },
      };

      try {
        const response = await fetch(`https://${this.api_endpoint}/v1/index`, {
          method: "POST",
          headers: headers?.headers,
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (result.status.code !== 'OK' && result.status.code !== 'ALREADY_EXISTS') {
          return {
            "code": 500,
            "detail": `Vectara API returned status code ${response.status}`,
          }
        } else {
          countAdded += 1;
        }
      }
      catch (e) {
        return {
          "code": 500,
          "detail": `Error ${e} while adding document ${document}`,
        };
      }
    }
    return {
      "code": 200,
      "detail": `Added ${countAdded} documents to Vectara`,
    };
  }

  async similaritySearchWithScore(
    query: string,
    _k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const headers = await this.getHeader();
    const data = {
      query: [
        {
          query: query,
          numResults: 10,
          corpusKey: [
            {
              customerId: this.customer_id,
              corpusId: this.corpus_id,
              metadataFilter: filter,
              lexical_interpolation_config: { lambda: 0.025 },
            }
          ]
        }
      ]
    };

    try {
      const response = await fetch(`https://${this.api_endpoint}/v1/query`, {
        method: "POST",
        headers: headers?.headers,
        body: JSON.stringify(data),
      });
      if (response.status !== 200) {
        throw new Error(`Vectara API returned status code ${response.status}`);
      }
      const result = await response.json();
      const responses = result.responseSet[0].response;
      const documentsAndScores = responses.map((response: any) => {

        return [new Document({
          pageContent: response.text,
          metadata: response.metadata,
        }), response.score];
      });
      return documentsAndScores;
    }
    catch (e) {
      throw e;
    }
  }

  async similaritySearch(
    query: string,
    _k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<Document[]> {
    const resultWithScore = await this.similaritySearchWithScore(query, _k, filter);
    return resultWithScore.map((result) => result[0]);
  }

  async similaritySearchVectorWithScore(
    _query: number[],
    _k: number,
    _filter?: this["FilterType"] | undefined
  ): Promise<[Document<Record<string, any>>, number][]> {
    throw new Error("Method not implemented. Please call similaritySearch or similaritySearchWithScore instead.");
  }

  static fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: Embeddings,
    args: VectaraLibArgs
  ): Promise<VectaraStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return VectaraStore.fromDocuments(docs, embeddings, args);
  }

  static async fromDocuments(
    docs: Document[],
    _embeddings: Embeddings,
    args: VectaraLibArgs
  ): Promise<VectaraStore> {
    const instance = new this(args);
    await instance.addDocuments(docs);
    return instance;
  }
}
