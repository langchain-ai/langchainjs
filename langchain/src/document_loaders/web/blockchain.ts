import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

/**
 * See https://docs.sort.xyz/docs/api-keys to get your free Sort API key.
 * See https://docs.sort.xyz for more information on the available queries.
 * See https://docs.sort.xyz/reference for more information about Sort's REST API.
 */

export interface Query {
  type: 'NFTMetadata' | 'latestTransactions';
  contractAddress: string;
  blockchain: 'ethereum' | 'polygon' | 'goerli';
  limit?: number;
}

export interface BlockchainPageLoaderParams {
  apiKey: string;
  query: Query | string;
}

export interface BlockchainAPIResponse {
  code: number;
  data: {
    durationMs: number;
    id: string;
    query: string;
    records: any[];
    recordCount: number;
  }
}

export class BlockchainPagesLoader extends BaseDocumentLoader {
  private readonly ITEMS_PER_PAGE = 100;

  public readonly contractAddress: string;

  public readonly blockchain: string;

  public readonly apiKey: string;

  public readonly queryType: string;

  public readonly sql: string;

  public readonly limit: number;

  constructor({
    apiKey,
    query
  }: BlockchainPageLoaderParams) {
    super();

    if (!apiKey) {
      throw new Error(
        `apiKey is required! Head over to https://docs.sort.xyz/docs/api-keys to get your free Sort API key.`
      );
    }

    this.apiKey = apiKey;

    if (typeof query === 'string') {
      this.sql = query;
    } else {
      this.contractAddress = query.contractAddress.toLowerCase();
      this.blockchain = query.blockchain;
      this.queryType = query.type;
      this.limit = query.limit || 100;
    }
  }

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
      let query = '';

      if (this.sql) {
        query = this.sql;
      } else if (this.queryType === 'NFTMetadata') {
        query = `SELECT * FROM ${this.blockchain}.nft_metadata WHERE contract_address = '${this.contractAddress}' ORDER BY token_id DESC LIMIT ${this.ITEMS_PER_PAGE} OFFSET ${queryOffset}`;
      } else if (this.queryType === 'latestTransactions') {
        query = `SELECT * FROM ${this.blockchain}.transaction t, ethereum.block b WHERE t.to_address = '${this.contractAddress}' AND b.id=t.block_id ORDER BY b.timestamp DESC LIMIT ${this.ITEMS_PER_PAGE} OFFSET ${queryOffset}`;
      }

      try {
        const response = await fetch('https://api.sort.xyz/v1/queries/run', {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey as string,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query }),
        })

        const full_response = await response.json();

        // Reached the end, no more records
        if (full_response && full_response.data && full_response.data.records.length === 0) {
          break;
        }

        const data = full_response?.data || [];

        for (let i = 0; i < data.records.length; i += 1) {
          const doc = new Document({
            pageContent: JSON.stringify(data.records[i], null, 2),
            metadata: {
              row: i
            },
          });

          docs.push(doc);
        }

        queryOffset += this.ITEMS_PER_PAGE;

        if (queryOffset >= this.limit || this.sql) {
          break;
        }

      } catch (error) {
        console.error('Error:', error);
      }
    }

    return docs;
  }
}
