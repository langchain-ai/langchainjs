/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { FalkorDBGraph } from "../falkordb_graph.js";

test.skip("Test that FalkorDN database is correctly instantiated and connected", async () => {
  const url = process.env.FALKORDB_URI as string;

  expect(url).toBeDefined();

  const graph = await FalkorDBGraph.initialize({ url });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return graph.query('RETURN "test" AS output').then((output: any) => {
    const expectedOutput = [{ output: "test" }];
    expect(output).toEqual(expectedOutput);
  });
});
