import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

export interface BlockchainPageLoaderParams {
  apiKey: string;
  contractAddress?: string;
  blockchain?: string;
  queryType?: string;
  sql?: string;
  limit?: number;
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
    contractAddress = "",
    blockchain="ethereum",
    queryType="latestTransactions",
    sql = "",
    limit = 100,
  }: BlockchainPageLoaderParams) {
    super();
    this.contractAddress = contractAddress;
    this.blockchain = blockchain;
    this.apiKey = apiKey;
    this.queryType = queryType;
    this.sql = sql;
    this.limit = limit;
  }

  public async load(): Promise<Document[]> {
    if (this.limit > 1000) {
        throw new Error(
          `Limit is set too high. Please set limit to 1000 or lower.`
        );
    }

    let queryOffset = 0; // control pagination and submit queries until the limit is reached
    let docs = [] as any;

    while (true) {
        let query = "select * from " + this.blockchain + ".transaction t, ethereum.block b where t.to_address = '" + this.contractAddress.toLowerCase() + "' and b.id=t.block_id order by b.timestamp desc limit " + this.limit + " offset " + queryOffset;

        // SQL query
        if (this.queryType === 'NFTMetadata') {
            query = "SELECT * FROM " + this.blockchain + ".nft_metadata WHERE contract_address = '" + this.contractAddress.toLowerCase() + "' order by token_id desc limit " + this.limit + " offset " + queryOffset;
        }
        else if (this.queryType === 'sql') {
            query = this.sql;
        }

        try {
            const response = await fetch('https://api.sort.xyz/v1/queries/run', {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey as string,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "query": query
                }),
            })
    
            const full_response = await response.json();

            // Reached the end, no more records
            if (full_response && full_response.data && full_response.data.records.length === 0) {
                break;
            }

            const data = full_response?.data;
    
            for (let i=0; i<data.records.length; i++) {
                let doc = new Document({
                    pageContent: JSON.stringify(data.records[i], null, 2),
                    metadata: {
                      row: i
                    },
                  });
    
                docs.push(doc);
            }

            queryOffset += this.ITEMS_PER_PAGE;

            if (queryOffset >= this.limit || this.queryType == 'sql') {
                break;
            }
    
        } catch (error) {
          console.error("Error:", error);
        }
    }

   

    return docs;
  }
}
