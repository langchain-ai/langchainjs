/* eslint-disable no-process-env */

import { test, beforeEach, afterEach, describe, expect } from "@jest/globals";
import { FalkorDBGraph } from "../falkordb.js";

describe("FalkorDB Graph Tests", () => {
  const host = process.env.FALKORDB_HOST || "localhost";
  const port = parseInt(process.env.FALKORDB_PORT || "6379", 10);
  let graph: FalkorDBGraph;

  beforeEach(async () => {
    try {
      graph = await FalkorDBGraph.initialize({ 
        host, 
        port, 
        graph: "falkordbTestGraph" 
      });
      await graph.refreshSchema();
      await graph.clearGraph();
    } catch (error) {
      console.warn("Failed to initialize FalkorDB for tests. Make sure FalkorDB is running and accessible.");
      throw error;
    }
  });

  afterEach(async () => {
    if (graph && graph.isConnected()) {
      await graph.close();
    }
  });

  test("Test that FalkorDB database is correctly instantiated and connected", async () => {
    expect(host).toBeDefined();
    expect(port).toBeDefined();
    expect(graph.isConnected()).toBe(true);
    expect(graph.hasSelectedGraph()).toBe(true);

    // Test basic connectivity with a simple query
    const result = await graph.query('RETURN "test" AS output');
    const expectedOutput = [{ output: "test" }];
    expect(result.data).toEqual(expectedOutput);
  });

  test("Verify refreshSchema accurately updates the schema", async () => {
    // Create test data
    await graph.query(`
      CREATE (:Person {name: 'Alice', age: 30})-[:FRIENDS_WITH {since: '2020'}]->(:Person {name: 'Bob', age: 25})
    `);
    
    // Refresh schema to pick up the new data
    await graph.refreshSchema();

    const schema = graph.getSchema();
    const structuredSchema = graph.getStructuredSchema();

    // Verify schema contains expected elements
    expect(schema).toContain("Person");
    expect(schema).toContain("FRIENDS_WITH");
    expect(schema).toContain("name");
    expect(schema).toContain("age");
    expect(schema).toContain("since");

    // Verify structured schema
    expect(structuredSchema.nodeProps.Person).toContain("name");
    expect(structuredSchema.nodeProps.Person).toContain("age");
    expect(structuredSchema.relProps.FRIENDS_WITH).toContain("since");
    expect(structuredSchema.relationships).toContainEqual({
      start: "Person",
      type: "FRIENDS_WITH", 
      end: "Person"
    });
  });

  test("Test utility methods work correctly", async () => {
    // Test connection status
    expect(graph.isConnected()).toBe(true);
    expect(graph.hasSelectedGraph()).toBe(true);
    expect(graph.getConnectionUrl()).toBe(`http://${host}:${port}`);

    // Test multiple queries execution
    const queries = [
      'CREATE (:TestNode {id: 1})',
      'CREATE (:TestNode {id: 2})',
      'MATCH (n:TestNode) RETURN count(n) AS count'
    ];
    
    const results = await graph.executeQueries(queries);
    expect(results).toHaveLength(3);
    expect(results[2].data[0].count).toBe(2);

    // Test clear graph
    await graph.clearGraph();
    const emptyResult = await graph.query('MATCH (n) RETURN count(n) AS count');
    expect(emptyResult.data[0].count).toBe(0);
  });

  test("Test error handling for invalid operations", async () => {
    // Test query without selected graph
    const newGraph = new FalkorDBGraph({ host, port, enhancedSchema: false });
    
    await expect(newGraph.query('RETURN 1')).rejects.toThrow("No graph selected");
    await expect(newGraph.refreshSchema()).rejects.toThrow("No graph selected");
    await expect(newGraph.clearGraph()).rejects.toThrow("No graph selected");
  });

  test("Test legacy URL support", async () => {
    // Test that URL format still works for backward compatibility
    const legacyGraph = await FalkorDBGraph.initialize({
      url: `redis://${host}:${port}`,
      graph: "legacyTestGraph"
    });

    expect(legacyGraph.isConnected()).toBe(true);
    expect(legacyGraph.hasSelectedGraph()).toBe(true);
    expect(legacyGraph.getConnectionUrl()).toBe(`http://${host}:${port}`);

    await legacyGraph.close();
  });
});