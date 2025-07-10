import neo4j, {
  type Driver as Neo4jDriver,
  type Record as Neo4jRecord,
  type Path as Neo4jPath,
} from "neo4j-driver";
import * as uuid from "uuid";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type SearchType = "vector" | "hybrid";

export type IndexType = "NODE" | "RELATIONSHIP";

export type DistanceStrategy = "euclidean" | "cosine";

export type Metadata = Record<string, unknown>;

interface Neo4jVectorStoreArgs {
  url: string;
  username: string;
  password: string;
  database?: string;
  preDeleteCollection?: boolean;
  textNodeProperty?: string;
  textNodeProperties?: string[];
  embeddingNodeProperty?: string;
  keywordIndexName?: string;
  indexName?: string;
  searchType?: SearchType;
  indexType?: IndexType;
  retrievalQuery?: string;
  nodeLabel?: string;
  createIdIndex?: boolean;
}

const DEFAULT_SEARCH_TYPE = "vector";
const DEFAULT_INDEX_TYPE = "NODE";
const DEFAULT_DISTANCE_STRATEGY = "cosine";
const DEFAULT_NODE_EMBEDDING_PROPERTY = "embedding";

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
export class Neo4jVectorStore extends VectorStore {
  private driver: Neo4jDriver;

  private database: string;

  private preDeleteCollection: boolean;

  private nodeLabel: string;

  private embeddingNodeProperty: string;

  private embeddingDimension: number;

  private textNodeProperty: string;

  private keywordIndexName: string;

  private indexName: string;

  private retrievalQuery: string;

  private searchType: SearchType;

  private indexType: IndexType;

  private distanceStrategy: DistanceStrategy = DEFAULT_DISTANCE_STRATEGY;

  private supportMetadataFilter = true;

  private isEnterprise = false;

  _vectorstoreType(): string {
    return "neo4jvector";
  }

  constructor(embeddings: EmbeddingsInterface, config: Neo4jVectorStoreArgs) {
    super(embeddings, config);
  }

  static async initialize(
    embeddings: EmbeddingsInterface,
    config: Neo4jVectorStoreArgs
  ) {
    const store = new Neo4jVectorStore(embeddings, config);
    await store._initializeDriver(config);
    await store._verifyConnectivity();

    const {
      preDeleteCollection = false,
      nodeLabel = "Chunk",
      textNodeProperty = "text",
      embeddingNodeProperty = DEFAULT_NODE_EMBEDDING_PROPERTY,
      keywordIndexName = "keyword",
      indexName = "vector",
      retrievalQuery = "",
      searchType = DEFAULT_SEARCH_TYPE,
      indexType = DEFAULT_INDEX_TYPE,
    } = config;

    store.embeddingDimension = (await embeddings.embedQuery("foo")).length;
    store.preDeleteCollection = preDeleteCollection;
    store.nodeLabel = nodeLabel;
    store.textNodeProperty = textNodeProperty;
    store.embeddingNodeProperty = embeddingNodeProperty;
    store.keywordIndexName = keywordIndexName;
    store.indexName = indexName;
    store.retrievalQuery = retrievalQuery;
    store.searchType = searchType;
    store.indexType = indexType;

    if (store.preDeleteCollection) {
      await store._dropIndex();
    }

    return store;
  }

  async _initializeDriver({
    url,
    username,
    password,
    database = "neo4j",
  }: Neo4jVectorStoreArgs) {
    try {
      this.driver = neo4j.driver(url, neo4j.auth.basic(username, password));
      this.database = database;
    } catch (error) {
      throw new Error(
        "Could not create a Neo4j driver instance. Please check the connection details."
      );
    }
  }

  async _verifyConnectivity() {
    await this.driver.verifyAuthentication();
  }

  async _verifyVersion() {
    try {
      const data = await this.query("CALL dbms.components()");
      const versionString: string = data[0].versions[0];
      const targetVersion = [5, 11, 0];

      let version: number[];

      if (versionString.includes("aura")) {
        // Get the 'x.y.z' part before '-aura'
        const baseVersion = versionString.split("-")[0];
        version = baseVersion.split(".").map(Number);
        version.push(0);
      } else {
        version = versionString.split(".").map(Number);
      }

      if (isVersionLessThan(version, targetVersion)) {
        throw new Error(
          "Version index is only supported in Neo4j version 5.11 or greater"
        );
      }

      const metadataTargetVersion = [5, 18, 0];
      if (isVersionLessThan(version, metadataTargetVersion)) {
        this.supportMetadataFilter = false;
      }

      this.isEnterprise = data[0].edition === "enterprise";
    } catch (error) {
      console.error("Database version check failed:", error);
    }
  }

