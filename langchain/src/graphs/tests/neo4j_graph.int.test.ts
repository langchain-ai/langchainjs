/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { Neo4jGraph } from "../neo4j_graph.js";

describe.skip("Neo4j Graph Tests", () => {
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

  test("Schema generation works correctly", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    // Clear the database
    await graph.query("MATCH (n) DETACH DELETE n");

    await graph.query(
      "CREATE (a:Actor {name:'Bruce Willis'})" +
        "-[:ACTED_IN {roles: ['Butch Coolidge']}]->(:Movie {title: 'Pulp Fiction'})"
    );

    await graph.refreshSchema();
    console.log(graph.getSchema());

    // expect(graph.getSchema()).toMatchInlineSnapshot(`
    //   "Node properties are the following:
    //   Actor {name: STRING}, Movie {title: STRING}
    //   Relationship properties are the following:
    //   ACTED_IN {roles: LIST}
    //   The relationships are the following:
    //   (:Actor)-[:ACTED_IN]->(:Movie)"
    // `);
  });

  test("Test that Neo4j database is correctly instantiated and connected", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    // Integers are casted to strings in the output
    const expectedOutput = [{ output: { str: "test", int: "1" } }];
    const res = await graph.query('RETURN {str: "test", int: 1} AS output');
    await graph.close();
    expect(res).toEqual(expectedOutput);
  });
});
