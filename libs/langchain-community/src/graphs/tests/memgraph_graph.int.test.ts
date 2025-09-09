import { test } from "@jest/globals";
import { MemgraphGraph } from "../memgraph_graph.js";

describe.skip("Memgraph Graph Tests", () => {
  const url = process.env.MEMGRAPH_URI as string;
  const username = process.env.MEMGRAPH_USERNAME as string;
  const password = process.env.MEMGRAPH_PASSWORD as string;
  let graph: MemgraphGraph;

  beforeEach(async () => {
    graph = await MemgraphGraph.initialize({ url, username, password });
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
    // console.log(graph.getSchema());

    expect(graph.getSchema()).toMatchInlineSnapshot(`
      "Node properties are the following:
      Node name: 'Actor', Node properties: [{"property":"name","type":"str"}]
      Node name: 'Movie', Node properties: [{"property":"title","type":"str"}]
      Relationship properties are the following:
      Relationship name: 'ACTED_IN', Relationship properties: [{"property":"roles","type":"tuple"}]
      The relationships are the following:
      (:Actor)-[:ACTED_IN]->(:Movie)"
    `);
  });

  test("Test that Memgraph database is correctly instantiated and connected", async () => {
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
