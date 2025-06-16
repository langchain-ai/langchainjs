import { FalkorDBGraph } from "@langchain/community/graphs/falkordb";
import { OpenAI } from "@langchain/openai";
import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";

/**
 * This example uses FalkorDB database, which is a native graph database.
 * To set it up follow the instructions on https://docs.falkordb.com/.
 * 
 * You can run FalkorDB using Docker:
 * docker run -p 6379:6379 -it --rm falkordb/falkordb:latest
 */

// Connect to FalkorDB using host and port (new approach)
const graph = await FalkorDBGraph.initialize({ 
  host: "localhost",
  port: 6379,
  graph: "movies"  // Fixed: use 'graph' instead of 'graphId'
});

const model = new OpenAI({ temperature: 0 });

// Populate the database with two nodes and a relationship
await graph.query(
  "CREATE (a:Actor {name:'Bruce Willis'})" +
    "-[:ACTED_IN]->(:Movie {title: 'Pulp Fiction'})"
);

await graph.refreshSchema();

const chain = GraphCypherQAChain.fromLLM({
  llm: model,
  graph,
});

const res = await chain.run("Who played in Pulp Fiction?");
console.log(res);
// Bruce Willis played in Pulp Fiction.