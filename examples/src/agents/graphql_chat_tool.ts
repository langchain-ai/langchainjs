import { ChatOpenAI } from "langchain/chat_models";
import { initializeAgentExecutor } from "langchain/agents";
import { GraphqlChat } from "langchain/tools";

export const run = async () => {
  const tools = [
    // For access token please reach to omri@graphql.chat
    // new GraphqlChat({
    //    accessToken: "YOUR ACCESS TOKEN HERE"
    //    description: "Query XXX API to answer questions about YYYYY, // Put here your graphql api description
    // })

    new GraphqlChat({
      description:
        "Query a remote github API to answer questions about code/repos ech", // Put here your graphql api description
      graphqlEndpoint: "https://api.github.com/graphql", // graphqlEndpoint put here your graphql endpoint
      graphqlSchema: `YOUR_SCHEMA_HERE`,
      graphqlEndpointAccessToken: "", // Optional, if you need to pass the access token to your graphql endpoint
    }),
  ];
  const agent = await initializeAgentExecutor(
    tools,
    new ChatOpenAI({ temperature: 0 }),
    "chat-zero-shot-react-description",
    true
  );

  const result = await agent.call({
    input: "What are the oldest open PRs in my repos?",
  });

  console.log({ result });
};
