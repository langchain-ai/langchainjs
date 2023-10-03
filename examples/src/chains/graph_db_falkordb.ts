import { FalkorDBGraph } from "langchain/graphs/falkordb_graph";
import { OpenAI } from "langchain/llms/openai";
import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";

/**
 * This example uses FalkorDB database, which is native graph database.
 * To set it up follow the instructions on https://docs.falkordb.com/.
 */

const url = "bolt://localhost:6379";

const graph = await FalkorDBGraph.initialize({ url });
const model = new OpenAI({ temperature: 0 });

// Populate the database with two nodes and a relationship
await graph.query(
  "CREATE (a:Actor {name:'Bruce Willis'})" +
    "-[:ACTED_IN]->(:Movie {title: 'Pulp Fiction'})"
);

const chain = GraphCypherQAChain.fromLLM({
  llm: model,
  graph,
});

const res = await chain.run("Who played in Pulp Fiction?");
console.log(res);
// Bruce Willis played in Pulp Fiction.
