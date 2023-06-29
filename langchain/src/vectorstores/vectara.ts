import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { FakeEmbeddings } from "../embeddings/fake.js";
import { getEnvironmentVariable } from "../util/env.js";
import { VectorStore } from "./base.js";

export interface VectaraLibArgs {
  customerId: number;
  corpusId: number;
  apiKey: string;
  verbose?: boolean;
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

  private apiEndpoint = "api.vectara.io";

  private apiKey: string;

  private corpusId: number;

  private customerId: number;

  private verbose: boolean;

  constructor(args: VectaraLibArgs) {
    // Vectara doesn't need embeddings, but we need to pass something to the parent constructor
    // The embeddings are abstracted out from the user in Vectara.
    super(new FakeEmbeddings(), args);

    const apiKey = args.apiKey ?? getEnvironmentVariable("VECTARA_API_KEY");
    if (!apiKey) {
      throw new Error("Vectara api key is not provided.");
    }
    this.apiKey = apiKey;

    const corpusId =
      args.corpusId ?? getEnvironmentVariable("VECTARA_CORPUS_ID");
    if (!corpusId) {
      throw new Error("Vectara corpus id is not provided.");
    }
    this.corpusId = corpusId;

    const customerId =
      args.customerId ?? getEnvironmentVariable("VECTARA_CUSTOMER_ID");
    if (!customerId) {
      throw new Error("Vectara customer id is not provided.");
    }
    this.customerId = customerId;

    this.verbose = args.verbose ?? false;
  }

  async getJsonHeader(): Promise<VectaraCallHeader> {
    return {
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        "customer-id": this.customerId.toString(),
      },
    };
  }

  async addVectors(
    _vectors: number[][],
    _documents: Document[]
  ): Promise<void> {
    throw new Error(
      "Method not implemented. Please call addDocuments instead."
    );
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const headers = await this.getJsonHeader();
    let countAdded = 0;
    for (const [index, document] of documents.entries()) {
      const data = {
        customer_id: this.customerId,
        corpus_id: this.corpusId,
        document: {
          document_id:
            document.metadata?.document_id ?? `${Date.now()}${index}`,
          title: document.metadata?.title ?? "",
          metadata_json: JSON.stringify(document.metadata ?? {}),
          section: [
            {
              text: document.pageContent,
            },
          ],
        },
      };

      try {
        const response = await fetch(`https://${this.apiEndpoint}/v1/index`, {
          method: "POST",
          headers: headers?.headers,
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (
          result.status?.code !== "OK" &&
          result.status?.code !== "ALREADY_EXISTS"
        ) {
          const error = new Error(
            `Vectara API returned status code ${result.code}: ${result.message}`
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error as any).code = 500;
          throw error;
        } else {
          countAdded += 1;
        }
      } catch (e) {
        const error = new Error(
          `Error ${(e as Error).message} while adding document ${document}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).code = 500;
        throw error;
      }
    }
    if (this.verbose) {
      console.log(`Added ${countAdded} documents to Vectara`);
    }
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
          query,
          numResults: k,
          corpusKey: [
            {
              customerId: this.customerId,
              corpusId: this.corpusId,
              metadataFilter: filter?.filter ?? "",
              lexicalInterpolationConfig: { lambda: filter?.lambda ?? 0.025 },
            },
          ],
        },
      ],
    };

    const response = await fetch(`https://${this.apiEndpoint}/v1/query`, {
      method: "POST",
      headers: headers?.headers,
      body: JSON.stringify(data),
    });
    if (response.status !== 200) {
      throw new Error(`Vectara API returned status code ${response.status}`);
    }
    const result = await response.json();
    const responses = result.responseSet[0].response;
    const documentsAndScores = responses.map(
      (response: {
        text: string;
        metadata: Record<string, unknown>;
        score: number;
      }) => [
        new Document({
          pageContent: response.text,
          metadata: response.metadata,
        }),
        response.score,
      ]
    );
    return documentsAndScores;
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
  ): Promise<[Document, number][]> {
    throw new Error(
      "Method not implemented. Please call similaritySearch or similaritySearchWithScore instead."
    );
  }

  static fromTexts(
    texts: string[],
    metadatas: object | object[],
    _embeddings: Embeddings,
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

    return VectaraStore.fromDocuments(docs, new FakeEmbeddings(), args);
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
