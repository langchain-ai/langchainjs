import {
    KendraClient,
    QueryCommand,
    QueryCommandOutput,
  } from "@aws-sdk/client-kendra";
  
  import { BaseRetriever } from "../schema/index.js";
  import { Document } from "../document.js";
  
  export interface KendraRetrieverArgs {
    indexId: string;
    topK: number;
    region?: string;
  }
  
  export class KendraRetriever extends BaseRetriever {
    indexId: string;
  
    topK: number;
  
    kendraClient: KendraClient;
  
    constructor({ indexId, topK, region }: KendraRetrieverArgs) {
      super();
  
      this.topK = topK;
      this.kendraClient = new KendraClient({
        region,
      });
      this.indexId = indexId;
    }
  
    cleanResult = (resText: string) => {
      const res = resText.replace(/\s+/g, " ").replace(/\.\.\./g, "");
      return res;
    };
  
    getTopNResults = (res: QueryCommandOutput, count: number) => {
      // Check if Kendra returned items.
      if (!res.ResultItems) {
        return {
          page_content: "No result items found.",
          metadata: {},
        };
      }
  
      const r = res.ResultItems[count];
  
      // Check if Kendra has properties on returned items.
      if (
        !r.DocumentTitle ||
        !r.DocumentURI ||
        !r.Type ||
        !r.AdditionalAttributes ||
        !r.DocumentExcerpt
      ) {
        return {
          page_content: "Incomplete result item data",
          metadata: {},
        };
      }
  
      const docTitle = r.DocumentTitle.Text;
      const docUri = r.DocumentURI;
      const rType = r.Type;
  
      const resText =
        r?.AdditionalAttributes?.[0]?.Value?.TextWithHighlightsValue?.Text ||
        r?.DocumentExcerpt?.Text;
  
      const docExcerpt = this.cleanResult(resText || "");
      const combineText = `Document Title: ${docTitle}\nDocument Excerpt: \n${docExcerpt}\n`;
  
      return {
        page_content: combineText,
        metadata: {
          source: docUri,
          title: docTitle,
          excerpt: docExcerpt,
          type: rType,
        },
      };
    };
  
    async getRelevantDocuments(query: string): Promise<Document[]> {
      const command = new QueryCommand({
        IndexId: this.indexId,
        QueryText: query,
      });
  
      const response = await this.kendraClient.send(command);
  
      if (response.ResultItems) {
        let rCount = 0;
        if (response.ResultItems.length > this.topK) {
          rCount = this.topK;
        } else {
          rCount = response.ResultItems.length;
        }
  
        const docs = Array.from({ length: rCount }, (_, i) =>
          this.getTopNResults(response, i)
        );
  
        return docs.map(
          (d) =>
            new Document({ pageContent: d.page_content, metadata: d.metadata })
        );
      } else {
        return [];
      }
    }
  }
  