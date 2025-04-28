/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { BASE_ENTITY_LABEL, Neo4jGraph } from "../neo4j_graph.js";
import { GraphDocument, Relationship, Node } from "../document.js";

const TEST_DATA = [
  new GraphDocument({
    nodes: [
      new Node({ id: "foo", type: "foo" }),
      new Node({ id: "bar", type: "bar" }),
    ],
    relationships: [
      new Relationship({
        source: new Node({ id: "foo", type: "foo" }),
        target: new Node({ id: "bar", type: "bar" }),
        type: "REL",
      }),
    ],
    source: new Document({ pageContent: "source document" }),
  }),
];

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
    // console.log(graph.getSchema());

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

  test("Test that neo4j correctly import graph document.", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    await graph.query("MATCH (n) DETACH DELETE n");
    await graph.query("CALL apoc.schema.assert({}, {})");
    await graph.refreshSchema();
    await graph.addGraphDocuments(TEST_DATA);

    const output = await graph.query(
      "MATCH (n) RETURN labels(n) AS label, count(*) AS count ORDER BY label"
    );

    expect(output).toEqual([
      { label: ["bar"], count: "1" },
      { label: ["foo"], count: "1" },
    ]);
    expect(graph.getStructuredSchema().metadata?.constraint).toEqual([]);
  });

  test("Test that neo4j correctly import graph document with source.", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    await graph.query("MATCH (n) DETACH DELETE n");
    await graph.query("CALL apoc.schema.assert({}, {})");
    await graph.refreshSchema();
    await graph.addGraphDocuments(TEST_DATA, { includeSource: true });

    const output = await graph.query(
      "MATCH (n) RETURN labels(n) AS label, count(*) AS count ORDER BY label"
    );

    expect(output).toEqual([
      { label: ["Document"], count: "1" },
      { label: ["bar"], count: "1" },
      { label: ["foo"], count: "1" },
    ]);
    expect(graph.getStructuredSchema().metadata?.constraint).toEqual([]);
  });

  test("Test that neo4j correctly import graph document with base_entity.", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    await graph.query("MATCH (n) DETACH DELETE n");
    await graph.query("CALL apoc.schema.assert({}, {})");
    await graph.refreshSchema();
    await graph.addGraphDocuments(TEST_DATA, { baseEntityLabel: true });

    const output = await graph.query(
      "MATCH (n) RETURN apoc.coll.sort(labels(n)) AS label, count(*) AS count ORDER BY label"
    );

    expect(output).toEqual([
      { label: [BASE_ENTITY_LABEL, "bar"], count: "1" },
      { label: [BASE_ENTITY_LABEL, "foo"], count: "1" },
    ]);
    expect(graph.getStructuredSchema().metadata?.constraint).not.toEqual([]);
  });

  test("Test that neo4j correctly import graph document with base_entity and source.", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    await graph.query("MATCH (n) DETACH DELETE n");
    await graph.query("CALL apoc.schema.assert({}, {})");
    await graph.refreshSchema();
    await graph.addGraphDocuments(TEST_DATA, {
      baseEntityLabel: true,
      includeSource: true,
    });

    const output = await graph.query(
      "MATCH (n) RETURN apoc.coll.sort(labels(n)) AS label, count(*) AS count ORDER BY label"
    );

    expect(output).toEqual([
      { label: ["Document"], count: "1" },
      { label: [BASE_ENTITY_LABEL, "bar"], count: "1" },
      { label: [BASE_ENTITY_LABEL, "foo"], count: "1" },
    ]);
    expect(graph.getStructuredSchema().metadata?.constraint).not.toEqual([]);
  });
});

describe.skip("Neo4j Graph with custom config", () => {
  const url = process.env.NEO4J_URI as string;
  const username = process.env.NEO4J_USERNAME as string;
  const password = process.env.NEO4J_PASSWORD as string;
  const DEMO_URL = "neo4j+s://demo.neo4jlabs.com";
  const DEMO_DATABASES = [
    "recommendations",
    "buzzoverflow",
    "bluesky",
    "companies",
    "fincen",
    "gameofthrones",
    "grandstack",
    "movies",
    "neoflix",
    "network",
    "northwind",
    "offshoreleaks",
    "stackoverflow2",
    "twitch",
    "twitter",
  ];

  test("Test database timeout", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const graphWithTimeout = await Neo4jGraph.initialize({
      url,
      username,
      password,
      timeoutMs: 100,
    });

    const res = await graphWithTimeout.query(
      "UNWIND range(0,10000,1) AS i MERGE (f:Foo {id:i}) RETURN collect(i)[..5]"
    );
    expect(res).toEqual(undefined);
    await graphWithTimeout.close();
  });

  test("Test enhancedSchema option", async () => {
    expect(url).toBeDefined();
    expect(username).toBeDefined();
    expect(password).toBeDefined();

    const graphWithEnhancedSchema = await Neo4jGraph.initialize({
      url,
      username,
      password,
      enhancedSchema: true,
    });

    await graphWithEnhancedSchema.query("MATCH (n) DETACH DELETE n");

    await graphWithEnhancedSchema.addGraphDocuments(TEST_DATA);

    // call refresh again
    await graphWithEnhancedSchema.refreshSchema();

    const output = graphWithEnhancedSchema.getStructuredSchema();

    delete output.metadata;
    // console.log(output);
    expect(output).toEqual({
      nodeProps: {
        foo: [
          {
            property: "id",
            type: "STRING",
            values: ["foo"],
            distinct_count: "1",
          },
        ],
        bar: [
          {
            property: "id",
            type: "STRING",
            values: ["bar"],
            distinct_count: "1",
          },
        ],
      },
      relProps: {},
      relationships: [{ start: "foo", type: "REL", end: "bar" }],
    });

    await graphWithEnhancedSchema.close();
  });

  test("Test running on multiple demo databases", async () => {
    for (const database of DEMO_DATABASES) {
      // console.log("Connecting demo database:", database);

      const graphDemo = await Neo4jGraph.initialize({
        url: DEMO_URL,
        database,
        username: database,
        password: database,
        enhancedSchema: true,
      });
      await graphDemo.close();
    }

    // console.log("All database tests completed.");
  }, 10000000);
});
