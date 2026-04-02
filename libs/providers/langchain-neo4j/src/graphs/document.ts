import { Serializable } from "@langchain/core/load/serializable";
import { Document } from "@langchain/core/documents";

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export class Node extends Serializable {
  id: string | number;

  type: string;

  properties: Record<string, Any>;

  lc_namespace = ["langchain", "graph", "document_node"];

  constructor({
    id,
    type = "Node",
    properties = {},
  }: {
    id: string | number;
    type: string;
    properties?: Record<string, Any>;
  }) {
    super();
    this.id = id;
    this.type = type;
    this.properties = properties;
  }
}

export class Relationship extends Serializable {
  source: Node;

  target: Node;

  type: string;

  properties: Record<string, Any>;

  lc_namespace = ["langchain", "graph", "document_relationship"];

  constructor({
    source,
    target,
    type,
    properties = {},
  }: {
    source: Node;
    target: Node;
    type: string;
    properties?: Record<string, Any>;
  }) {
    super();
    this.source = source;
    this.target = target;
    this.type = type;
    this.properties = properties;
  }
}

export class GraphDocument extends Serializable {
  nodes: Node[];

  relationships: Relationship[];

  source: Document;

  lc_namespace = ["langchain", "graph", "graph_document"];

  constructor({
    nodes,
    relationships,
    source,
  }: {
    nodes: Node[];
    relationships: Relationship[];
    source: Document;
  }) {
    super({
      nodes,
      relationships,
      source,
    });
    this.nodes = nodes;
    this.relationships = relationships;
    this.source = source;
  }
}
