import { Serializable } from "@langchain/core/load/serializable";
import { Document } from "@langchain/core/documents";

export class Node implements Serializable {
    id: string | number;
    type: string;
    properties: Record<string, any>;

    constructor(
        id: string | number,
        type: string = "Node",
        properties: Record<string, any> = {}
    ) {
        this.id = id;
        this.type = type;
        this.properties = properties;
    }
}

export class Relationship implements Serializable {
    source: Node;
    target: Node;
    type: string;
    properties: Record<string, any>;

    constructor(
        source: Node, 
        target: Node, 
        type: string, 
        properties: Record<string, any> = {}
    ) {
        this.source = source;
        this.target = target;
        this.type = type;
        this.properties = properties;
    }
}

export class GraphDocument implements Serializable {
    nodes: Node[];
    relationships: Relationship[];
    source: Document;

    constructor(
        nodes: Node[],
        relationships: Relationship[],
        source: Document
    ) {
        this.nodes = nodes;
        this.relationships = relationships;
        this.source = source;
    }
}