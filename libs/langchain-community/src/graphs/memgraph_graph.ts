import { Neo4jGraph } from "./neo4j_graph.js";

interface MemgraphGraphConfig {
  url: string;
  username: string;
  password: string;
  database?: string;
}

const rawSchemaQuery = `
CALL llm_util.schema("raw")
YIELD *
RETURN *
`;

/**
 * **Security note**: Make sure that the database connection uses credentials
 * that are narrowly-scoped to only include necessary permissions.
 *
 * Failure to do so may result in data corruption or loss, since the calling
 * code may attempt commands that would result in deletion, mutation of data
 * if appropriately prompted, or reading sensitive data if such data is present
 * in the database.
 *
 * The best way to guard against such negative outcomes is to (as appropriate)
 * limit the permissions granted to the credentials used with this tool.
 * For example, creating read only users for the database is a good way to
 * ensure that the calling code cannot mutate or delete data.
 *
 * @see https://js.langchain.com/docs/security
 */
class MemgraphGraph extends Neo4jGraph {
  constructor({
    url,
    username,
    password,
    database = "memgraph",
  }: MemgraphGraphConfig) {
    super({ url, username, password, database });
  }

  static async initialize(config: MemgraphGraphConfig): Promise<MemgraphGraph> {
    const graph = new MemgraphGraph(config);

    try {
      await graph.verifyConnectivity();
    } catch {
      console.error("Failed to verify connection.");
    }

    try {
      await graph.refreshSchema();
      console.debug("Schema refreshed successfully.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(error.message);
    }

    return graph;
  }

  async refreshSchema() {
    const rawSchemaQueryResult = await this.query(rawSchemaQuery);
    if (rawSchemaQueryResult?.[0]?.schema) {
      const rawSchema = rawSchemaQueryResult?.[0]?.schema;

      this.structuredSchema = {
        nodeProps: rawSchema.node_props,
        relProps: rawSchema.rel_props,
        relationships: rawSchema.relationships,
      };

      // Format node properties
      const formattedNodeProps = Object.entries(rawSchema.node_props)
        .map(([nodeName, properties]) => {
          const propertiesStr = JSON.stringify(properties);
          return `Node name: '${nodeName}', Node properties: ${propertiesStr}`;
        })
        .join("\n");

      // Format relationship properties
      const formattedRelProps = Object.entries(rawSchema.rel_props)
        .map(([relationshipName, properties]) => {
          const propertiesStr = JSON.stringify(properties);
          return `Relationship name: '${relationshipName}', Relationship properties: ${propertiesStr}`;
        })
        .join("\n");

      // Format relationships
      const formattedRels = rawSchema.relationships
        ?.map(
          (el: { end: string; start: string; type: string }) =>
            `(:${el.start})-[:${el.type}]->(:${el.end})`
        )
        .join("\n");

      // Combine all formatted elements into a single string
      this.schema = [
        "Node properties are the following:",
        formattedNodeProps,
        "Relationship properties are the following:",
        formattedRelProps,
        "The relationships are the following:",
        formattedRels,
      ].join("\n");
    }
  }
}

export { MemgraphGraph };
