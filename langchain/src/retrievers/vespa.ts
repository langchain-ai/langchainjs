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

/**
 * Class responsible for retrieving data from Vespa. It extends the
 * `RemoteRetriever` class and includes methods for creating the JSON body
 * for a query and processing the JSON response from Vespa.
 * @example
 * ```typescript
 * const retriever = new VespaRetriever({
 *   url: "https:
 *   auth: false,
 *   query_body: {
 *     yql: "select content from paragraph where userQuery()",
 *     hits: 5,
 *     ranking: "documentation",
 *     locale: "en-us",
 *   },
 *   content_field: "content",
 * });
 * const result = await retriever.getRelevantDocuments("what is vespa?");
 * ```
 */
export class VespaRetriever extends RemoteRetriever {
  static lc_name() {
    return "VespaRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "vespa"];

  query_body: object;

  content_field: string;

  constructor(fields: VespaRetrieverParams) {
    super(fields);
    this.query_body = fields.query_body;
    this.content_field = fields.content_field;

    this.url = `${this.url}/search/?`;
  }

  /**
   * Method that takes a query string as input and returns a JSON object
   * that includes the query and the original `query_body`.
   * @param query The query string to be sent to Vespa.
   * @returns A JSON object that includes the query and the original `query_body`.
   */
  createJsonBody(query: string): RemoteRetrieverValues {
    return {
      ...this.query_body,
      query,
    };
  }

  /**
   * Method that processes the JSON response from Vespa into an array of
   * `Document` instances. Each `Document` instance includes the content
   * from the specified `content_field` and the document's ID.
   * @param json The JSON response from Vespa.
   * @returns An array of `Document` instances.
   */
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
