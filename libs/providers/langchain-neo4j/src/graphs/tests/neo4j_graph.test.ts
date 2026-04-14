import { test, expect, describe, vi, beforeEach } from "vitest";
import { formatSchema } from "../neo4j_graph.js";

vi.mock("neo4j-driver", () => {
  const mockAuth = {
    basic: vi.fn().mockReturnValue({ scheme: "basic" }),
  };

  const mockDriver = {
    getServerInfo: vi.fn().mockResolvedValue({}),
    executeQuery: vi.fn().mockResolvedValue({ records: [] }),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockRouting = {
    WRITE: "WRITE",
    READ: "READ",
  };

  return {
    default: {
      driver: vi.fn().mockReturnValue(mockDriver),
      auth: mockAuth,
      routing: mockRouting,
      isInt: vi.fn().mockReturnValue(false),
      types: {
        Node: class MockNode {},
        Relationship: class MockRelationship {},
        Path: class MockPath {},
      },
    },
    RoutingControl: {},
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Neo4jGraph", () => {
  test("should construct with valid config", async () => {
    const { Neo4jGraph } = await import("../neo4j_graph.js");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    expect(graph).toBeDefined();
    expect(graph.getSchema()).toBe("");
    expect(graph.getStructuredSchema()).toEqual({
      nodeProps: {},
      relProps: {},
      relationships: [],
      metadata: {
        constraint: {},
        index: {},
      },
    });
  });

  test("should use default database", async () => {
    const { Neo4jGraph } = await import("../neo4j_graph.js");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    expect(graph).toBeDefined();
  });

  test("should accept custom database", async () => {
    const { Neo4jGraph } = await import("../neo4j_graph.js");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
      database: "mydb",
    });

    expect(graph).toBeDefined();
  });

  test("should close the driver", async () => {
    const { Neo4jGraph } = await import("../neo4j_graph.js");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    await graph.close();
  });

  test("should expose BASE_ENTITY_LABEL", async () => {
    const { BASE_ENTITY_LABEL } = await import("../neo4j_graph.js");
    expect(BASE_ENTITY_LABEL).toBe("__Entity__");
  });
});

describe("formatSchema", () => {
  test("should format basic schema", () => {
    const schema = {
      nodeProps: {
        Person: [
          { property: "name", type: "STRING" },
          { property: "age", type: "INTEGER" },
        ],
      },
      relProps: {
        KNOWS: [{ property: "since", type: "DATE" }],
      },
      relationships: [{ start: "Person", type: "KNOWS", end: "Person" }],
    };

    const result = formatSchema(schema, false);

    expect(result).toContain("Node properties are the following:");
    expect(result).toContain("Person {name: STRING, age: INTEGER}");
    expect(result).toContain("Relationship properties are the following:");
    expect(result).toContain("KNOWS {since: DATE");
    expect(result).toContain("The relationships are the following:");
    expect(result).toContain("(: Person) - [: KNOWS] -> (:Person)");
  });

  test("should format enhanced schema with string values", () => {
    const schema = {
      nodeProps: {
        Person: [
          {
            property: "name",
            type: "STRING",
            values: ["Alice", "Bob"],
            distinct_count: 2,
          },
        ],
      },
      relProps: {},
      relationships: [],
    };

    const result = formatSchema(schema, true);

    expect(result).toContain("- **Person**");
    expect(result).toContain("`name`: STRING Available options: Alice, Bob");
  });

  test("should format enhanced schema with high cardinality string", () => {
    const schema = {
      nodeProps: {
        Person: [
          {
            property: "name",
            type: "STRING",
            values: ["Alice"],
            distinct_count: 100,
          },
        ],
      },
      relProps: {},
      relationships: [],
    };

    const result = formatSchema(schema, true);

    expect(result).toContain("`name`: STRING Example: Alice");
  });

  test("should format enhanced schema with numeric min/max", () => {
    const schema = {
      nodeProps: {
        Person: [
          {
            property: "age",
            type: "INTEGER",
            min: 1,
            max: 99,
          },
        ],
      },
      relProps: {},
      relationships: [],
    };

    const result = formatSchema(schema, true);

    expect(result).toContain("`age`: INTEGER Min: 1, Max: 99");
  });

  test("should handle empty schema", () => {
    const schema = {
      nodeProps: {},
      relProps: {},
      relationships: [],
    };

    const result = formatSchema(schema, false);

    expect(result).toContain("Node properties are the following:");
    expect(result).toContain("Relationship properties are the following:");
    expect(result).toContain("The relationships are the following:");
  });

  test("should format LIST type in enhanced schema", () => {
    const schema = {
      nodeProps: {
        Person: [
          {
            property: "tags",
            type: "LIST",
            min_size: 1,
            max_size: 10,
          },
        ],
      },
      relProps: {},
      relationships: [],
    };

    const result = formatSchema(schema, true);

    expect(result).toContain("`tags`: LIST Min Size: 1, Max Size: 10");
  });

  test("should skip LIST with large min_size in enhanced schema", () => {
    const schema = {
      nodeProps: {
        Person: [
          {
            property: "embedding",
            type: "LIST",
            min_size: 1536,
            max_size: 1536,
          },
        ],
      },
      relProps: {},
      relationships: [],
    };

    const result = formatSchema(schema, true);

    expect(result).not.toContain("`embedding`");
  });

  test("should format multiple node types", () => {
    const schema = {
      nodeProps: {
        Person: [{ property: "name", type: "STRING" }],
        Company: [{ property: "founded", type: "INTEGER" }],
      },
      relProps: {},
      relationships: [{ start: "Person", type: "WORKS_AT", end: "Company" }],
    };

    const result = formatSchema(schema, false);

    expect(result).toContain("Person {name: STRING}");
    expect(result).toContain("Company {founded: INTEGER}");
    expect(result).toContain("(: Person) - [: WORKS_AT] -> (:Company)");
  });
});
