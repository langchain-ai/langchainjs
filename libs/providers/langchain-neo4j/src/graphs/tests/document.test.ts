import { test, expect, describe } from "vitest";
import { Document } from "@langchain/core/documents";
import { Node, Relationship, GraphDocument } from "../document.js";

describe("Node", () => {
  test("should create a node with required fields", () => {
    const node = new Node({ id: "1", type: "Person" });
    expect(node.id).toBe("1");
    expect(node.type).toBe("Person");
    expect(node.properties).toEqual({});
  });

  test("should create a node with properties", () => {
    const node = new Node({
      id: 42,
      type: "Person",
      properties: { name: "Alice", age: 30 },
    });
    expect(node.id).toBe(42);
    expect(node.type).toBe("Person");
    expect(node.properties).toEqual({ name: "Alice", age: 30 });
  });

  test("should accept numeric ids", () => {
    const node = new Node({ id: 123, type: "Item" });
    expect(node.id).toBe(123);
  });

  test("should have correct lc_namespace", () => {
    const node = new Node({ id: "1", type: "Test" });
    expect(node.lc_namespace).toEqual(["langchain", "graph", "document_node"]);
  });
});

describe("Relationship", () => {
  test("should create a relationship between two nodes", () => {
    const source = new Node({ id: "1", type: "Person" });
    const target = new Node({ id: "2", type: "Company" });
    const rel = new Relationship({
      source,
      target,
      type: "WORKS_AT",
    });
    expect(rel.source).toBe(source);
    expect(rel.target).toBe(target);
    expect(rel.type).toBe("WORKS_AT");
    expect(rel.properties).toEqual({});
  });

  test("should create a relationship with properties", () => {
    const source = new Node({ id: "1", type: "Person" });
    const target = new Node({ id: "2", type: "Company" });
    const rel = new Relationship({
      source,
      target,
      type: "WORKS_AT",
      properties: { since: "2020", role: "Engineer" },
    });
    expect(rel.properties).toEqual({ since: "2020", role: "Engineer" });
  });

  test("should have correct lc_namespace", () => {
    const source = new Node({ id: "1", type: "A" });
    const target = new Node({ id: "2", type: "B" });
    const rel = new Relationship({ source, target, type: "REL" });
    expect(rel.lc_namespace).toEqual([
      "langchain",
      "graph",
      "document_relationship",
    ]);
  });
});

describe("GraphDocument", () => {
  test("should create a graph document from nodes and relationships", () => {
    const node1 = new Node({ id: "1", type: "Person" });
    const node2 = new Node({ id: "2", type: "Company" });
    const rel = new Relationship({
      source: node1,
      target: node2,
      type: "WORKS_AT",
    });
    const source = new Document({
      pageContent: "Alice works at Acme Corp.",
      metadata: { id: "doc1" },
    });

    const graphDoc = new GraphDocument({
      nodes: [node1, node2],
      relationships: [rel],
      source,
    });

    expect(graphDoc.nodes).toHaveLength(2);
    expect(graphDoc.relationships).toHaveLength(1);
    expect(graphDoc.source.pageContent).toBe("Alice works at Acme Corp.");
  });

  test("should handle empty nodes and relationships", () => {
    const source = new Document({
      pageContent: "Empty document",
      metadata: {},
    });

    const graphDoc = new GraphDocument({
      nodes: [],
      relationships: [],
      source,
    });

    expect(graphDoc.nodes).toHaveLength(0);
    expect(graphDoc.relationships).toHaveLength(0);
  });

  test("should have correct lc_namespace", () => {
    const graphDoc = new GraphDocument({
      nodes: [],
      relationships: [],
      source: new Document({ pageContent: "", metadata: {} }),
    });
    expect(graphDoc.lc_namespace).toEqual([
      "langchain",
      "graph",
      "graph_document",
    ]);
  });
});
