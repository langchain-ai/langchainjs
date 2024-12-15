/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { FalkorDBGraph } from "../falkordb_graph.js";

describe("FalkorDB Graph Tests", () => {
    const url = process.env.FALKORDB_URI as string;
    let graph: FalkorDBGraph;
  
    beforeEach(async () => {
      graph = await FalkorDBGraph.initialize({ url });
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
        expect(output).toEqual(expectedOutput);
      });
    });
});