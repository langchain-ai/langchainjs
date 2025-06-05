import neo4j, {
  RoutingControl,
  type Driver as Neo4jDriver,
  type Record as Neo4jRecord,
  type Path as Neo4jPath,
} from "neo4j-driver";
import { insecureHash } from "@langchain/core/utils/hash";
import { GraphDocument } from "./document.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

interface Neo4jGraphConfig {
  url: string;
  username: string;
  password: string;
  database?: string;
  timeoutMs?: number;
  enhancedSchema?: boolean;
}

interface StructuredSchema {
  nodeProps: { [key: NodeType["labels"]]: NodeType["properties"] };
  relProps: { [key: RelType["type"]]: RelType["properties"] };
  relationships: PathType[];
  metadata?: {
    constraint: Record<string, Any>;
    index: Record<string, Any>;
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

const DISTINCT_VALUE_LIMIT = 10;
const LIST_LIMIT = 128;
const EXHAUSTIVE_SEARCH_LIMIT = 10000;
const EXCLUDED_LABELS = ["Bloom_Perspective", "Bloom_Scene"];
const EXCLUDED_RELS = ["Bloom_HAS_SCENE"];

const INCLUDE_DOCS_QUERY = `
MERGE (d:Document {id:$document.metadata.id})
SET d.text = $document.pageContent
SET d += $document.metadata
WITH d
`;

const NODE_PROPERTIES_QUERY = `
CALL apoc.meta.data()
YIELD label, other, elementType, type, property
WHERE NOT type = "RELATIONSHIP" AND elementType = "node"
  AND NOT label IN $EXCLUDED_LABELS
WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
RETURN {labels: nodeLabels, properties: properties} AS output
`;

const REL_PROPERTIES_QUERY = `
CALL apoc.meta.data()
YIELD label, other, elementType, type, property
WHERE NOT type = "RELATIONSHIP" AND elementType = "relationship"
      AND NOT label in $EXCLUDED_LABELS
WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
RETURN {type: nodeLabels, properties: properties} AS output
`;

const REL_QUERY = `
CALL apoc.meta.data()
YIELD label, other, elementType, type, property
WHERE type = "RELATIONSHIP" AND elementType = "node"
UNWIND other AS other_node
WITH * WHERE NOT label IN $EXCLUDED_LABELS
    AND NOT other_node IN $EXCLUDED_LABELS
RETURN {start: label, type: property, end: toString(other_node)} AS output
`;

function isDistinctMoreThanLimit(
  distinct_count = 11,
  limit = DISTINCT_VALUE_LIMIT
): boolean {
  return distinct_count !== undefined && distinct_count > limit;
}

function cleanStringValues(text: string) {
  return text.replace("\n", " ").replace("\r", " ");
}

function formatSchema(
  schema: Record<string, Any>,
  isEnhanced: boolean
): string {
  let formattedNodeProps: string[] = [];
  let formattedRelProps: string[] = [];

  if (isEnhanced) {
    // Enhanced formatting for nodes
    for (const [nodeType, properties] of Object.entries(schema.nodeProps)) {
      formattedNodeProps.push(`- **${nodeType}**`);

      for (const prop of properties as Array<Record<string, Any>>) {
        let example = "";

        if (prop.type === "STRING") {
          if (prop.values.length > 0) {
            if (isDistinctMoreThanLimit(prop.distinct_count)) {
              example = `Example: ${cleanStringValues(prop.values[0])}`;
            } else {
              example = `Available options: ${prop.values
                .map(cleanStringValues)
                .join(", ")}`;
            }
          }
        } else if (
          ["INTEGER", "FLOAT", "DATE", "DATE_TIME", "LOCAL_DATE_TIME"].includes(
            prop.type
          )
        ) {
          if (prop.min !== undefined) {
            example = `Min: ${prop.min}, Max: ${prop.max}`;
          } else {
            if (prop.values.length > 0) {
              example = `Example: ${prop.values[0]}`;
            }
          }
        } else if (prop.type === "LIST") {
          if (!prop.min_size || prop.min_size > LIST_LIMIT) {
            continue;
          }
          example = `Min Size: ${prop.min_size}, Max Size: ${prop.max_size}`;
        }

        formattedNodeProps.push(
          `  - \`${prop.property}\`: ${prop.type} ${example}`
        );
      }
    }

    // Enhanced formatting for relationships
    for (const [relType, properties] of Object.entries(schema.relProps)) {
      formattedRelProps.push(`- **${relType}**`);

      for (const prop of properties as Array<Record<string, Any>>) {
        let example = "";

        if (prop.type === "STRING") {
          if (prop.values.length > 0) {
            if (isDistinctMoreThanLimit(prop.distinct_count)) {
              example = `Example: ${cleanStringValues(prop.values[0])}`;
            } else {
              example = `Available options: ${prop.values
                .map(cleanStringValues)
                .join(", ")}`;
            }
          }
        } else if (
          ["INTEGER", "FLOAT", "DATE", "DATE_TIME", "LOCAL_DATE_TIME"].includes(
            prop.type
          )
        ) {
          if (prop.min) {
            example = `Min: ${prop.min}, Max: ${prop.max}`;
          } else {
            if (prop.values) {
              example = `Example: ${prop.values[0]}`;
            }
          }
        } else if (prop.type === "LIST") {
          if (prop.min_size > LIST_LIMIT) {
            continue;
          }
          example = `Min Size: ${prop.min_size}, Max Size: ${prop.max_size}`;
        }

        formattedRelProps.push(
          `  - \`${prop.property}\`: ${prop.type} ${example}`
        );
      }
    }
  } else {
    // Format node properties
    formattedNodeProps = Object.entries(schema.nodeProps).map(
      ([key, value]: [string, Any]) => {
        const propsStr = value
          .map((prop: Record<string, Any>) => `${prop.property}: ${prop.type}`)
          .join(", ");
        return `${key} {${propsStr}}`;
      }
    );

    // Format relationship properties
    formattedRelProps = Object.entries(schema.relProps).map(
      ([key, value]: [string, Any]) => {
        const propsStr = value
          .map((prop: Record<string, Any>) => `${prop.property}: ${prop.type} `)
          .join(", ");
        return `${key} {${propsStr} } `;
      }
    );
  }

  // Format relationships
  const formattedRels = schema.relationships.map(
    (el: Record<string, string>) =>
      `(: ${el.start}) - [: ${el.type}] -> (:${el.end})`
  );

  return [
    "Node properties are the following:",
    formattedNodeProps?.join(", "),
    "Relationship properties are the following:",
    formattedRelProps?.join(", "),
    "The relationships are the following:",
    formattedRels?.join(", "),
  ].join("\n");
}

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
  private driver: Neo4jDriver;

  private database: string;

  private timeoutMs: number | undefined;

  private enhancedSchema: boolean;

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
    enhancedSchema = false,
  }: Neo4jGraphConfig) {
    try {
      this.driver = neo4j.driver(url, neo4j.auth.basic(username, password));
      this.database = database;
      this.timeoutMs = timeoutMs;
      this.enhancedSchema = enhancedSchema;
    } catch (error) {
      throw new Error(
        "Could not create a Neo4j driver instance. Please check the connection details."
      );
    }
  }

  static async initialize(config: Neo4jGraphConfig): Promise<Neo4jGraph> {
    const graph = new Neo4jGraph(config);

    await graph.verifyConnectivity();

    try {
      await graph.refreshSchema();
    } catch (error: Any) {
      if (error.code === "Neo.ClientError.Procedure.ProcedureNotFound") {
        throw new Error(
          "Could not use APOC procedures. Please ensure the APOC plugin is installed in Neo4j and that 'apoc.meta.data()' is allowed in Neo4j configuration."
        );
      }

      throw error;
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

  async query<RecordShape extends Record<string, Any> = Record<string, Any>>(
    query: string,
    params: Record<string, Any> = {},
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
    await this.driver.getServerInfo();
  }

  async refreshSchema() {
    // Assuming query method is defined and returns a Promise
    const nodeProperties = (
      await this.query<{ output: NodeType }>(NODE_PROPERTIES_QUERY, {
        EXCLUDED_LABELS: EXCLUDED_LABELS.concat([BASE_ENTITY_LABEL]),
      })
    )?.map((el) => el.output);

    const relationshipsProperties = (
      await this.query<{ output: RelType }>(REL_PROPERTIES_QUERY, {
        EXCLUDED_LABELS: EXCLUDED_RELS,
      })
    )?.map((el) => el.output);

    const relationships: PathType[] = (
      await this.query<{ output: PathType }>(REL_QUERY, {
        EXCLUDED_LABELS: EXCLUDED_LABELS.concat([BASE_ENTITY_LABEL]),
      })
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

    if (this.enhancedSchema) {
      const schemaCounts = await this.query(
        `CALL apoc.meta.graphSample() YIELD nodes, relationships ` +
          `RETURN nodes, [rel in relationships | {name: apoc.any.property(rel, 'type'), count: apoc.any.property(rel, 'count')}] AS relationships`
      );
      // Update node info
      for (const node of schemaCounts[0].nodes) {
        // Skip bloom labels
        if (EXCLUDED_LABELS.includes(node.name)) {
          continue;
        }

        const nodeProps = this.structuredSchema.nodeProps[node.name];

        if (!nodeProps) {
          // The node has no properties
          continue;
        }

        const enhancedCypher = await this.enhancedSchemaCypher(
          node.name,
          nodeProps,
          node.count < EXHAUSTIVE_SEARCH_LIMIT
        );
        const enhancedInfoPromise = await this.query(enhancedCypher);
        const enhancedInfo = enhancedInfoPromise[0].output;

        for (const prop of nodeProps) {
          if (enhancedInfo[prop.property]) {
            Object.assign(prop, enhancedInfo[prop.property]);
          }
        }
      }

      // Update rel info
      for (const rel of schemaCounts[0].relationships) {
        // Skip bloom labels
        if (EXCLUDED_RELS.includes(rel.name)) {
          continue;
        }
        const relProps = this.structuredSchema.relProps[rel.name];

        if (!relProps) {
          // The rel has no properties
          continue;
        }
        const enhancedCypher = await this.enhancedSchemaCypher(
          rel.name,
          relProps,
          rel.count < EXHAUSTIVE_SEARCH_LIMIT,
          true
        );

        const enhancedInfoPromise = await this.query(enhancedCypher);
        const enhancedInfo = enhancedInfoPromise[0].output;

        for (const prop of relProps) {
          if (prop.property in enhancedInfo) {
            Object.assign(prop, enhancedInfo[prop.property]);
          }
        }
      }
    }

    // Combine all formatted elements into a single string
    this.schema = formatSchema(this.structuredSchema, this.enhancedSchema);
  }

  async enhancedSchemaCypher(
    labelOrType: string,
    properties: { property: string; type: string }[],
    exhaustive: boolean,
    isRelationship = false
  ) {
    let matchClause = isRelationship
      ? `MATCH ()-[n:\`${labelOrType}\`]->()`
      : `MATCH (n:\`${labelOrType}\`)`;

    const withClauses: string[] = [];
    const returnClauses: string[] = [];
    const outputDict: { [key: string]: string } = {};

    if (exhaustive) {
      for (const prop of properties) {
        const propName = prop.property;
        const propType = prop.type;

        if (propType === "STRING") {
          withClauses.push(
            `collect(distinct substring(n.\`${propName}\`, 0, 50)) AS \`${propName}_values\``
          );
          returnClauses.push(
            `values: \`${propName}_values\`[..${DISTINCT_VALUE_LIMIT}], distinct_count: size(\`${propName}_values\`)`
          );
        } else if (
          ["INTEGER", "FLOAT", "DATE", "DATE_TIME", "LOCAL_DATE_TIME"].includes(
            propType
          )
        ) {
          withClauses.push(`min(n.\`${propName}\`) AS \`${propName}_min\``);
          withClauses.push(`max(n.\`${propName}\`) AS \`${propName}_max\``);
          withClauses.push(
            `count(distinct n.\`${propName}\`) AS \`${propName}_distinct\``
          );
          returnClauses.push(
            `min: toString(\`${propName}_min\`), max: toString(\`${propName}_max\`), distinct_count: \`${propName}_distinct\``
          );
        } else if (propType === "LIST") {
          withClauses.push(
            `min(size(n.\`${propName}\`)) AS \`${propName}_size_min\`, max(size(n.\`${propName}\`)) AS \`${propName}_size_max\``
          );
          returnClauses.push(
            `min_size: \`${propName}_size_min\`, max_size: \`${propName}_size_max\``
          );
        } else if (["BOOLEAN", "POINT", "DURATION"].includes(propType)) {
          continue;
        }
        outputDict[propName] = `{${returnClauses.pop()}}`;
      }
    } else {
      matchClause += ` WITH n LIMIT 5`;

      for (const prop of properties) {
        const propName = prop.property;
        const propType = prop.type;

        const propIndex = this.structuredSchema?.metadata?.index.filter(
          (el: Any) =>
            el.label === labelOrType &&
            el.properties[0] === propName &&
            el.type === "RANGE"
        );

        if (propType === "STRING") {
          if (
            propIndex.length > 0 &&
            propIndex[0].size > 0 &&
            propIndex[0].distinctValues <= DISTINCT_VALUE_LIMIT
          ) {
            const distinctValuesPromise = await this.query(
              `CALL apoc.schema.properties.distinct('${labelOrType}', '${propName}') YIELD value`
            );
            const distinctValues = distinctValuesPromise[0].value;
            returnClauses.push(
              `values: ${distinctValues}, distinct_count: ${distinctValues.length}`
            );
          } else {
            withClauses.push(
              `collect(distinct substring(n.\`${propName}\`, 0, 50)) AS \`${propName}_values\``
            );
            returnClauses.push(`values: ${propName}_values`);
          }
        } else if (
          ["INTEGER", "FLOAT", "DATE", "DATE_TIME", "LOCAL_DATE_TIME"].includes(
            propType
          )
        ) {
          if (!propIndex) {
            withClauses.push(
              `collect(distinct toString(n.\`${propName}\`)) AS \`${propName}_values\``
            );
            returnClauses.push(`values: ${propName}_values`);
          } else {
            withClauses.push(`min(n.\`${propName}\`) AS \`${propName}_min\``);
            withClauses.push(`max(n.\`${propName}\`) AS \`${propName}_max\``);
            withClauses.push(
              `count(distinct n.\`${propName}\`) AS \`${propName}_distinct\``
            );
            returnClauses.push(
              `min: toString(\`${propName}_min\`), max: toString(\`${propName}_max\`), distinct_count: \`${propName}_distinct\``
            );
          }
        } else if (propType === "LIST") {
          withClauses.push(
            `min(size(n.\`${propName}\`)) AS \`${propName}_size_min\`, max(size(n.\`${propName}\`)) AS \`${propName}_size_max\``
          );
          returnClauses.push(
            `min_size: \`${propName}_size_min\`, max_size: \`${propName}_size_max\``
          );
        } else if (["BOOLEAN", "POINT", "DURATION"].includes(propType)) {
          continue;
        }

        outputDict[propName] = `{${returnClauses.pop()}}`;
      }
    }

    const withClause = `WITH ${withClauses.join(", ")}`;
    const returnClause = `RETURN {${Object.entries(outputDict)
      .map(([k, v]) => `\`${k}\`: ${v}`)
      .join(", ")}} AS output`;

    const cypherQuery = [matchClause, withClause, returnClause].join("\n");

    return cypherQuery;
  }

  async addGraphDocuments(
    graphDocuments: GraphDocument[],
    config: AddGraphDocumentsConfig = {}
  ): Promise<void> {
    const { baseEntityLabel } = config;

    if (baseEntityLabel) {
      const constraintExists =
        this.structuredSchema?.metadata?.constraint?.some(
          (el: Any) =>
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
        data: document.nodes.map((el: Any) => ({ ...el })),
        document: { ...document.source },
      });

      // Import relationships
      await this.query(relImportQuery, {
        data: document.relationships.map((el: Any) => ({
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
              MERGE(source: \`${BASE_ENTITY_LABEL}\` {id: row.id})
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
  RecordShape extends Record<string, Any> = Record<string, Any>
>(records: Neo4jRecord<RecordShape>): RecordShape[] {
  return records.map((record: Any) => {
    const rObj = record.toObject();
    const out: Partial<RecordShape> = {};
    Object.keys(rObj).forEach((key: keyof RecordShape) => {
      out[key] = itemIntToString(rObj[key]);
    });
    return out as RecordShape;
  });
}

function itemIntToString(item: Any): Any {
  if (neo4j.isInt(item)) return item.toString();
  if (Array.isArray(item)) return item.map((ii) => itemIntToString(ii));
  if (["number", "string", "boolean"].indexOf(typeof item) !== -1) return item;
  if (item === null) return item;
  if (typeof item === "object") return objIntToString(item);
}

function objIntToString(obj: Any) {
  const entry = extractFromNeoObjects(obj);
  let newObj: Any = null;
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

function extractFromNeoObjects(obj: Any) {
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

const extractPathForRows = (path: Neo4jPath) => {
  let { segments } = path;
  // Zero length path. No relationship, end === start
  if (!Array.isArray(path.segments) || path.segments.length < 1) {
    segments = [{ ...path, end: null } as Any];
  }

  return segments.map((segment: Any) =>
    [
      objIntToString(segment.start),
      objIntToString(segment.relationship),
      objIntToString(segment.end),
    ].filter((part) => part !== null)
  );
};
