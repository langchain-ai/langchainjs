import { Neo4jGraph } from "langchain/graphs/neo4j_graph";
import { OpenAI } from "langchain/llms/openai";
import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";

/**
 * This example uses Neo4j database, which is native graph database.
 * To set it up follow the instructions on https://neo4j.com/docs/operations-manual/current/installation/.
 */

const url = "bolt://localhost:7687";
const username = "neo4j";
const password = "pleaseletmein";

const graph = await Neo4jGraph.initialize({ url, username, password });
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
