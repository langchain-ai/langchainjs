/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { StringOutputParser } from "../../output_parsers/string.js";

test("Test graph single runnable", async () => {
  const jsonOutputParser = new StringOutputParser();
  const graph = jsonOutputParser.getGraph();
  const firstNode = graph.firstNode();
  expect(firstNode).not.toBeNull();
  const lastNode = graph.lastNode();
  expect(lastNode).not.toBeNull();
  expect(graph.edges.length).toBe(2);
  expect(Object.keys(graph.nodes).length).toBe(3);
});
