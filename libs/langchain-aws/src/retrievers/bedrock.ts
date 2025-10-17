import {
  RetrieveCommand,
  BedrockAgentRuntimeClient,
  type BedrockAgentRuntimeClientConfig,
  type SearchType,
  type RetrievalFilter,
} from "@aws-sdk/client-bedrock-agent-runtime";

import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the arguments required to initialize an
 * AmazonKnowledgeBaseRetriever instance.
 */
export interface AmazonKnowledgeBaseRetrieverArgs {
  knowledgeBaseId: string;
  topK: number;
  region: string;
  clientOptions?: BedrockAgentRuntimeClientConfig;
  filter?: RetrievalFilter;
  overrideSearchType?: SearchType;
}

/**
 * Class for interacting with Amazon Bedrock Knowledge Bases, a RAG workflow oriented service
 * provided by AWS. Extends the BaseRetriever class.
 * @example
 * ```typescript
 * const retriever = new AmazonKnowledgeBaseRetriever({
 *   topK: 10,
 *   knowledgeBaseId: "YOUR_KNOWLEDGE_BASE_ID",
 *   region: "us-east-2",
 *   clientOptions: {
 *     credentials: {
 *       accessKeyId: "YOUR_ACCESS_KEY_ID",
 *       secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
 *     },
 *   },
 * });
 *
 * const docs = await retriever.getRelevantDocuments("How are clouds formed?");
 * ```
 */
export class AmazonKnowledgeBaseRetriever extends BaseRetriever {
  static lc_name() {
    return "AmazonKnowledgeBaseRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "amazon_bedrock_knowledge_base"];

  knowledgeBaseId: string;

  topK: number;

  bedrockAgentRuntimeClient: BedrockAgentRuntimeClient;

  filter?: RetrievalFilter;

  overrideSearchType?: SearchType;

  constructor({
    knowledgeBaseId,
    topK = 10,
    clientOptions,
    region,
    filter,
    overrideSearchType,
  }: AmazonKnowledgeBaseRetrieverArgs) {
    super();

    this.topK = topK;
    this.filter = filter;
    this.overrideSearchType = overrideSearchType;
    this.bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({
      region,
      ...clientOptions,
    });
    this.knowledgeBaseId = knowledgeBaseId;
  }

  /**
   * Cleans the result text by replacing sequences of whitespace with a
   * single space and removing ellipses.
   * @param resText The result text to clean.
   * @returns The cleaned result text.
   */
  cleanResult(resText: string) {
    const res = resText.replace(/\s+/g, " ").replace(/\.\.\./g, "");
    return res;
  }

  async queryKnowledgeBase(
    query: string,
    topK: number,
    filter?: RetrievalFilter,
    overrideSearchType?: SearchType
  ) {
    const retrieveCommand = new RetrieveCommand({
      knowledgeBaseId: this.knowledgeBaseId,
      retrievalQuery: {
        text: query,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: topK,
          overrideSearchType,
          filter,
        },
      },
    });

    const retrieveResponse = await this.bedrockAgentRuntimeClient.send(
      retrieveCommand
    );

    return (
      retrieveResponse.retrievalResults?.map((result) => {
        let source;
        switch (result.location?.type) {
          case "CONFLUENCE":
            source = result.location?.confluenceLocation?.url;
            break;
          case "S3":
            source = result.location?.s3Location?.uri;
            break;
          case "SALESFORCE":
            source = result.location?.salesforceLocation?.url;
            break;
          case "SHAREPOINT":
            source = result.location?.sharePointLocation?.url;
            break;
          case "WEB":
            source = result.location?.webLocation?.url;
            break;
          default:
            source = result.location?.s3Location?.uri;
            break;
        }

        return {
          pageContent: this.cleanResult(result.content?.text || ""),
          metadata: {
            source,
            score: result.score,
            ...result.metadata,
          },
        };
      }) ?? ([] as Array<Document>)
    );
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const docs = await this.queryKnowledgeBase(
      query,
      this.topK,
      this.filter,
      this.overrideSearchType
    );
    return docs;
  }
}
