import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { FakeEmbeddings } from "../embeddings/fake.js";
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

export interface VectaraFilter {
  // Example of a vectara filter string can be: "doc.rating > 3.0 and part.lang = 'deu'"
  // See https://docs.vectara.com/docs/search-apis/sql/filter-overview for more details.
  filter?: string;
  // Improve retrieval accuracy by adjusting the balance (from 0 to 1), known as lambda,
  // between neural search and keyword-based search factors. Values between 0.01 and 0.2 tend to work well.
  // see https://docs.vectara.com/docs/api-reference/search-apis/lexical-matching for more details.
  lambda?: number;
}

export class VectaraStore extends VectorStore {
  declare FilterType: VectaraFilter;

  private api_endpoint = "api.vectara.io";

  private api_key: string;
  private corpus_id: number;
  private customer_id: number;

  constructor(args: VectaraLibArgs) {
    // Vectara doesn't need embeddings, but we need to pass something to the parent constructor
    // The embeddings are abstracted out from the user in Vectara.
    super(new FakeEmbeddings(), args);

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

  async getJsonHeader(): Promise<VectaraCallHeader> {
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

  async addDocuments(documents: Document<Record<string, any>>[]): Promise<any> {
    const headers = await this.getJsonHeader();
    let countAdded: number = 0;
    for (const [index, document] of documents.entries()) {
      const data = {
        customer_id: this.customer_id,
        corpus_id: this.corpus_id,
        document: {
          document_id:
            document.metadata?.document_id ?? `${Date.now()}${index}`,
          title: document.metadata?.title ?? "",
          metadata_json: JSON.stringify(document.metadata ?? {}),
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
        if (
          result.status?.code !== "OK" &&
          result.status?.code !== "ALREADY_EXISTS"
        ) {
          return {
            code: 500,
            detail: `Vectara API returned status code ${result.code}: ${result.message}`,
          };
        } else {
          countAdded += 1;
        }
      } catch (e) {
        return {
          code: 500,
          detail: `Error ${e} while adding document ${document}`,
        };
      }
    }
    return {
      code: 200,
      detail: `Added ${countAdded} documents to Vectara`,
    };
  }

  async similaritySearchWithScore(
    query: string,
    k = 10,
    filter: VectaraFilter | undefined = undefined
  ): Promise<[Document, number][]> {
    const headers = await this.getJsonHeader();
    const data = {
      query: [
        {
          query: query,
          numResults: k,
          corpusKey: [
            {
              customerId: this.customer_id,
              corpusId: this.corpus_id,
              metadataFilter: filter?.filter ?? "",
              lexicalInterpolationConfig: { lambda: filter?.lambda ?? 0.025 },
            },
          ],
        },
      ],
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
        return [
          new Document({
            pageContent: response.text,
            metadata: response.metadata,
          }),
          response.score,
        ];
      });
      return documentsAndScores;
    } catch (e) {
      throw e;
    }
  }

  async similaritySearch(
    query: string,
    k = 10,
    filter: VectaraFilter | undefined = undefined
  ): Promise<Document[]> {
    const resultWithScore = await this.similaritySearchWithScore(
      query,
      k,
      filter
    );
    return resultWithScore.map((result) => result[0]);
  }

  async similaritySearchVectorWithScore(
    _query: number[],
    _k: number,
    _filter?: VectaraFilter | undefined
  ): Promise<[Document<Record<string, any>>, number][]> {
    throw new Error(
      "Method not implemented. Please call similaritySearch or similaritySearchWithScore instead."
    );
  }

  static fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: Embeddings,
    args: VectaraLibArgs
  ): Promise<VectaraStore> {
    const embeddingsName = embeddings.constructor.name;
    if (embeddingsName !== "FakeEmbeddings") {
      throw new Error(
        `Vectara uses its own embeddings, so you don't have to provide any. Provide an instance of FakeEmbeddings to VectaraStore.fromTexts, instead of ${embeddingsName}.`
      );
    }

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
    embeddings: Embeddings,
    args: VectaraLibArgs
  ): Promise<VectaraStore> {
    const embeddingsName = embeddings.constructor.name;
    if (embeddingsName !== "FakeEmbeddings") {
      throw new Error(
        `Vectara uses its own embeddings, so you don't have to provide any. Provide an instance of FakeEmbeddings to VectaraStore.fromDocuments, instead of ${embeddingsName}.`
      );
    }

    const instance = new this(args);
    await instance.addDocuments(docs);
    return instance;
  }
}
