import { FalkorDB, Graph } from "falkordb";
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
  private driver: FalkorDB;

  private graph: Graph;

  private schema = "";

  private structuredSchema: StructuredSchema = {
    nodeProps: {},
    relProps: {},
    relationships: [],
  };

  private enhancedSchema: boolean;

  constructor({ enhancedSchema = false }: FalkorDBGraphConfig) {
    try {
      this.enhancedSchema = enhancedSchema;
    } catch (error) {
      console.error("Error in FalkorDBGraph constructor:", error);
      throw new Error("Failed to initialize FalkorDBGraph.");
    }
  }

  static async initialize(config: FalkorDBGraphConfig): Promise<FalkorDBGraph> {
    const graph = new FalkorDBGraph(config);
    const driver = await FalkorDB.connect({
      socket: {
        host: new URL(config.url).hostname,
        port: parseInt(new URL(config.url).port, 10),
      },
    });
    graph.driver = driver; 
    await graph.verifyConnectivity();
    
    return graph;
  }
  

  getSchema(): string {
    return this.schema;
  }

  getStructuredSchema(): StructuredSchema {
    return this.structuredSchema;
  }

  async selectGraph(graphName: string): Promise<void> {
    this.graph = await this.driver.selectGraph(graphName);
  }

  async query(query: string): Promise<any> {
    return await this.graph.query(query);
  }

  async verifyConnectivity(): Promise<void> {
    await this.driver.info()
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

    const nodePropertiesResult = await this.query(nodePropertiesQuery);
  const relationshipsPropertiesResult = await this.query(relPropertiesQuery);
  const relationshipsResult = await this.query(relQuery);

  const nodeProperties = nodePropertiesResult.data || [];
  const relationshipsProperties = relationshipsPropertiesResult.data || [];
  const relationships = relationshipsResult.data || [];

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
    await this.enhanceSchemaDetails();
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
    await this.driver.close();
  }
}