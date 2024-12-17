import { createClient } from "redis";
import { Graph } from "redisgraph.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any

interface FalkorDBGraphConfig {
  url: string;
  graph?: string;
  enhancedSchema?: boolean;
}

interface StructuredSchema {
  nodeProps: { [key: string]: string[] };
  relProps: { [key: string]: string[] };
  relationships: { start: string; type: string; end: string }[];
}

export class FalkorDBGraph {
  private driver;
  private graph: Graph;
  private schema = "";
  private structuredSchema: StructuredSchema = {
    nodeProps: {},
    relProps: {},
    relationships: [],
  };
  private enhancedSchema: boolean;

  constructor({ url, graph = "falkordb", enhancedSchema = false }: FalkorDBGraphConfig) {
    try {
      this.driver = createClient({ url });
      this.graph = new Graph(graph); // Initialize the Graph instance
      this.enhancedSchema = enhancedSchema;
    } catch (error) {
      throw new Error(
        "Could not create a FalkorDB driver instance. Please check the connection details."
      );
    }
  }

  static async initialize(config: FalkorDBGraphConfig): Promise<FalkorDBGraph> {
    const graph = new FalkorDBGraph(config);
    await graph.verifyConnectivity();
    await graph.refreshSchema();
    return graph;
  }

  getSchema(): string {
    return this.schema;
  }

  getStructuredSchema(): StructuredSchema {
    return this.structuredSchema;
  }

  async query(query: string): Promise<any[]> {
    const resultSet = await this.graph.query(query); // Run the query
    const rows = [];
  
    // Iterate through the ResultSet
    while (resultSet.hasNext()) {
      const record = resultSet.next(); // Get the next record
      const keys = record.keys(); // Get column names
      const values = record.values(); // Get values
      const obj = Object.fromEntries(keys.map((key, i) => [key, values[i]])); // Map keys to values
      rows.push(obj); // Add the object to rows
    }
  
    return rows;
  }

  async verifyConnectivity(): Promise<void> {
    await this.driver.connect(); // Ensure the Redis client is connected
  }

  async refreshSchema(): Promise<void> {
    const nodePropertiesQuery = `
      MATCH (n)
      WITH keys(n) as keys, labels(n) AS labels
      UNWIND labels AS label
      UNWIND keys AS key
      WITH label, collect(DISTINCT key) AS properties
      RETURN {label: label, properties: properties} AS output
    `;

    const relPropertiesQuery = `
      MATCH ()-[r]->()
      WITH keys(r) as keys, type(r) AS type
      UNWIND keys AS key
      WITH type, collect(DISTINCT key) AS properties
      RETURN {type: type, properties: properties} AS output
    `;

    const relQuery = `
      MATCH (n)-[r]->(m)
      UNWIND labels(n) as src_label
      UNWIND labels(m) as dst_label
      RETURN DISTINCT {start: src_label, type: type(r), end: dst_label} AS output
    `;

    const nodeProperties = await this.query(nodePropertiesQuery);
    const relationshipsProperties = await this.query(relPropertiesQuery);
    const relationships = await this.query(relQuery);

    this.structuredSchema = {
      nodeProps: Object.fromEntries(
        nodeProperties.map((el: { output: { label: string; properties: string[] } }) => [el.output.label, el.output.properties])
      ),
      relProps: Object.fromEntries(
        relationshipsProperties.map((el: { output: { type: string; properties: string[] } }) => [el.output.type, el.output.properties])
      ),
      relationships: relationships.map((el: { output: { start: string; type: string; end: string } }) => el.output),
    };

    if (this.enhancedSchema) {
      this.enhanceSchemaDetails();
    }

    this.schema = this.formatSchema();
  }

  private async enhanceSchemaDetails(): Promise<void> {
    console.log("Enhanced schema details not yet implemented for FalkorDB.");
  }

  private formatSchema(): string {
    const { nodeProps, relProps, relationships } = this.structuredSchema;

    const formattedNodeProps = Object.entries(nodeProps)
      .map(([label, props]) => `${label}: {${props.join(", ")}}`)
      .join("\n");

    const formattedRelProps = Object.entries(relProps)
      .map(([type, props]) => `${type}: {${props.join(", ")}}`)
      .join("\n");

    const formattedRelationships = relationships
      .map((rel) => `(:${rel.start}) -[:${rel.type}]-> (:${rel.end})`)
      .join("\n");

    return [
      "Node properties are the following:",
      formattedNodeProps,
      "Relationship properties are the following:",
      formattedRelProps,
      "The relationships are the following:",
      formattedRelationships,
    ].join("\n");
  }

  async close(): Promise<void> {
    await this.driver.quit();
  }
}