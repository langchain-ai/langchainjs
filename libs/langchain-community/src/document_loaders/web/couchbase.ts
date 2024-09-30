/* eslint-disable import/no-extraneous-dependencies */
import { Cluster, QueryResult } from "couchbase";
import { Document } from "@langchain/core/documents";
import {
  BaseDocumentLoader,
  DocumentLoader,
} from "@langchain/core/document_loaders/base";

/**
 * loader for couchbase document
 */
export class CouchbaseDocumentLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  private cluster: Cluster;

  private query: string;

  private pageContentFields?: string[];

  private metadataFields?: string[];

  /**
   * construct Couchbase document loader with a requirement for couchbase cluster client
   * @param client { Cluster } [ couchbase connected client to connect to database ]
   * @param query { string } [ query to get results from while loading the data ]
   * @param pageContentFields { Array<string> } [ filters fields of the document and shows these only ]
   * @param metadataFields { Array<string> } [ metadata fields required ]
   */
  constructor(
    client: Cluster,
    query: string,
    pageContentFields?: string[],
    metadataFields?: string[]
  ) {
    super();
    if (!client) {
      throw new Error("Couchbase client cluster must be provided.");
    }
    this.cluster = client;
    this.query = query;
    this.pageContentFields = pageContentFields;
    this.metadataFields = metadataFields;
  }

  /**
   * Function to load document based on query from couchbase
   * @returns {Promise<Document[]>} [ Returns a promise of all the documents as array ]
   */
  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    for await (const doc of this.lazyLoad()) {
      documents.push(doc);
    }
    return documents;
  }

  /**
   * Function to load documents based on iterator rather than full load
   * @returns {AsyncIterable<Document>} [ Returns an iterator to fetch documents ]
   */
  async *lazyLoad(): AsyncIterable<Document> {
    // Run SQL++ Query
    const result: QueryResult = await this.cluster.query(this.query);
    for await (const row of result.rows) {
      let { metadataFields, pageContentFields } = this;

      if (!pageContentFields) {
        pageContentFields = Object.keys(row);
      }

      if (!metadataFields) {
        metadataFields = [];
      }

      const metadata = metadataFields.reduce(
        (obj, field) => ({ ...obj, [field]: row[field] }),
        {}
      );

      const document = pageContentFields
        .map((k) => `${k}: ${JSON.stringify(row[k])}`)
        .join("\n");

      yield new Document({
        pageContent: document,
        metadata,
      });
    }
  }
}
