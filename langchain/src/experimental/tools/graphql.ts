import { z } from "zod";
import { StructuredTool } from "../../tools/base.js";

/**
 * Class that represents a GraphQL client in the LangChain framework.
 *
 * @security **Security Notice**
 * This class sends HTTP requests to a given endpoint.
 * The GraphQLClientTool class provides a _call method that can be used
 * to make a GraphQL query or mutation by sending an HTTP request.
 *
 * @link See https://js.langchain.com/docs/security for more information.
 */

export class GraphQLClientTool extends StructuredTool {
  static lc_name() {
    return "GraphQLClientTool";
  }

  name = "gql_client";

  description = `You can make a GraphQL request with this tool`;

  private endpoint: string;

  private headers: HeadersInit | undefined;

  schema = z.object({
    query: z.string(),
    variables: z.object({}).optional(),
  });

  constructor({
    endpoint,
    headers,
  }: {
    endpoint: string;
    headers?: HeadersInit;
  }) {
    super();

    this.endpoint = endpoint;
    this.headers = headers;
  }

  async _call({ query, variables }: z.infer<typeof this.schema>) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({ query, variables }),
    });

    return response.text();
  }
}
