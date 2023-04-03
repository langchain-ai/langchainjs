import { Tool } from "./base.js";

// Full documentation @ https://graphql.chat
const graphqlChatRestEndpoint = "https://graphql.chat/api";

class GraphqlChat extends Tool {
  name: string;

  description: string;

  accessToken?: string;

  graphqlEndpoint?: string;

  graphqlSchema?: string;

  graphqlEndpointAccessToken?: string;

  constructor({
    description,
    accessToken,
    graphqlEndpoint = process.env.GRAPHQLCHAT_ACCESS_TOKEN,
    graphqlSchema = process.env.GRAPHQLCHAT_SCHEMA,
    graphqlEndpointAccessToken = process.env.GRAPHQLCHAT_ENDPOINT_ACCESS_TOKEN,
  }: {
    description: string;
    accessToken?: string | undefined;
    graphqlEndpoint: string | undefined;
    graphqlSchema: string | undefined;
    graphqlEndpointAccessToken: string | undefined;
  }) {
    super();
    this.name = "GraphqlChat";
    this.description =
      description || "Query a remote graphql API to answer questions";
    this.accessToken = accessToken;
    this.graphqlEndpoint = graphqlEndpoint;
    this.graphqlSchema = graphqlSchema;
    this.graphqlEndpointAccessToken = graphqlEndpointAccessToken;
    if (!this.accessToken) {
      if (!this.graphqlEndpoint) {
        throw new Error(
          "graphqlEndpoint key not set. You can set it as GRAPHQLCHAT_ENDPOINT in your .env file."
        );
      }
      if (!this.graphqlSchema) {
        throw new Error(
          "graphqlSchema key not set. You can set it as GRAPHQLCHAT_SCHEMA in your .env file."
        );
      }
    }
  }

  async _call(input: string): Promise<string> {
    const response = await fetch(graphqlChatRestEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 'Authorization': `Bearer ${this.accessToken}` in case you got an access token from graphql.chat
        // Once you are using access token you can send only the question
      },
      body: JSON.stringify({
        question: input,
        graphqlEndpoint: this.graphqlEndpoint,
        graphqlSchema: this.graphqlSchema,
        endpointAccessToken: this.graphqlEndpointAccessToken,
      }),
    });
    const jsonResp = await response.json();
    if (jsonResp.errors) {
      throw new Error(`HTTP error ${jsonResp.errors[0].message}`);
    }
    return jsonResp.answer;
  }
}

export { GraphqlChat };
