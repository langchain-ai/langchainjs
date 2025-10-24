import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { OpenAI } from "@langchain/openai";
import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";
import { PromptTemplate } from "@langchain/core/prompts";

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

// Refresh schema
await graph.refreshSchema();

/**
 * A good practice is to ask the LLM to return only Cypher statement or
 * wrap the generated Cypher statement with three backticks (```) to avoid
 * Cypher statement parsing errors.
 * Custom prompts are also great for providing generated Cypher statement
 * examples for particular questions.
 */

const cypherTemplate = `Task:Generate Cypher statement to query a graph database.
Instructions:
Use only the provided relationship types and properties in the schema.
Do not use any other relationship types or properties that are not provided.
Schema:
{schema}
Note: Do not include any explanations or apologies in your responses.
Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
Do not include any text except the generated Cypher statement.
Follow these Cypher example when Generating Cypher statements:
# How many actors played in Top Gun?
MATCH (m:Movie {{title:"Top Gun"}})<-[:ACTED_IN]-()
RETURN count(*) AS result 

The question is:
{question}`;

const cypherPrompt = new PromptTemplate({
  template: cypherTemplate,
  inputVariables: ["schema", "question"],
});

const chain = GraphCypherQAChain.fromLLM({
  llm: model,
  graph,
  cypherPrompt,
});

const res = await chain.run("Who played in Pulp Fiction?");
console.log(res);
// Bruce Willis played in Pulp Fiction.
