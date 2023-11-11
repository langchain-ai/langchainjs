/* eslint-disable no-process-env */

import { GraphCypherQAChain, INTERMEDIATE_STEPS_KEY } from "../cypher.js";
import { Neo4jGraph } from "../../../graphs/neo4j_graph.js";
import { OpenAI } from "../../../llms/openai.js";
import { ChainValues } from "../../../schema/index.js";

describe.skip("testCypherGeneratingRun", () => {
  const url = process.env.NEO4J_URI as string;
  const username = process.env.NEO4J_USERNAME as string;
  const password = process.env.NEO4J_PASSWORD as string;
  let graph: Neo4jGraph;

  beforeEach(async () => {
    graph = await Neo4jGraph.initialize({ url, username, password });
  });
  afterEach(async () => {
    await graph.close();
  });

  it("generate and execute Cypher statement correctly", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const model = new OpenAI({ temperature: 0 });

    // Delete all nodes in the graph
    await graph.query("MATCH (n) DETACH DELETE n");

    // Create two nodes and a relationship
    await graph.query(
      "CREATE (a:Actor {name:'Bruce Willis'})" +
        "-[:ACTED_IN]->(:Movie {title: 'Pulp Fiction'})"
    );

    await graph.refreshSchema();

    const chain = GraphCypherQAChain.fromLLM({
      llm: model,
      graph,
    });

    const output = await chain.run("Who played in Pulp Fiction?");
    const expectedOutput = "Bruce Willis";

    expect(output.includes(expectedOutput)).toBeTruthy();
  });

  it("return direct results", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const model = new OpenAI({ temperature: 0 });

    // Delete all nodes in the graph
    await graph.query("MATCH (n) DETACH DELETE n");

    // Create two nodes and a relationship
    await graph.query(
      "CREATE (a:Actor {name:'Bruce Willis'})" +
        "-[:ACTED_IN]->(:Movie {title: 'Pulp Fiction'})"
    );

    await graph.refreshSchema();

    const chain = GraphCypherQAChain.fromLLM({
      llm: model,
      graph,
      returnDirect: true,
    });

    const output = (await chain.run(
      "Who played in Pulp Fiction?"
    )) as never as ChainValues;

    const expectedOutput = [{ "a.name": "Bruce Willis" }];
    expect(output).toEqual(expectedOutput);
  });

  it("should generate and execute Cypher statement with intermediate steps", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const model = new OpenAI({ temperature: 0 });

    // Delete all nodes in the graph
    await graph.query("MATCH (n) DETACH DELETE n");

    // Create two nodes and a relationship
    await graph.query(
      "CREATE (a:Actor {name:'Bruce Willis'})" +
        "-[:ACTED_IN]->(:Movie {title: 'Pulp Fiction'})"
    );

    await graph.refreshSchema();

    const chain = GraphCypherQAChain.fromLLM({
      llm: model,
      graph,
      returnIntermediateSteps: true,
    });

    const output = (await chain.call({
      query: "Who played in Pulp Fiction?",
    })) as never as ChainValues;

    const expectedOutput = "Bruce Willis";
    expect(output.result.includes(expectedOutput)).toBeTruthy();

    const { query } = output[INTERMEDIATE_STEPS_KEY][0];
    console.log(query);
    // const expectedQuery =
    //   "\n\nMATCH (a:Actor)-[:ACTED_IN]->" +
    //   "(m:Movie) WHERE m.title = 'Pulp Fiction' RETURN a.name";
    // expect(query).toEqual(expectedQuery);

    const { context } = output[INTERMEDIATE_STEPS_KEY][1];
    const expectedContext = [{ "a.name": "Bruce Willis" }];
    expect(context).toEqual(expectedContext);
  });
});
