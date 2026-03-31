import { test, expect, describe, vi, beforeEach } from "vitest";

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

describe("GraphCypherQAChain", () => {
  test("should export INTERMEDIATE_STEPS_KEY", async () => {
    const { INTERMEDIATE_STEPS_KEY } = await import("../cypher.js");
    expect(INTERMEDIATE_STEPS_KEY).toBe("intermediateSteps");
  });

  test("fromLLM should throw when no llm is provided", async () => {
    const { GraphCypherQAChain } = await import("../cypher.js");
    const { Neo4jGraph } = await import("../../../graphs/neo4j_graph.js");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    expect(() =>
      GraphCypherQAChain.fromLLM({
        graph,
      })
    ).toThrow("Either 'llm' or 'cypherLLM' parameters must be provided");
  });

  test("fromLLM should throw when all three LLMs are provided", async () => {
    const { GraphCypherQAChain } = await import("../cypher.js");
    const { Neo4jGraph } = await import("../../../graphs/neo4j_graph.js");
    const { FakeLLM } = await import("@langchain/core/utils/testing");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    const llm = new FakeLLM({});
    const cypherLLM = new FakeLLM({});
    const qaLLM = new FakeLLM({});

    expect(() =>
      GraphCypherQAChain.fromLLM({
        graph,
        llm,
        cypherLLM,
        qaLLM,
      })
    ).toThrow(
      "You can specify up to two of 'cypherLLM', 'qaLLM', and 'llm', but not all three simultaneously."
    );
  });

  test("fromLLM should create a chain with a single llm", async () => {
    const { GraphCypherQAChain } = await import("../cypher.js");
    const { Neo4jGraph } = await import("../../../graphs/neo4j_graph.js");
    const { FakeLLM } = await import("@langchain/core/utils/testing");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    const llm = new FakeLLM({});
    const chain = GraphCypherQAChain.fromLLM({ graph, llm });

    expect(chain).toBeDefined();
    expect(chain._chainType()).toBe("graph_cypher_chain");
  });

  test("should have correct input and output keys", async () => {
    const { GraphCypherQAChain } = await import("../cypher.js");
    const { Neo4jGraph } = await import("../../../graphs/neo4j_graph.js");
    const { FakeLLM } = await import("@langchain/core/utils/testing");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    const llm = new FakeLLM({});
    const chain = GraphCypherQAChain.fromLLM({ graph, llm });

    expect(chain.inputKeys).toEqual(["query"]);
    expect(chain.outputKeys).toEqual(["result"]);
  });

  test("fromLLM should create chain with separate cypher and qa LLMs", async () => {
    const { GraphCypherQAChain } = await import("../cypher.js");
    const { Neo4jGraph } = await import("../../../graphs/neo4j_graph.js");
    const { FakeLLM } = await import("@langchain/core/utils/testing");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    const cypherLLM = new FakeLLM({});
    const qaLLM = new FakeLLM({});
    const chain = GraphCypherQAChain.fromLLM({ graph, cypherLLM, qaLLM });

    expect(chain).toBeDefined();
  });

  test("fromLLM should throw when only qaLLM is provided", async () => {
    const { GraphCypherQAChain } = await import("../cypher.js");
    const { Neo4jGraph } = await import("../../../graphs/neo4j_graph.js");
    const { FakeLLM } = await import("@langchain/core/utils/testing");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    const qaLLM = new FakeLLM({});

    expect(() =>
      GraphCypherQAChain.fromLLM({ graph, qaLLM })
    ).toThrow("Either 'llm' or 'cypherLLM' parameters must be provided");
  });

  test("fromLLM should throw when only cypherLLM is provided", async () => {
    const { GraphCypherQAChain } = await import("../cypher.js");
    const { Neo4jGraph } = await import("../../../graphs/neo4j_graph.js");
    const { FakeLLM } = await import("@langchain/core/utils/testing");

    const graph = new Neo4jGraph({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    const cypherLLM = new FakeLLM({});

    expect(() =>
      GraphCypherQAChain.fromLLM({ graph, cypherLLM })
    ).toThrow("Either 'llm' or 'qaLLM' parameters must be provided");
  });
});
