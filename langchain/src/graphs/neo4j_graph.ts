import neo4j, { Neo4jError } from "neo4j-driver";

interface Neo4jGraphConfig {
  url: string;
  username: string;
  password: string;
  database?: string;
}

interface StructuredSchema {
  nodeProps: { [key: NodeType["labels"]]: NodeType["properties"] };
  relProps: { [key: RelType["type"]]: RelType["properties"] };
  relationships: PathType[];
}

type NodeType = {
  labels: string;
  properties: { property: string; type: string }[];
};
type RelType = {
  type: string;
  properties: { property: string; type: string }[];
};
type PathType = { start: string; type: string; end: string };

/**
 * @security *Security note*: Make sure that the database connection uses credentials
 * that are narrowly-scoped to only include necessary permissions.
 * Failure to do so may result in data corruption or loss, since the calling
 * code may attempt commands that would result in deletion, mutation
 * of data if appropriately prompted or reading sensitive data if such
 * data is present in the database.
 * The best way to guard against such negative outcomes is to (as appropriate)
 * limit the permissions granted to the credentials used with this tool.
 * For example, creating read only users for the database is a good way to
 * ensure that the calling code cannot mutate or delete data.
 *
 * @link See https://js.langchain.com/docs/security for more information.
 */
export class Neo4jGraph {
  private driver: neo4j.Driver;

  private database: string;

  private schema = "";

  private structuredSchema: StructuredSchema = {
    nodeProps: {},
    relProps: {},
    relationships: [],
  };

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
      const message = [
        "Could not use APOC procedures.",
        "Please ensure the APOC plugin is installed in Neo4j and that",
        "'apoc.meta.data()' is allowed in Neo4j configuration",
      ].join("\n");

      throw new Error(message);
    } finally {
      console.log("Schema refreshed successfully.");
    }

    return graph;
  }

  getSchema(): string {
    return this.schema;
  }

  getStructuredSchema() {
    return this.structuredSchema;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(query: string, params: any = {}): Promise<any[] | undefined> {
    try {
      const result = await this.driver.executeQuery(query, params, {
        database: this.database,
      });
      return toObjects(result.records);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (
        // eslint-disable-next-line
        error instanceof Neo4jError &&
        error.code === "Neo.ClientError.Procedure.ProcedureNotFound"
      ) {
        throw new Error("Procedure not found in Neo4j.");
      }
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
      RETURN {start: label, type: property, end: toString(other_node)} AS output
    `;

    // Assuming query method is defined and returns a Promise
    const nodeProperties: NodeType[] | undefined = (
      await this.query(nodePropertiesQuery)
    )?.map((el: { output: NodeType }) => el.output);

    const relationshipsProperties: RelType[] | undefined = (
      await this.query(relPropertiesQuery)
    )?.map((el: { output: RelType }) => el.output);

    const relationships: PathType[] | undefined = (
      await this.query(relQuery)
    )?.map((el: { output: PathType }) => el.output);

    // Structured schema similar to Python's dictionary comprehension
    this.structuredSchema = {
      nodeProps: Object.fromEntries(
        nodeProperties?.map((el) => [el.labels, el.properties]) || []
      ),
      relProps: Object.fromEntries(
        relationshipsProperties?.map((el) => [el.type, el.properties]) || []
      ),
      relationships: relationships || [],
    };

    // Format node properties
    const formattedNodeProps = nodeProperties?.map((el) => {
      const propsStr = el.properties
        .map((prop) => `${prop.property}: ${prop.type}`)
        .join(", ");
      return `${el.labels} {${propsStr}}`;
    });

    // Format relationship properties
    const formattedRelProps = relationshipsProperties?.map((el) => {
      const propsStr = el.properties
        .map((prop) => `${prop.property}: ${prop.type}`)
        .join(", ");
      return `${el.type} {${propsStr}}`;
    });

    // Format relationships
    const formattedRels = relationships?.map(
      (el) => `(:${el.start})-[:${el.type}]->(:${el.end})`
    );

    // Combine all formatted elements into a single string
    this.schema = [
      "Node properties are the following:",
      formattedNodeProps?.join(", "),
      "Relationship properties are the following:",
      formattedRelProps?.join(", "),
      "The relationships are the following:",
      formattedRels?.join(", "),
    ].join("\n");
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
