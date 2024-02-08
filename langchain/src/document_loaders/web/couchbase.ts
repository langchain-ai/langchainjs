import { Cluster, QueryResult } from "couchbase";
import { Document } from "../../document.js";
import { BaseDocumentLoader, DocumentLoader } from "../base.js";

export class CouchbaseDocumentLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  private cluster: Cluster;

  private query: string;

  private pageContentFields?: string[];

  private metadataFields?: string[];

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

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    for await (const doc of this.lazyLoad()) {
      documents.push(doc);
    }
    return documents;
  }

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
        .map((k) => `${k}: ${row[k]}`)
        .join("\n");

      yield new Document({
        pageContent: document,
        metadata,
      });
    }
  }
}
