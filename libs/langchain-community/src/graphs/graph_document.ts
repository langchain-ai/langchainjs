import { Serializable } from "@langchain/core/load/serializable";
import { Document } from "@langchain/core/documents";

export class Node extends Serializable {
  id: string | number;

  type: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;

  lc_namespace = ["langchain", "graph", "document_node"];

  constructor(
    id: string | number,
    type = "Node",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any> = {}
  ) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;

  lc_namespace = ["langchain", "graph", "document_relationship"];

  constructor(
    source: Node,
    target: Node,
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any> = {}
  ) {
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

  lc_namespace = ["langchain", "graph", "document_node"];

  constructor(nodes: Node[], relationships: Relationship[], source: Document) {
    super();
    this.nodes = nodes;
    this.relationships = relationships;
    this.source = source;
  }
}
