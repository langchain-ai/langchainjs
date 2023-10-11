import { createClient, Graph } from "redis";
import { GraphStore } from "./base.js";

interface FalkorDBGraphConfig {
  url: string;
  graph?: string;
}

export class FalkorDBGraph extends GraphStore {
  private driver;

  private graph: Graph;

  private schema = "";

  constructor({ url, graph = "falkordb" }: FalkorDBGraphConfig) {
    super();
    try {
      this.driver = createClient({ url });
      this.graph = new Graph(this.driver, graph);
    } catch (error) {
      throw new Error(
        "Could not create a FalkorDB driver instance. Please check the connection details."
      );
    }
  }

  static async initialize(config: FalkorDBGraphConfig): Promise<FalkorDBGraph> {
    const graph = new FalkorDBGraph(config);

    try {
      await graph.verifyConnectivity();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.log("Failed to verify connection.");
    }

    try {
      await graph.refreshSchema();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(`Error: ${error.message}`);
    } finally {
      console.log("Schema refreshed successfully.");
    }

    return graph;
  }

  getSchema(): string {
    return this.schema;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(query: string, params: any = {}): Promise<any[]> {
    const result = await this.graph.query(query, params);
    return result.data ?? [];
  }

  async verifyConnectivity() {
    await this.driver.connect();
  }

  async refreshSchema() {
    const nodePropertiesQuery = `
      MATCH (n)
      WITH keys(n) as keys, labels(n) AS labels
      WITH CASE WHEN keys = [] THEN [NULL] ELSE keys END AS keys, labels
      UNWIND labels AS label
      UNWIND keys AS key
      WITH label, collect(DISTINCT key) AS keys
      RETURN {label:label, keys:keys} AS output
    `;

    const relPropertiesQuery = `
      MATCH ()-[r]->()
      WITH keys(r) as keys, type(r) AS types
      WITH CASE WHEN keys = [] THEN [NULL] ELSE keys END AS keys, types 
      UNWIND types AS type
      UNWIND keys AS key WITH type,
      collect(DISTINCT key) AS keys 
      RETURN {types:type, keys:keys} AS output
    `;

    const relQuery = `
      MATCH (n)-[r]->(m)
      UNWIND labels(n) as src_label
      UNWIND labels(m) as dst_label
      UNWIND type(r) as rel_type
      RETURN DISTINCT {start: src_label, type: rel_type, end: dst_label} AS output
    `;

    const nodeProperties = await this.query(nodePropertiesQuery);
    const relationshipsProperties = await this.query(relPropertiesQuery);
    const relationships = await this.query(relQuery);

    this.schema = `
      Node properties are the following: ${nodeProperties}

      Relationship properties are the following: ${relationshipsProperties}

      The relationships are the following: ${relationships}
    `;
  }
}