  async close() {
    await this.driver.close();
  }

  async _dropIndex() {
    try {
      await this.query(`
        MATCH (n:\`${this.nodeLabel}\`)
        CALL {
          WITH n
          DETACH DELETE n
        }
        IN TRANSACTIONS OF 10000 ROWS;
      `);
      await this.query(`DROP INDEX ${this.indexName}`);
    } catch (error) {
      console.error("An error occurred while dropping the index:", error);
    }
  }

  async query(query: string, params: Any = {}): Promise<Any[]> {
    const session = this.driver.session({ database: this.database });
    const result = await session.run(query, params);
    return toObjects(result.records);
  }

  static async fromTexts(
    texts: string[],
    metadatas: Any,
    embeddings: EmbeddingsInterface,
    config: Neo4jVectorStoreArgs
  ): Promise<Neo4jVectorStore> {
    const docs = [];

    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }

    return Neo4jVectorStore.fromDocuments(docs, embeddings, config);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    config: Neo4jVectorStoreArgs
  ): Promise<Neo4jVectorStore> {
    const {
      searchType = DEFAULT_SEARCH_TYPE,
      createIdIndex = true,
      textNodeProperties = [],
    } = config;

    const store = await this.initialize(embeddings, config);

    const embeddingDimension = await store.retrieveExistingIndex();

    if (!embeddingDimension) {
      await store.createNewIndex();
    } else if (store.embeddingDimension !== embeddingDimension) {
      throw new Error(
        `Index with name "${store.indexName}" already exists. The provided embedding function and vector index dimensions do not match.
        Embedding function dimension: ${store.embeddingDimension}
        Vector index dimension: ${embeddingDimension}`
      );
    }

    if (searchType === "hybrid") {
      const ftsNodeLabel = await store.retrieveExistingFtsIndex();

      if (!ftsNodeLabel) {
        await store.createNewKeywordIndex(textNodeProperties);
      } else {
        if (ftsNodeLabel !== store.nodeLabel) {
          throw Error(
            "Vector and keyword index don't index the same node label"
          );
        }
      }
    }

    if (createIdIndex) {
      await store.query(
        `CREATE CONSTRAINT IF NOT EXISTS FOR (n:${store.nodeLabel}) REQUIRE n.id IS UNIQUE;`
      );
    }

    await store.addDocuments(docs);

    return store;
  }

  static async fromExistingIndex(
    embeddings: EmbeddingsInterface,
    config: Neo4jVectorStoreArgs
  ) {
    const { searchType = DEFAULT_SEARCH_TYPE, keywordIndexName = "keyword" } =
      config;

    if (searchType === "hybrid" && !keywordIndexName) {
      throw Error(
        "keyword_index name has to be specified when using hybrid search option"
      );
    }

    const store = await this.initialize(embeddings, config);
    const embeddingDimension = await store.retrieveExistingIndex();

    if (!embeddingDimension) {
      throw Error(
        "The specified vector index name does not exist. Make sure to check if you spelled it correctly"
      );
    }

    if (store.embeddingDimension !== embeddingDimension) {
      throw new Error(
        `The provided embedding function and vector index dimensions do not match.
         Embedding function dimension: ${store.embeddingDimension}
         Vector index dimension: ${embeddingDimension}`
      );
    }

    if (searchType === "hybrid") {
      const ftsNodeLabel = await store.retrieveExistingFtsIndex();

      if (!ftsNodeLabel) {
        throw Error(
          "The specified keyword index name does not exist. Make sure to check if you spelled it correctly"
        );
      } else {
        if (ftsNodeLabel !== store.nodeLabel) {
          throw Error(
            "Vector and keyword index don't index the same node label"
          );
        }
      }
    }

    return store;
  }

  static async fromExistingGraph(
    embeddings: EmbeddingsInterface,
    config: Neo4jVectorStoreArgs
  ) {
    const {
      textNodeProperties = [],
      embeddingNodeProperty = DEFAULT_NODE_EMBEDDING_PROPERTY,
      searchType = DEFAULT_SEARCH_TYPE,
      retrievalQuery = "",
      nodeLabel,
    } = config;

    let _retrievalQuery = retrievalQuery;

    if (textNodeProperties.length === 0) {
      throw Error(
        "Parameter `text_node_properties` must not be an empty array"
      );
    }

    if (!retrievalQuery) {
      _retrievalQuery = `
        RETURN reduce(str='', k IN ${JSON.stringify(textNodeProperties)} |
        str + '\\n' + k + ': ' + coalesce(node[k], '')) AS text,
        node {.*, \`${embeddingNodeProperty}\`: Null, id: Null, ${textNodeProperties
        .map((prop) => `\`${prop}\`: Null`)
        .join(", ")} } AS metadata, score
      `;
    }

    const store = await this.initialize(embeddings, {
      ...config,
      retrievalQuery: _retrievalQuery,
    });

    const embeddingDimension = await store.retrieveExistingIndex();

    if (!embeddingDimension) {
      await store.createNewIndex();
    } else if (store.embeddingDimension !== embeddingDimension) {
      throw new Error(
        `Index with name ${store.indexName} already exists. The provided embedding function and vector index dimensions do not match.\nEmbedding function dimension: ${store.embeddingDimension}\nVector index dimension: ${embeddingDimension}`
      );
    }

    if (searchType === "hybrid") {
      const ftsNodeLabel = await store.retrieveExistingFtsIndex(
        textNodeProperties
      );

      if (!ftsNodeLabel) {
        await store.createNewKeywordIndex(textNodeProperties);
      } else {
        if (ftsNodeLabel !== store.nodeLabel) {
          throw Error(
            "Vector and keyword index don't index the same node label"
          );
        }
      }
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const fetchQuery = `
        MATCH (n:\`${nodeLabel}\`)
        WHERE n.${embeddingNodeProperty} IS null
        AND any(k in $props WHERE n[k] IS NOT null)
        RETURN elementId(n) AS id, reduce(str='', k IN $props |
        str + '\\n' + k + ':' + coalesce(n[k], '')) AS text
        LIMIT 1000
      `;

      const data = await store.query(fetchQuery, { props: textNodeProperties });

      if (!data) {
        break;
      }

      const textEmbeddings = await embeddings.embedDocuments(
        data.map((el) => el.text)
      );

      const params = {
        data: data.map((el, index) => ({
          id: el.id,
          embedding: textEmbeddings[index],
        })),
      };

      await store.query(
        `
        UNWIND $data AS row
        MATCH (n:\`${nodeLabel}\`)
        WHERE elementId(n) = row.id
        CALL db.create.setVectorProperty(n, '${embeddingNodeProperty}', row.embedding)
        YIELD node RETURN count(*)
      `,
        params
      );

      if (data.length < 1000) {
        break;
      }
    }

    return store;
  }

  async createNewIndex(): Promise<void> {
    const indexQuery = `
      CALL db.index.vector.createNodeIndex(
        $index_name,
        $node_label,
        $embedding_node_property,
        toInteger($embedding_dimension),
        $similarity_metric
      )
    `;

    const parameters = {
      index_name: this.indexName,
      node_label: this.nodeLabel,
      embedding_node_property: this.embeddingNodeProperty,
      embedding_dimension: this.embeddingDimension,
      similarity_metric: this.distanceStrategy,
    };

    await this.query(indexQuery, parameters);
  }

  async retrieveExistingIndex() {
    let indexInformation = await this.query(
      `
        SHOW INDEXES YIELD name, type, labelsOrTypes, properties, options
        WHERE type = 'VECTOR' AND (name = $index_name
        OR (labelsOrTypes[0] = $node_label AND
        properties[0] = $embedding_node_property))
        RETURN name, labelsOrTypes, properties, options
      `,
      {
        index_name: this.indexName,
        node_label: this.nodeLabel,
        embedding_node_property: this.embeddingNodeProperty,
      }
    );

    if (indexInformation) {
      indexInformation = this.sortByIndexName(indexInformation, this.indexName);

      try {
        const [index] = indexInformation;
        const [labelOrType] = index.labelsOrTypes;
        const [property] = index.properties;

        this.indexName = index.name;
        this.nodeLabel = labelOrType;
        this.embeddingNodeProperty = property;

        const embeddingDimension =
          index.options.indexConfig["vector.dimensions"];
        return Number(embeddingDimension);
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  async retrieveExistingFtsIndex(
    textNodeProperties: string[] = []
  ): Promise<string | null> {
    const indexInformation = await this.query(
      `
      SHOW INDEXES YIELD name, type, labelsOrTypes, properties, options
      WHERE type = 'FULLTEXT' AND (name = $keyword_index_name
      OR (labelsOrTypes = [$node_label] AND
      properties = $text_node_property))
      RETURN name, labelsOrTypes, properties, options
    `,
      {
        keyword_index_name: this.keywordIndexName,
        node_label: this.nodeLabel,
        text_node_property:
          textNodeProperties.length > 0
            ? textNodeProperties
            : [this.textNodeProperty],
      }
    );

    if (indexInformation) {
      // Sort the index information by index name
      const sortedIndexInformation = this.sortByIndexName(
        indexInformation,
        this.indexName
      );

      try {
        const [index] = sortedIndexInformation;
        const [labelOrType] = index.labelsOrTypes;
        const [property] = index.properties;

        this.keywordIndexName = index.name;
        this.textNodeProperty = property;
        this.nodeLabel = labelOrType;

        return labelOrType;
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  async createNewKeywordIndex(
    textNodeProperties: string[] = []
  ): Promise<void> {
    const nodeProps =
      textNodeProperties.length > 0
        ? textNodeProperties
        : [this.textNodeProperty];

    // Construct the Cypher query to create a new full text index
    const ftsIndexQuery = `
      CREATE FULLTEXT INDEX ${this.keywordIndexName}
      FOR (n:\`${this.nodeLabel}\`) ON EACH
      [${nodeProps.map((prop) => `n.\`${prop}\``).join(", ")}]
    `;

    await this.query(ftsIndexQuery);
  }

  sortByIndexName(
    values: Array<{ [key: string]: Any }>,
    indexName: string
  ): Array<{ [key: string]: Any }> {
    return values.sort(
      (a, b) =>
        (a.name === indexName ? -1 : 0) - (b.name === indexName ? -1 : 0)
    );
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    metadatas?: Record<string, Any>[],
    ids?: string[]
  ): Promise<string[]> {
    let _ids = ids;
    const _metadatas = metadatas;

    if (!_ids) {
      _ids = documents.map(() => uuid.v1());
    }

    const importQuery = `
      UNWIND $data AS row
      CALL {
        WITH row
        MERGE (c:\`${this.nodeLabel}\` {id: row.id})
        WITH c, row
        CALL db.create.setVectorProperty(c, '${this.embeddingNodeProperty}', row.embedding)
        YIELD node
        SET c.\`${this.textNodeProperty}\` = row.text
        SET c += row.metadata
      } IN TRANSACTIONS OF 1000 ROWS
    `;

    const parameters = {
      data: documents.map(({ pageContent, metadata }, index) => ({
        text: pageContent,
        metadata: _metadatas ? _metadatas[index] : metadata,
        embedding: vectors[index],
        id: _ids ? _ids[index] : null,
      })),
    };

    await this.query(importQuery, parameters);

    return _ids;
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);

    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async similaritySearch(
    query: string,
    k = 4,
    params: Record<string, Any> = {}
  ): Promise<Document[]> {
    const embedding = await this.embeddings.embedQuery(query);

    const results = await this.similaritySearchVectorWithScore(
      embedding,
      k,
      query,
      params
    );

    return results.map((result) => result[0]);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4,
    params: Record<string, Any> = {}
  ): Promise<[Document, number][]> {
    const embedding = await this.embeddings.embedQuery(query);
    return this.similaritySearchVectorWithScore(embedding, k, query, params);
  }

  async similaritySearchVectorWithScore(
    vector: number[],
    k: number,
    query: string,
    params: Record<string, Any> = {}
  ): Promise<[Document, number][]> {
    let indexQuery: string;
    let filterParams: Record<string, Any>;

    const { filter } = params;

    if (filter) {
      if (!this.supportMetadataFilter) {
        throw new Error(
          "Metadata filtering is only supported in Neo4j version 5.18 or greater."
        );
      }

      if (this.searchType === "hybrid") {
        throw new Error(
          "Metadata filtering can't be use in combination with a hybrid search approach."
        );
      }

      const parallelQuery = this.isEnterprise
        ? "CYPHER runtime = parallel parallelRuntimeSupport=all "
        : "";

      const baseIndexQuery = `
        ${parallelQuery}
        MATCH (n:\`${this.nodeLabel}\`)
        WHERE n.\`${this.embeddingNodeProperty}\` IS NOT NULL
        AND size(n.\`${this.embeddingNodeProperty}\`) = toInteger(${this.embeddingDimension}) AND
      `;

      const baseCosineQuery = `
        WITH n as node, vector.similarity.cosine(
          n.\`${this.embeddingNodeProperty}\`,
          $embedding
        ) AS score ORDER BY score DESC LIMIT toInteger($k)
      `;
      const [fSnippets, fParams] = constructMetadataFilter(filter);

      indexQuery = baseIndexQuery + fSnippets + baseCosineQuery;
      filterParams = fParams;
    } else {
      indexQuery = getSearchIndexQuery(this.searchType, this.indexType);
      filterParams = {};
    }

    let defaultRetrieval: string;

    if (this.indexType === "RELATIONSHIP") {
      defaultRetrieval = `
        RETURN relationship.${this.textNodeProperty} AS text, score,
        relationship {.*, ${this.textNodeProperty}: Null,
        ${this.embeddingNodeProperty}: Null, id: Null } AS metadata
      `;
    } else {
      defaultRetrieval = `
        RETURN node.${this.textNodeProperty} AS text, score,
        node {.*, ${this.textNodeProperty}: Null,
        ${this.embeddingNodeProperty}: Null, id: Null } AS metadata
      `;
    }

    const retrievalQuery = this.retrievalQuery
      ? this.retrievalQuery
      : defaultRetrieval;
    const readQuery = `${indexQuery} ${retrievalQuery}`;

    const parameters = {
      index: this.indexName,
      k: Number(k),
      embedding: vector,
      keyword_index: this.keywordIndexName,
      query: removeLuceneChars(query),
      ...params,
      ...filterParams,
    };

    const results = await this.query(readQuery, parameters);

    if (results) {
      if (results.some((result) => result.text == null)) {
        if (!this.retrievalQuery) {
          throw new Error(
            "Make sure that none of the '" +
              this.textNodeProperty +
              "' properties on nodes with label '" +
              this.nodeLabel +
              "' are missing or empty"
          );
        } else {
          throw new Error(
            "Inspect the 'retrievalQuery' and ensure it doesn't return null for the 'text' column"
          );
        }
      }

      const docs: [Document, number][] = results.map((result: Any) => [
        new Document({
          pageContent: result.text,
          metadata: Object.fromEntries(
            Object.entries(result.metadata).filter(([_, v]) => v !== null)
          ),
        }),
        result.score,
      ]);

      return docs;
    }

    return [];
  }
}

function toObjects(records: Neo4jRecord[]) {
  const recordValues: Record<string, Any>[] = records.map((record) => {
    const rObj = record.toObject();
    const out: { [key: string]: Any } = {};
    Object.keys(rObj).forEach((key) => {
      out[key] = itemIntToString(rObj[key]);
    });
    return out;
  });
  return recordValues;
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

function extractPathForRows(path: Neo4jPath) {
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
}

function getSearchIndexQuery(
  searchType: SearchType,
  indexType: IndexType = DEFAULT_INDEX_TYPE
): string {
  if (indexType === "NODE") {
    const typeToQueryMap: { [key in SearchType]: string } = {
      vector:
        "CALL db.index.vector.queryNodes($index, $k, $embedding) YIELD node, score",
      hybrid: `
          CALL {
              CALL db.index.vector.queryNodes($index, $k, $embedding) YIELD node, score
              WITH collect({node:node, score:score}) AS nodes, max(score) AS max
              UNWIND nodes AS n
              // We use 0 as min
              RETURN n.node AS node, (n.score / max) AS score UNION
              CALL db.index.fulltext.queryNodes($keyword_index, $query, {limit: $k}) YIELD node, score
              WITH collect({node: node, score: score}) AS nodes, max(score) AS max
              UNWIND nodes AS n
              RETURN n.node AS node, (n.score / max) AS score
          }
          WITH node, max(score) AS score ORDER BY score DESC LIMIT toInteger($k)
      `,
    };

    return typeToQueryMap[searchType];
  } else {
    return `
      CALL db.index.vector.queryRelationships($index, $k, $embedding)
      YIELD relationship, score
    `;
  }
}

function removeLuceneChars(text: string | null) {
  if (text === undefined || text === null) {
    return null;
  }

  // Remove Lucene special characters
  const specialChars = [
    "+",
    "-",
    "&",
    "|",
    "!",
    "(",
    ")",
    "{",
    "}",
    "[",
    "]",
    "^",
    '"',
    "~",
    "*",
    "?",
    ":",
    "\\",
  ];
  let modifiedText = text;
  for (const char of specialChars) {
    modifiedText = modifiedText.split(char).join(" ");
  }
  return modifiedText.trim();
}

function isVersionLessThan(v1: number[], v2: number[]): boolean {
  for (let i = 0; i < Math.min(v1.length, v2.length); i += 1) {
    if (v1[i] < v2[i]) {
      return true;
    } else if (v1[i] > v2[i]) {
      return false;
    }
  }
  // If all the corresponding parts are equal, the shorter version is less
  return v1.length < v2.length;
}

// Filter utils

const COMPARISONS_TO_NATIVE: Record<string, string> = {
  $eq: "=",
  $ne: "<>",
  $lt: "<",
  $lte: "<=",
  $gt: ">",
  $gte: ">=",
};

const COMPARISONS_TO_NATIVE_OPERATORS = new Set(
  Object.keys(COMPARISONS_TO_NATIVE)
);

const TEXT_OPERATORS = new Set(["$like", "$ilike"]);

const LOGICAL_OPERATORS = new Set(["$and", "$or"]);

const SPECIAL_CASED_OPERATORS = new Set(["$in", "$nin", "$between"]);

const SUPPORTED_OPERATORS = new Set([
  ...COMPARISONS_TO_NATIVE_OPERATORS,
  ...TEXT_OPERATORS,
  ...LOGICAL_OPERATORS,
  ...SPECIAL_CASED_OPERATORS,
]);

const IS_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function combineQueries(
  inputQueries: [string, Record<string, Any>][],
  operator: string
): [string, Record<string, Any>] {
  let combinedQuery = "";
  const combinedParams: Record<string, Any> = {};
  const paramCounter: Record<string, number> = {};

  for (const [query, params] of inputQueries) {
    let newQuery = query;
    for (const [param, value] of Object.entries(params)) {
      if (param in paramCounter) {
        paramCounter[param] += 1;
      } else {
        paramCounter[param] = 1;
      }
      const newParamName = `${param}_${paramCounter[param]}`;

      newQuery = newQuery.replace(`$${param}`, `$${newParamName}`);
      combinedParams[newParamName] = value;
    }

    if (combinedQuery) {
      combinedQuery += ` ${operator} `;
    }
    combinedQuery += `(${newQuery})`;
  }

  return [combinedQuery, combinedParams];
}

function collectParams(
  inputData: [string, Record<string, string>][]
): [string[], Record<string, Any>] {
  const queryParts: string[] = [];
  const params: Record<string, Any> = {};

  for (const [queryPart, param] of inputData) {
    queryParts.push(queryPart);
    Object.assign(params, param);
  }

  return [queryParts, params];
}

function handleFieldFilter(
  field: string,
  value: Any,
  paramNumber = 1
): [string, Record<string, Any>] {
  if (typeof field !== "string") {
    throw new Error(
      `field should be a string but got: ${typeof field} with value: ${field}`
    );
  }

  if (field.startsWith("$")) {
    throw new Error(
      `Invalid filter condition. Expected a field but got an operator: ${field}`
    );
  }

  // Allow [a - zA - Z0 -9_], disallow $ for now until we support escape characters
  if (!IS_IDENTIFIER_REGEX.test(field)) {
    throw new Error(
      `Invalid field name: ${field}. Expected a valid identifier.`
    );
  }

  let operator: string;
  let filterValue: Any;

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const keys = Object.keys(value);

    if (keys.length !== 1) {
      throw new Error(`Invalid filter condition. Expected a value which is a dictionary
        with a single key that corresponds to an operator but got a dictionary
        with ${keys.length} keys. The first few keys are: ${keys
        .slice(0, 3)
        .join(", ")}
      `);
    }

    // eslint-disable-next-line prefer-destructuring
    operator = keys[0];
    filterValue = value[operator];

    if (!SUPPORTED_OPERATORS.has(operator)) {
      throw new Error(
        `Invalid operator: ${operator}. Expected one of ${SUPPORTED_OPERATORS}`
      );
    }
  } else {
    operator = "$eq";
    filterValue = value;
  }

  if (COMPARISONS_TO_NATIVE_OPERATORS.has(operator)) {
    const native = COMPARISONS_TO_NATIVE[operator];
    const querySnippet = `n.${field} ${native} $param_${paramNumber}`;
    const queryParam = { [`param_${paramNumber}`]: filterValue };

    return [querySnippet, queryParam];
  } else if (operator === "$between") {
    const [low, high] = filterValue;
    const querySnippet = `$param_${paramNumber}_low <= n.${field} <= $param_${paramNumber}_high`;
    const queryParam = {
      [`param_${paramNumber}_low`]: low,
      [`param_${paramNumber}_high`]: high,
    };

    return [querySnippet, queryParam];
  } else if (["$in", "$nin", "$like", "$ilike"].includes(operator)) {
    if (["$in", "$nin"].includes(operator)) {
      filterValue.forEach((val: Any) => {
        if (
          typeof val !== "string" &&
          typeof val !== "number" &&
          typeof val !== "boolean"
        ) {
          throw new Error(`Unsupported type: ${typeof val} for value: ${val}`);
        }
      });
    }

    if (operator === "$in") {
      const querySnippet = `n.${field} IN $param_${paramNumber}`;
      const queryParam = { [`param_${paramNumber}`]: filterValue };
      return [querySnippet, queryParam];
    } else if (operator === "$nin") {
      const querySnippet = `n.${field} NOT IN $param_${paramNumber}`;
      const queryParam = { [`param_${paramNumber}`]: filterValue };
      return [querySnippet, queryParam];
    } else if (operator === "$like") {
      const querySnippet = `n.${field} CONTAINS $param_${paramNumber}`;
      const queryParam = { [`param_${paramNumber}`]: filterValue.slice(0, -1) };
      return [querySnippet, queryParam];
    } else if (operator === "$ilike") {
      const querySnippet = `toLower(n.${field}) CONTAINS $param_${paramNumber}`;
      const queryParam = { [`param_${paramNumber}`]: filterValue.slice(0, -1) };
      return [querySnippet, queryParam];
    } else {
      throw new Error("Not Implemented");
    }
  } else {
    throw new Error("Not Implemented");
  }
}

function constructMetadataFilter(
  filter: Record<string, Any>
): [string, Record<string, Any>] {
  if (typeof filter !== "object" || filter === null) {
    throw new Error("Expected a dictionary representing the filter condition.");
  }

  const entries = Object.entries(filter);

  if (entries.length === 1) {
    const [key, value] = entries[0];

    if (key.startsWith("$")) {
      if (!["$and", "$or"].includes(key.toLowerCase())) {
        throw new Error(
          `Invalid filter condition. Expected $and or $or but got: ${key}`
        );
      }

      if (!Array.isArray(value)) {
        throw new Error(
          `Expected an array for logical conditions, but got ${typeof value} for value: ${value}`
        );
      }

      const operation = key.toLowerCase() === "$and" ? "AND" : "OR";
      const combinedQueries = combineQueries(
        value.map((v) => constructMetadataFilter(v)),
        operation
      );

      return combinedQueries;
    } else {
      return handleFieldFilter(key, value);
    }
  } else if (entries.length > 1) {
    for (const [key] of entries) {
      if (key.startsWith("$")) {
        throw new Error(
          `Invalid filter condition. Expected a field but got an operator: ${key}`
        );
      }
    }

    const and_multiple = collectParams(
      entries.map(([field, val], index) =>
        handleFieldFilter(field, val, index + 1)
      )
    );

    if (and_multiple.length >= 1) {
      return [and_multiple[0].join(" AND "), and_multiple[1]];
    } else {
      throw Error(
        "Invalid filter condition. Expected a dictionary but got an empty dictionary"
      );
    }
  } else {
    throw new Error("Filter condition contains no entries.");
  }
}
