import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

/**
 * See https://docs.sort.xyz/docs/api-keys to get your free Sort API key.
 * See https://docs.sort.xyz for more information on the available queries.
 * See https://docs.sort.xyz/reference for more information about Sort's REST API.
 */

export interface Query {
  type: "NFTMetadata" | "latestTransactions";
  contractAddress: string;
  blockchain: "ethereum" | "polygon" | "goerli";
  limit?: number;
}

/**
 * Interface representing the parameters for the SortXYZBlockchainLoader
 * class.
 */
export interface SortXYZBlockchainLoaderParams {
  apiKey: string;
  query: Query | string;
}

/**
 * Interface representing the response from the SortXYZ API.
 */
export interface SortXYZBlockchainAPIResponse {
  code: number;
  data: {
    durationMs: number;
    id: string;
    query: string;
    records: Record<string, unknown>[];
    recordCount: number;
  };
}

/**
 * Class representing a document loader for loading data from the SortXYZ
 * blockchain using the SortXYZ API.
 * @example
 * ```typescript
 * const blockchainLoader = new SortXYZBlockchainLoader({
 *   apiKey: "YOUR_SORTXYZ_API_KEY",
 *   query: {
 *     type: "NFTMetadata",
 *     blockchain: "ethereum",
 *     contractAddress: "0x887F3909C14DAbd9e9510128cA6cBb448E932d7f".toLowerCase(),
 *   },
 * });
 *
 * const blockchainData = await blockchainLoader.load();
 *
 * const prompt =
 *   "Describe the character with the attributes from the following json document in a 4 sentence story. ";
 * const model = new ChatOpenAI({ temperature: 0.9 })
 * const response = await model.invoke(
 *   prompt + JSON.stringify(blockchainData[0], null, 2),
 * );
 * console.log(`user > ${prompt}`);
 * console.log(`chatgpt > ${response}`);
 * ```
 */
export class SortXYZBlockchainLoader extends BaseDocumentLoader {
  public readonly contractAddress: string;

  public readonly blockchain: string;

  public readonly apiKey: string;

  public readonly queryType: string;

  public readonly sql: string;

  public readonly limit: number;

  constructor({ apiKey, query }: SortXYZBlockchainLoaderParams) {
    super();

    if (!apiKey) {
      throw new Error(
        `apiKey is required! Head over to https://docs.sort.xyz/docs/api-keys to get your free Sort API key.`
      );
    }

    this.apiKey = apiKey;

    if (typeof query === "string") {
      this.sql = query;
    } else {
      this.contractAddress = query.contractAddress.toLowerCase();
      this.blockchain = query.blockchain;
      this.queryType = query.type;
      this.limit = query.limit ?? 100;
    }
  }

  /**
   * Method that loads the data from the SortXYZ blockchain based on the
   * specified query parameters. It makes requests to the SortXYZ API and
   * returns an array of Documents representing the retrieved data.
   * @returns Promise<Document[]> - An array of Documents representing the retrieved data.
   */
  public async load(): Promise<Document[]> {
    if (this.limit > 1000) {
      throw new Error(
        `Limit is set too high. Please set limit to 1000 or lower.`
      );
    }

    const docs: Document[] = [];
    let queryOffset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = "";

      if (this.sql) {
        query = this.sql;
      } else if (this.queryType === "NFTMetadata") {
        // All parameters here are user defined
        query = `SELECT * FROM ${this.blockchain}.nft_metadata WHERE contract_address = '${this.contractAddress}' ORDER BY token_id DESC LIMIT ${this.limit} OFFSET ${queryOffset}`;
      } else if (this.queryType === "latestTransactions") {
        // All parameters here are user defined
        query = `SELECT * FROM ${this.blockchain}.transaction t, ethereum.block b WHERE t.to_address = '${this.contractAddress}' AND b.id=t.block_id ORDER BY b.timestamp DESC LIMIT ${this.limit} OFFSET ${queryOffset}`;
      }

      try {
        const response = await fetch("https://api.sort.xyz/v1/queries/run", {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey as string,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        const fullResponse = await response.json();

        // Reached the end, no more records
        if (
          fullResponse &&
          fullResponse.data &&
          fullResponse.data.records.length === 0
        ) {
          break;
        }

        const data = fullResponse?.data || [];

        for (let i = 0; i < data.records.length; i += 1) {
          const doc = new Document({
            pageContent: JSON.stringify(data.records[i], null, 2),
            metadata: {
              row: i,
            },
          });

          docs.push(doc);
        }

        queryOffset += this.limit;

        if (queryOffset >= this.limit || this.sql) {
          break;
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }

    return docs;
  }
}
