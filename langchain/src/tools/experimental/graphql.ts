import { z } from "zod";
import { StructuredTool } from "../base.js";

export class GraphQLClientTool extends StructuredTool {
  static lc_name() {
    return "GraphQLClientTool";
  }

  name = "gql_client";

  description = `You can make a GraphQL request with this tool`;

  _endpoint: string;

  _headers: HeadersInit | undefined;

  schema = z.object({
    query: z.string(),
    variables: z.object({}),
  })

  constructor({ endpoint, headers }: { endpoint: string, headers?: HeadersInit }) {
    super();

    this._endpoint = endpoint;
    this._headers = headers;
  }

  async _call({ query, variables }: z.infer<typeof this.schema>) {
    const response = await fetch(this._endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this._headers,
      },
      body: JSON.stringify({ query, variables }),
    });

    return await response.text();
  }
}
