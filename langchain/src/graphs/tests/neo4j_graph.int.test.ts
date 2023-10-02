/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { Neo4jGraph } from "../neo4j_graph.js";

test.skip("Test that Neo4j database is correctly instantiated and connected", async () => {
  const url = process.env.NEO4J_URI as string;
  const username = process.env.NEO4J_USERNAME as string;
  const password = process.env.NEO4J_PASSWORD as string;

  expect(url).toBeDefined();
  expect(username).toBeDefined();
  expect(password).toBeDefined();

  const graph = await Neo4jGraph.initialize({ url, username, password });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return graph.query('RETURN "test" AS output').then((output: any) => {
    const expectedOutput = [{ output: "test" }];
    expect(output).toEqual(expectedOutput);
  });
});
