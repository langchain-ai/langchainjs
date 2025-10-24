import { MemgraphGraph } from "@langchain/community/graphs/memgraph_graph";
import { OpenAI } from "@langchain/openai";
import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";

/**
 * This example uses Memgraph database, an in-memory graph database.
 * To set it up follow the instructions on https://memgraph.com/docs/getting-started.
 */

const url = "bolt://localhost:7687";
const username = "";
const password = "";

const graph = await MemgraphGraph.initialize({ url, username, password });
const model = new OpenAI({ temperature: 0 });

// Populate the database with two nodes and a relationship
await graph.query(
  "CREATE (c1:Character {name: 'Jon Snow'}), (c2: Character {name: 'Olly'}) CREATE (c2)-[:KILLED {count: 1, method: 'Knife'}]->(c1);"
);

// Refresh schema
await graph.refreshSchema();

const chain = GraphCypherQAChain.fromLLM({
  llm: model,
  graph,
});

const res = await chain.run("Who killed Jon Snow and how?");
console.log(res);
// Olly killed Jon Snow using a knife.
