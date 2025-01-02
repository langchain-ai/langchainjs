/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { FalkorDBGraph } from "../falkordb.js";

describe("FalkorDB Graph Tests", () => {
  const url = process.env.FALKORDB_URI as string;
  let graph: FalkorDBGraph;

  beforeEach(async () => {
    graph = await FalkorDBGraph.initialize({ url });
    await graph.selectGraph("falkordbGraph");
    await graph.refreshSchema();
    await graph.query("MATCH (n) DETACH DELETE n");
  });

  afterEach(async () => {
    await graph.close();
  });

  test("Test that FalkorDN database is correctly instantiated and connected", async () => {
    expect(url).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return graph.query('RETURN "test" AS output').then((output: any) => {
      const expectedOutput = [{ output: "test" }];
      expect(output.data).toEqual(expectedOutput);
    });
  });

  test("Verify refreshSchema accurately updates the schema", async () => {
    await graph.query(`
      CREATE (:Person {name: 'Alice', age: 30})-[:FRIENDS_WITH]->(:Person {name: 'Bob', age: 25})
    `);
    await graph.refreshSchema();

    const schema = graph.getSchema();
    expect(schema).toContain("Person");
    expect(schema).toContain("FRIENDS_WITH");
    expect(schema).toContain("name");
    expect(schema).toContain("age");
  });
});