import {
  AttributeFilter,
  DocumentAttribute,
  DocumentAttributeValue,
  KendraClient,
  KendraClientConfig,
  QueryCommand,
  QueryCommandOutput,
  QueryResultItem,
  RetrieveCommand,
  RetrieveCommandOutput,
  RetrieveResultItem,
} from "@aws-sdk/client-kendra";

import { BaseRetriever } from "../schema/retriever.js";
import { Document } from "../document.js";

export interface AmazonKendraRetrieverArgs {
  indexId: string;
  topK: number;
  region: string;
  attributeFilter?: AttributeFilter;
  clientOptions?: KendraClientConfig;
}

export class AmazonKendraRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers", "amazon_kendra"];

  indexId: string;

  topK: number;

  kendraClient: KendraClient;

  attributeFilter?: AttributeFilter;

  constructor({
    indexId,
    topK = 10,
    clientOptions,
    attributeFilter,
    region,
  }: AmazonKendraRetrieverArgs) {
    super();

    if (!region) {
      throw new Error("Please pass regionName field to the constructor!");
    }

    if (!indexId) {
      throw new Error("Please pass Kendra Index Id to the constructor");
    }

    this.topK = topK;
    this.kendraClient = new KendraClient({
      region,
      ...clientOptions,
    });
    this.attributeFilter = attributeFilter;
    this.indexId = indexId;
  }

  // A method to combine title and excerpt into a single string.
  combineText(title?: string, excerpt?: string): string {
    let text = "";
    if (title) {
      text += `Document Title: ${title}\n`;
    }
    if (excerpt) {
      text += `Document Excerpt: \n${excerpt}\n`;
    }
    return text;
  }

  // A method to clean the result text by replacing sequences of whitespace with a single space and removing ellipses.
  cleanResult(resText: string) {
    const res = resText.replace(/\s+/g, " ").replace(/\.\.\./g, "");
    return res;
  }

  // A method to extract the attribute value from a DocumentAttributeValue object.
  getDocAttributeValue(value: DocumentAttributeValue) {
    if (value.DateValue) {
      return value.DateValue;
    }
    if (value.LongValue) {
      return value.LongValue;
    }
    if (value.StringListValue) {
      return value.StringListValue;
    }
    if (value.StringValue) {
      return value.StringValue;
    }
    return "";
  }

  // A method to extract the attribute key-value pairs from an array of DocumentAttribute objects.
  getDocAttributes(documentAttributes?: DocumentAttribute[]): {
    [key: string]: unknown;
  } {
    const attributes: { [key: string]: unknown } = {};
    if (documentAttributes) {
      for (const attr of documentAttributes) {
        if (attr.Key && attr.Value) {
          attributes[attr.Key] = this.getDocAttributeValue(attr.Value);
        }
      }
    }
    return attributes;
  }

  // A method to convert a RetrieveResultItem object into a Document object.
  convertRetrieverItem(item: RetrieveResultItem) {
    const title = item.DocumentTitle || "";
    const excerpt = item.Content ? this.cleanResult(item.Content) : "";
    const pageContent = this.combineText(title, excerpt);
    const source = item.DocumentURI;
    const attributes = this.getDocAttributes(item.DocumentAttributes);
    const metadata = {
      source,
      title,
      excerpt,
      document_attributes: attributes,
    };

    return new Document({ pageContent, metadata });
  }

  // A method to extract the top-k documents from a RetrieveCommandOutput object.
  getRetrieverDocs(
    response: RetrieveCommandOutput,
    pageSize: number
  ): Document[] {
    if (!response.ResultItems) return [];
    const { length } = response.ResultItems;
    const count = length < pageSize ? length : pageSize;

    return response.ResultItems.slice(0, count).map((item) =>
      this.convertRetrieverItem(item)
    );
  }

  // A method to extract the excerpt text from a QueryResultItem object.
  getQueryItemExcerpt(item: QueryResultItem) {
    if (
      item.AdditionalAttributes &&
      item.AdditionalAttributes[0].Key === "AnswerText"
    ) {
      if (!item.AdditionalAttributes) {
        return "";
      }
      if (!item.AdditionalAttributes[0]) {
        return "";
      }

      return this.cleanResult(
        item.AdditionalAttributes[0].Value?.TextWithHighlightsValue?.Text || ""
      );
    } else if (item.DocumentExcerpt) {
      return this.cleanResult(item.DocumentExcerpt.Text || "");
    } else {
      return "";
    }
  }

  // A method to convert a QueryResultItem object into a Document object.
  convertQueryItem(item: QueryResultItem) {
    const title = item.DocumentTitle?.Text || "";
    const excerpt = this.getQueryItemExcerpt(item);
    const pageContent = this.combineText(title, excerpt);
    const source = item.DocumentURI;
    const attributes = this.getDocAttributes(item.DocumentAttributes);
    const metadata = {
      source,
      title,
      excerpt,
      document_attributes: attributes,
    };

    return new Document({ pageContent, metadata });
  }

  // A method to extract the top-k documents from a QueryCommandOutput object.
  getQueryDocs(response: QueryCommandOutput, pageSize: number) {
    if (!response.ResultItems) return [];
    const { length } = response.ResultItems;
    const count = length < pageSize ? length : pageSize;
    return response.ResultItems.slice(0, count).map((item) =>
      this.convertQueryItem(item)
    );
  }

  // A method to send a retrieve or query request to Kendra and return the top-k documents.
  async queryKendra(
    query: string,
    topK: number,
    attributeFilter?: AttributeFilter
  ) {
    const retrieveCommand = new RetrieveCommand({
      IndexId: this.indexId,
      QueryText: query,
      PageSize: topK,
      AttributeFilter: attributeFilter,
    });

    const retrieveResponse = await this.kendraClient.send(retrieveCommand);
    const retriveLength = retrieveResponse.ResultItems?.length;

    if (retriveLength === 0) {
      // Retrieve API returned 0 results, call query API
      const queryCommand = new QueryCommand({
        IndexId: this.indexId,
        QueryText: query,
        PageSize: topK,
        AttributeFilter: attributeFilter,
      });

      const queryResponse = await this.kendraClient.send(queryCommand);
      return this.getQueryDocs(queryResponse, this.topK);
    } else {
      return this.getRetrieverDocs(retrieveResponse, this.topK);
    }
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const docs = await this.queryKendra(query, this.topK, this.attributeFilter);
    return docs;
  }
}
