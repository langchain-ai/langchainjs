import neo4j from "neo4j-driver";
import { GraphStore } from "./base.js";

interface Neo4jGraphConfig {
  url: string;
  username: string;
  password: string;
  database?: string;
}

export class Neo4jGraph extends GraphStore {
  private driver: neo4j.Driver;

  private database: string;

  private schema = "";

  constructor({
    url,
    username,
    password,
    database = "neo4j",
  }: Neo4jGraphConfig) {
    super();
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
  async query(query: string, params: any = {}): Promise<any[] | undefined> {
    try {
      const result = await this.driver.executeQuery(query, params, {
        database: this.database,
      });
      return toObjects(result.records);
    } catch (error) {
      // ignore errors
    }
    return undefined;
  }

  async verifyConnectivity() {
    await this.driver.verifyAuthentication();
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
      ${JSON.stringify(nodeProperties?.map((el) => el.output))}

      Relationship properties are the following:
      ${JSON.stringify(relationshipsProperties?.map((el) => el.output))}

      The relationships are the following:
      ${JSON.stringify(relationships?.map((el) => el.output))}
    `;
  }

  async close() {
    await this.driver.close();
  }
}

function toObjects(records: neo4j.Record[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordValues: Record<string, any>[] = records.map((record) => {
    const rObj = record.toObject();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: { [key: string]: any } = {};
    Object.keys(rObj).forEach((key) => {
      out[key] = itemIntToString(rObj[key]);
    });
    return out;
  });
  return recordValues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemIntToString(item: any): any {
  if (neo4j.isInt(item)) return item.toString();
  if (Array.isArray(item)) return item.map((ii) => itemIntToString(ii));
  if (["number", "string", "boolean"].indexOf(typeof item) !== -1) return item;
  if (item === null) return item;
  if (typeof item === "object") return objIntToString(item);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function objIntToString(obj: any) {
  const entry = extractFromNeoObjects(obj);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newObj: any = null;
  if (Array.isArray(entry)) {
    newObj = entry.map((item) => itemIntToString(item));
  } else if (entry !== null && typeof entry === "object") {
    newObj = {};
    Object.keys(entry).forEach((key) => {
      newObj[key] = itemIntToString(entry[key]);
    });
  }
  return newObj;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromNeoObjects(obj: any) {
  if (
    // eslint-disable-next-line
    obj instanceof (neo4j.types.Node as any) ||
    // eslint-disable-next-line
    obj instanceof (neo4j.types.Relationship as any)
  ) {
    return obj.properties;
    // eslint-disable-next-line
  } else if (obj instanceof (neo4j.types.Path as any)) {
    // eslint-disable-next-line
    return [].concat.apply<any[], any[], any[]>([], extractPathForRows(obj));
  }
  return obj;
}

const extractPathForRows = (path: neo4j.Path) => {
  let { segments } = path;
  // Zero length path. No relationship, end === start
  if (!Array.isArray(path.segments) || path.segments.length < 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    segments = [{ ...path, end: null } as any];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return segments.map((segment: any) =>
    [
      objIntToString(segment.start),
      objIntToString(segment.relationship),
      objIntToString(segment.end),
    ].filter((part) => part !== null)
  );
};
