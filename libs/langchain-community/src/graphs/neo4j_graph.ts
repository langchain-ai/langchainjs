import neo4j, { RoutingControl } from "neo4j-driver";
import { insecureHash } from "@langchain/core/utils/hash";
import { GraphDocument } from "./graph_document.js";

interface Neo4jGraphConfig {
  url: string;
  username: string;
  password: string;
  database?: string;
  timeoutMs?: number;
}

interface StructuredSchema {
  nodeProps: { [key: NodeType["labels"]]: NodeType["properties"] };
  relProps: { [key: RelType["type"]]: RelType["properties"] };
  relationships: PathType[];
  metadata?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constraint: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    index: Record<string, any>;
  };
}

export interface AddGraphDocumentsConfig {
  baseEntityLabel?: boolean;
  includeSource?: boolean;
}

export type NodeType = {
  labels: string;
  properties: { property: string; type: string }[];
};

export type RelType = {
  type: string;
  properties: { property: string; type: string }[];
};

export type PathType = { start: string; type: string; end: string };

export const BASE_ENTITY_LABEL = "__Entity__";

const INCLUDE_DOCS_QUERY = `
  MERGE (d:Document {id:$document.metadata.id}) 
  SET d.text = $document.page_content 
  SET d += $document.metadata 
  WITH d 
`;

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

  private timeoutMs: number | undefined;

  protected schema = "";

  protected structuredSchema: StructuredSchema = {
    nodeProps: {},
    relProps: {},
    relationships: [],
    metadata: {
      constraint: {},
      index: {},
    },
  };

  constructor({
    url,
    username,
    password,
    database = "neo4j",
    timeoutMs,
  }: Neo4jGraphConfig) {
    try {
      this.driver = neo4j.driver(url, neo4j.auth.basic(username, password));
      this.database = database;
      this.timeoutMs = timeoutMs;
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
  async query<RecordShape extends Record<string, any> = Record<string, any>>(
    query: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: Record<string, any> = {},
    routing: RoutingControl = neo4j.routing.WRITE
  ): Promise<RecordShape[]> {
    const result = await this.driver.executeQuery<RecordShape>(query, params, {
      database: this.database,
      routing,
      transactionConfig: { timeout: this.timeoutMs },
    });
    return toObjects<RecordShape>(result.records);
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
    const nodeProperties = (
      await this.query<{ output: NodeType }>(nodePropertiesQuery)
    )?.map((el) => el.output);

    const relationshipsProperties = (
      await this.query<{ output: RelType }>(relPropertiesQuery)
    )?.map((el) => el.output);

    const relationships: PathType[] = (
      await this.query<{ output: PathType }>(relQuery)
    )?.map((el) => el.output);

    const constraint = await this.query("SHOW CONSTRAINTS");

    const index = await this.query("SHOW INDEXES YIELD *");

    // Structured schema similar to Python's dictionary comprehension
    this.structuredSchema = {
      nodeProps: Object.fromEntries(
        nodeProperties?.map((el) => [el.labels, el.properties]) || []
      ),
      relProps: Object.fromEntries(
        relationshipsProperties?.map((el) => [el.type, el.properties]) || []
      ),
      relationships: relationships || [],
      metadata: {
        constraint,
        index,
      },
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

  async addGraphDocuments(
    graphDocuments: GraphDocument[],
    config: AddGraphDocumentsConfig = {}
  ): Promise<void> {
    const { baseEntityLabel } = config;

    if (baseEntityLabel) {
      const constraintExists =
        this.structuredSchema?.metadata?.constraint?.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (el: any) =>
            JSON.stringify(el.labelsOrTypes) ===
              JSON.stringify([BASE_ENTITY_LABEL]) &&
            JSON.stringify(el.properties) === JSON.stringify(["id"])
        ) ?? false;

      if (!constraintExists) {
        await this.query(`
          CREATE CONSTRAINT IF NOT EXISTS FOR (b:${BASE_ENTITY_LABEL})
          REQUIRE b.id IS UNIQUE;          
        `);
        await this.refreshSchema();
      }
    }

    const nodeImportQuery = getNodeImportQuery(config);
    const relImportQuery = getRelImportQuery(config);

    for (const document of graphDocuments) {
      if (!document.source.metadata.id) {
        document.source.metadata.id = insecureHash(document.source.pageContent);
      }

      // Import nodes
      await this.query(nodeImportQuery, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: document.nodes.map((el: any) => ({ ...el })),
        document: { ...document.source },
      });

      // Import relationships
      await this.query(relImportQuery, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: document.relationships.map((el: any) => ({
          source: el.source.id,
          source_label: el.source.type,
          target: el.target.id,
          target_label: el.target.type,
          type: el.type.replace(/ /g, "_").toUpperCase(),
          properties: el.properties,
        })),
      });
    }
  }

  async close() {
    await this.driver.close();
  }
}

function getNodeImportQuery({
  baseEntityLabel,
  includeSource,
}: AddGraphDocumentsConfig): string {
  if (baseEntityLabel) {
    return `
          ${includeSource ? INCLUDE_DOCS_QUERY : ""}
          UNWIND $data AS row
          MERGE (source:\`${BASE_ENTITY_LABEL}\` {id: row.id})
          SET source += row.properties
          ${includeSource ? "MERGE (d)-[:MENTIONS]->(source)" : ""}
          WITH source, row
          CALL apoc.create.addLabels(source, [row.type]) YIELD node
          RETURN distinct 'done' AS result
      `;
  } else {
    return `
          ${includeSource ? INCLUDE_DOCS_QUERY : ""}
          UNWIND $data AS row
          CALL apoc.merge.node([row.type], {id: row.id},
          row.properties, {}) YIELD node
          ${includeSource ? "MERGE (d)-[:MENTIONS]->(node)" : ""}
          RETURN distinct 'done' AS result
      `;
  }
}

function getRelImportQuery({
  baseEntityLabel,
}: AddGraphDocumentsConfig): string {
  if (baseEntityLabel) {
    return `
          UNWIND $data AS row
          MERGE (source:\`${BASE_ENTITY_LABEL}\` {id: row.source})
          MERGE (target:\`${BASE_ENTITY_LABEL}\` {id: row.target})
          WITH source, target, row
          CALL apoc.merge.relationship(source, row.type,
          {}, row.properties, target) YIELD rel
          RETURN distinct 'done'
      `;
  } else {
    return `
          UNWIND $data AS row
          CALL apoc.merge.node([row.source_label], {id: row.source},
          {}, {}) YIELD node as source
          CALL apoc.merge.node([row.target_label], {id: row.target},
          {}, {}) YIELD node as target
          CALL apoc.merge.relationship(source, row.type,
          {}, row.properties, target) YIELD rel
          RETURN distinct 'done'
      `;
  }
}

function toObjects<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordShape extends Record<string, any> = Record<string, any>
>(records: neo4j.Record<RecordShape>): RecordShape[] {
  return records.map((record) => {
    const rObj = record.toObject();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: Partial<RecordShape> = {};
    Object.keys(rObj).forEach((key: keyof RecordShape) => {
      out[key] = itemIntToString(rObj[key]);
    });
    return out as RecordShape;
  });
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
