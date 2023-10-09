/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { Neo4jGraph } from "../neo4j_graph.js";

test("Test that Neo4j database is correctly instantiated and connected", async () => {
  const url = process.env.NEO4J_URI as string;
  const username = process.env.NEO4J_USERNAME as string;
  const password = process.env.NEO4J_PASSWORD as string;

  expect(url).toBeDefined();
  expect(username).toBeDefined();
  expect(password).toBeDefined();

  const graph = await Neo4jGraph.initialize({ url, username, password });

  // Integers are casted to strings in the output
  const expectedOutput = [{ output: { str: "test", int: "1" } }];
  const res = await graph.query('RETURN {str: "test", int: 1} AS output');
  await graph.close();
  expect(res).toEqual(expectedOutput);
});
