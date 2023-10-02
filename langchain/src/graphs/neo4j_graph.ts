import neo4j from "neo4j-driver";

interface Neo4jGraphConfig {
  url: string;
  username: string;
  password: string;
  database?: string;
}

export class Neo4jGraph {
  private driver: neo4j.Driver;

  private database: string;

  private schema = "";

  constructor({
    url,
    username,
    password,
    database = "neo4j",
  }: Neo4jGraphConfig) {
    try {
      this.driver = neo4j.driver(url, neo4j.auth.basic(username, password));
      this.database = database;
    } catch (error) {
      throw new Error(
        "Could not create a Neo4j driver instance. Please check the connection details."
      );
    }
  }

  static async initialize(config: Neo4jGraphConfig): Promise<Neo4jGraph> {
    const graph = new Neo4jGraph(config);

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
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(query, params);
      return result.records.map((record) => record.toObject());
    } finally {
      await session.close();
    }
  }

  async verifyConnectivity() {
    const session = this.driver.session({ database: this.database });
    await session.close();
  }

  async refreshSchema() {
    const nodePropertiesQuery = `
      CALL apoc.meta.data()
      YIELD label, other, elementType, type, property
      WHERE NOT type = "RELATIONSHIP" AND elementType = "node"
      WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
      RETURN {labels: nodeLabels, properties: properties} AS output
    `;

    const relPropertiesQuery = `
      CALL apoc.meta.data()
      YIELD label, other, elementType, type, property
      WHERE NOT type = "RELATIONSHIP" AND elementType = "relationship"
      WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
      RETURN {type: nodeLabels, properties: properties} AS output
    `;

    const relQuery = `
      CALL apoc.meta.data()
      YIELD label, other, elementType, type, property
      WHERE type = "RELATIONSHIP" AND elementType = "node"
      UNWIND other AS other_node
      RETURN "(:" + label + ")-[:" + property + "]->(:" + toString(other_node) + ")" AS output
    `;

    const nodeProperties = await this.query(nodePropertiesQuery);
    const relationshipsProperties = await this.query(relPropertiesQuery);
    const relationships = await this.query(relQuery);

    this.schema = `
      Node properties are the following:
      ${nodeProperties.map((el) => el.output)}

      Relationship properties are the following:
      ${relationshipsProperties.map((el) => el.output)}

      The relationships are the following:
      ${relationships.map((el) => el.output)}
    `;
  }
}
