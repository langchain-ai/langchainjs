import { Document } from "../document.js";
import {
  RemoteRetriever,
  RemoteRetrieverValues,
  RemoteRetrieverParams,
} from "./remote/base.js";

export interface VespaRetrieverParams extends RemoteRetrieverParams {
  /**
   * The body of the query to send to Vespa
   */
  query_body: object;
  /**
   * The name of the field the content resides in
   */
  content_field: string;
}

export class VespaRetriever extends RemoteRetriever {
  query_body: object;

  content_field: string;

  constructor({ query_body, content_field, ...rest }: VespaRetrieverParams) {
    super(rest);
    this.query_body = query_body;
    this.content_field = content_field;

    this.url = `${this.url}/search/?`;
  }

  createJsonBody(query: string): RemoteRetrieverValues {
    return {
      ...this.query_body,
      query,
    };
  }

  processJsonResponse(json: RemoteRetrieverValues): Document[] {
    return json.root.children.map(
      (doc: {
        id: string;
        relevance: number;
        source: string;
        fields: Record<string, unknown>;
      }) =>
        new Document({
          pageContent: doc.fields[this.content_field] as string,
          metadata: { id: doc.id },
        })
    );
  }
}
