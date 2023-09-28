// WIP: port and fix all types

// import neo4j from "neo4j-driver";
// import { Embeddings } from "../embeddings/base.js";

// enum DistanceStrategy {
//   EUCLIDEAN_DISTANCE = "euclidean",
//   COSINE = "cosine",
// }

// const DEFAULT_DISTANCE_STRATEGY: DistanceStrategy = DistanceStrategy.COSINE;

// function checkIfNotNull(props: string[], values: any[]): void {
//   for (let i = 0; i < props.length; i += 1) {
//     if (!values[i]) {
//       throw new Error(
//         `Parameter \`${props[i]}\` must not be null or an empty string`
//       );
//     }
//   }
// }

// function sortByIndexName(
//   lst: { index_name: string }[],
//   indexName: string
// ): { index_name: string }[] {
//   return lst.sort((a, b) => (a.index_name !== indexName ? -1 : 1));
// }

// class Neo4jVector {
//   private embedding: Embeddings;

//   private driver: neo4j.Driver;

//   private database: string;

//   private indexName: string;

//   private nodeLabel: string;

//   private embeddingNodeProperty: string;

//   private textNodeProperty: string;

//   private distanceStrategy: DistanceStrategy;

//   private overrideRelevanceScoreFn: ((score: number) => number) | null;

//   private retrievalQuery: string;

//   private embeddingDimension: number;

//   constructor({
//     embedding,
//     username,
//     password,
//     url,
//     database = "neo4j",
//     indexName = "vector",
//     nodeLabel = "Chunk",
//     embeddingNodeProperty = "embedding",
//     textNodeProperty = "text",
//     distanceStrategy = DEFAULT_DISTANCE_STRATEGY,
//     preDeleteCollection = false,
//     retrievalQuery = "",
//     relevanceScoreFn = null,
//   }: {
//     embedding: Embeddings;
//     username: string;
//     password: string;
//     url: string;
//     database: string;
//     indexName?: string;
//     nodeLabel?: string;
//     embeddingNodeProperty?: string;
//     textNodeProperty?: string;
//     distanceStrategy?: DistanceStrategy;
//     preDeleteCollection?: boolean;
//     retrievalQuery?: string;
//     relevanceScoreFn?: ((score: number) => number) | null;
//   }) {
//     // Allow only cosine and euclidean distance strategies
//     if (
//       ![DistanceStrategy.EUCLIDEAN_DISTANCE, DistanceStrategy.COSINE].includes(
//         distanceStrategy
//       )
//     ) {
//       throw new Error(
//         "distanceStrategy must be either 'EUCLIDEAN_DISTANCE' or 'COSINE'"
//       );
//     }

//     this.driver = neo4j.driver(url, neo4j.auth.basic(username, password));
//     this.database = database;

//     // Verify connection
//     try {
//       this.driver.getServerInfo();
//     } catch (error) {
//       throw new Error(`Could not connect to Neo4j database. ${error}`);
//     }

//     // Verify if the version supports vector index
//     this.verifyVersion();

//     // Verify that required values are not null
//     checkIfNotNull(
//       ["indexName", "nodeLabel", "embeddingNodeProperty", "textNodeProperty"],
//       [indexName, nodeLabel, embeddingNodeProperty, textNodeProperty]
//     );

//     this.embedding = embedding;
//     this.distanceStrategy = distanceStrategy;
//     this.indexName = indexName;
//     this.nodeLabel = nodeLabel;
//     this.embeddingNodeProperty = embeddingNodeProperty;
//     this.textNodeProperty = textNodeProperty;
//     this.distanceStrategy = distanceStrategy;
//     this.overrideRelevanceScoreFn = relevanceScoreFn;
//     this.retrievalQuery = retrievalQuery;

//     // Calculate embedding dimension
//     // TODO: this returns promise in ts, await it
//     this.embeddingDimension = this.embedding.embedQuery("foo");

//     // Delete existing data if flagged
//     if (preDeleteCollection) {
//       await this.query(
//         `MATCH (n:${this.nodeLabel}) CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 10000 ROWS;`
//       );

//       // Delete index
//       try {
//         this.query(`DROP INDEX ${this.indexName}`);
//       } catch (error) {
//         // Index didn't exist yet
//       }
//     }
//   }

//   async query(query: string, params: any = {}): Promise<any[]> {
//     const session = this.driver.session({ database: this.database });
//     try {
//       const result = await session.run(query, params);
//       return result.records.map((record) => record.toObject());
//     } finally {
//       session.close();
//     }
//   }

//   verifyVersion(): void {
//     const version = this.query("CALL dbms.components()")[0].versions[0];
//     const isAura = version.includes("aura");
//     const versionTuple = isAura
//       ? version
//           .split("-")[0]
//           .split(".")
//           .map((part: string) => parseInt(part, 10))
//           .concat(0)
//       : version.split(".").map((part: string) => parseInt(part, 10));

//     const targetVersion = [5, 11, 0];

//     if (versionTuple < targetVersion) {
//       throw new Error(
//         "Version index is only supported in Neo4j version 5.11 or greater"
//       );
//     }
//   }

//   async retrieveExistingIndex(): Promise<number | null> {
//     const indexInformationQuery = `
//       SHOW INDEXES
//       YIELD name, type, labelsOrTypes, properties, options
//       WHERE type = 'VECTOR'
//       AND (name = $indexName
//       OR (labelsOrTypes[0] = $nodeLabel
//       AND properties[0] = $embeddingNodeProperty))
//       RETURN name, labelsOrTypes, properties, options
//     `;

//     const params = {
//       indexName: this.indexName,
//       nodeLabel: this.nodeLabel,
//       embeddingNodeProperty: this.embeddingNodeProperty,
//     };

//     try {
//       const indexInformation = await this.query(indexInformationQuery, params);
//       // Sort by index_name
//       const sortedIndexInformation = sortByIndexName(
//         indexInformation,
//         this.indexName
//       );

//       if (sortedIndexInformation.length > 0) {
//         this.indexName = sortedIndexInformation[0].name;
//         this.nodeLabel = sortedIndexInformation[0].labelsOrTypes[0];
//         this.embeddingNodeProperty = sortedIndexInformation[0].properties[0];

//         const embeddingDimension =
//           sortedIndexInformation[0].options.indexConfig["vector.dimensions"];

//         return embeddingDimension;
//       } else {
//         return null;
//       }
//     } catch (error) {
//       // Handle any errors that occur during the query
//       console.error("Error retrieving existing index:", error);
//       return null;
//     }
//   }

//   createNewIndex() {
//     const indexQuery = `
//       CALL db.index.vector.createNodeIndex(
//       $indexName,
//       $nodeLabel,
//       $embeddingNodeProperty,
//       toInteger($embeddingDimension),
//       $similarityMetric)
//     `;

//     const parameters = {
//       indexName: this.indexName,
//       nodeLabel: this.nodeLabel,
//       embeddingNodeProperty: this.embeddingNodeProperty,
//       embeddingDimension: this.embeddingDimension,
//       similarityMetric: this.distanceStrategy,
//     };

//     try {
//       this.query(indexQuery, parameters);
//     } catch (error) {
//       console.error("Error creating new index:", error);
//     }
//   }

//   getEmbeddings(): Embeddings {
//     return this.embedding;
//   }

//   static async from(
//     texts: string[],
//     embeddings: number[][],
//     embedding: Embeddings,
//     {
//       metadatas = [],
//       ids = null,
//       createIdIndex = true,
//     }: {
//       metadatas?: any[];
//       ids?: string[] | null;
//       createIdIndex?: boolean;
//       [key: string]: any;
//     }
//   ): Promise<Neo4jVector> {
//     const _ids = ids || texts.map(() => String(uuid.v1()));
//     const _metadatas = metadatas.length > 0 ? metadatas : texts.map(() => ({}));

//     const store = new Neo4jVector(embedding);

//     try {
//       const embeddingDimension = await store.retrieveExistingIndex();

//       if (!embeddingDimension) {
//         await store.createNewIndex();
//       } else if (store.embeddingDimension !== embeddingDimension) {
//         throw new Error(
//           `Index with name ${store.indexName} already exists. The provided embedding function and vector index dimensions do not match.\nEmbedding function dimension: ${store.embeddingDimension}\nVector index dimension: ${embeddingDimension}`
//         );
//       }

//       if (createIdIndex) {
//         await store.query(
//           `CREATE CONSTRAINT IF NOT EXISTS FOR (n:${store.nodeLabel}) REQUIRE n.id IS UNIQUE;`
//         );
//       }

//       await store.addEmbeddings(texts, embeddings, _metadatas, _ids);

//       return store;
//     } catch (error) {
//       // Handle any errors that occur during the process
//       console.error("Error creating Neo4jVector:", error);
//       throw error;
//     }
//   }

//   async addEmbeddings(
//     texts: string[],
//     embeddings: number[][],
//     metadatas: any[],
//     ids: string[],
//     {
//       batchSize = 1000,
//       ...kwargs
//     }: { batchSize?: number; [key: string]: any } = {}
//   ): Promise<string[]> {
//     const _ids = ids || texts.map(() => String(uuid.v1()));
//     const _metadatas = metadatas.length > 0 ? metadatas : texts.map(() => ({}));

//     const importQuery = `
//       UNWIND $data AS row
//       CALL {
//         WITH row
//         MERGE (c:${this.nodeLabel} { id: row.id })
//         WITH c, row
//         CALL db.create.setVectorProperty(c, '${this.embeddingNodeProperty}', row.embedding)
//         YIELD node
//         SET c.${this.textNodeProperty} = row.text
//         SET c += row.metadata
//       } IN TRANSACTIONS OF ${batchSize} ROWS
//     `;

//     const parameters = {
//       data: texts.map((text, index) => ({
//         text,
//         metadata: _metadatas[index],
//         embedding: embeddings[index],
//         id: _ids[index],
//       })),
//     };

//     try {
//       await this.query(importQuery, parameters);
//       return _ids;
//     } catch (error) {
//       // Handle any errors that occur during the import
//       console.error("Error adding embeddings:", error);
//       throw error;
//     }
//   }

//   async addTexts(
//     texts: string[],
//     metadatas: any[] | null = null,
//     ids: string[] | null = null
//   ): Promise<string[]> {
//     const embeddings = await this.embedding.embedDocuments(texts);
//     return this.addEmbeddings(texts, embeddings, metadatas, ids);
//   }

//   async similaritySearch(
//     query: string,
//     k: number = 4,
//     { ...kwargs }: { [key: string]: any } = {}
//   ): Promise<Document[]> {
//     const embedding = this.embedding.embedQuery(query);
//     return this.similaritySearchByVector(embedding, k, kwargs);
//   }

//   async similaritySearchWithScore(
//     query: string,
//     k: number = 4,
//     { ...kwargs }: { [key: string]: any } = {}
//   ): Promise<[Document, number][]> {
//     const embedding = this.embedding.embedQuery(query);
//     return this.similaritySearchWithScoreByVector(embedding, k, kwargs);
//   }

//   async similaritySearchWithScoreByVector(
//     embedding: number[],
//     k: number = 4,
//     { ...kwargs }: { [key: string]: any } = {}
//   ): Promise<[Document, number][]> {
//     const defaultRetrieval = `
//       RETURN node.${this.textNodeProperty} AS text, score,
//       node {.*, ${this.textNodeProperty}: Null, ${this.embeddingNodeProperty}: Null, id: Null } AS metadata
//     `;

//     const retrievalQuery = this.retrievalQuery || defaultRetrieval;

//     const readQuery =
//       `
//       CALL db.index.vector.queryNodes($index, $k, $embedding)
//       YIELD node, score
//     ` + retrievalQuery;

//     const parameters = {
//       index: this.indexName,
//       k,
//       embedding,
//     };

//     try {
//       const results = await this.query(readQuery, parameters);
//       const docsWithScores: [Document, number][] = results.map(
//         (result: any) => [
//           new Document(
//             result.text,
//             Object.keys(result.metadata).reduce(
//               (metadata: any, key: string) => {
//                 if (result.metadata[key] !== null) {
//                   metadata[key] = result.metadata[key];
//                 }
//                 return metadata;
//               },
//               {}
//             )
//           ),
//           result.score,
//         ]
//       );

//       return docsWithScores;
//     } catch (error) {
//       // Handle any errors that occur during the query
//       console.error("Error performing similarity search with score:", error);
//       throw error;
//     }
//   }

//   async similaritySearchByVector(
//     embedding: number[],
//     k: number = 4,
//     { ...kwargs }: { [key: string]: any } = {}
//   ): Promise<Document[]> {
//     const docsWithScores = await this.similaritySearchWithScoreByVector(
//       embedding,
//       k,
//       kwargs
//     );
//     return docsWithScores.map(([doc]) => doc);
//   }

//   static async fromTexts(
//     texts: string[],
//     embedding: Embeddings,
//     {
//       metadatas = null,
//       distanceStrategy = DistanceStrategy.COSINE,
//       ids = null,
//       ...kwargs
//     }: {
//       metadatas?: any[] | null;
//       distanceStrategy?: DistanceStrategy;
//       ids?: string[] | null;
//       [key: string]: any;
//     } = {}
//   ): Promise<Neo4jVector> {
//     const embeddings = embedding.embedDocuments(texts);
//     return this.from(texts, embeddings, embedding, {
//       metadatas,
//       distanceStrategy,
//       ids,
//       ...kwargs,
//     });
//   }

//   static async fromEmbeddings(
//     textEmbeddings: [string, number[]][],
//     embedding: Embeddings,
//     {
//       metadatas = null,
//       distanceStrategy = DistanceStrategy.COSINE,
//       ids = null,
//       preDeleteCollection = false,
//       ...kwargs
//     }: {
//       metadatas?: any[] | null;
//       distanceStrategy?: DistanceStrategy;
//       ids?: string[] | null;
//       preDeleteCollection?: boolean;
//       [key: string]: any;
//     } = {}
//   ): Promise<Neo4jVector> {
//     const texts = textEmbeddings.map(([text]) => text);
//     const embeddings = textEmbeddings.map(([, embedding]) => embedding);
//     return this.from(texts, embeddings, embedding, {
//       metadatas,
//       distanceStrategy,
//       ids,
//       preDeleteCollection,
//       ...kwargs,
//     });
//   }

//   static async fromExistingIndex(
//     embedding: Embeddings,
//     indexName: string,
//     { ...kwargs }: { [key: string]: any } = {}
//   ): Promise<Neo4jVector> {
//     const store = new Neo4jVector(embedding, {
//       indexName,
//       ...kwargs,
//     });

//     try {
//       const embeddingDimension = await store.retrieveExistingIndex();

//       if (!embeddingDimension) {
//         throw new Error(
//           "The specified vector index name does not exist. Make sure to check if you spelled it correctly"
//         );
//       }

//       if (store.embeddingDimension !== embeddingDimension) {
//         throw new Error(
//           `The provided embedding function and vector index dimensions do not match.\nEmbedding function dimension: ${store.embeddingDimension}\nVector index dimension: ${embeddingDimension}`
//         );
//       }

//       return store;
//     } catch (error) {
//       // Handle any errors that occur during the process
//       console.error("Error creating Neo4jVector from existing index:", error);
//       throw error;
//     }
//   }

//   static async fromDocuments(
//     documents: Document[],
//     embedding: Embeddings,
//     {
//       distanceStrategy = DistanceStrategy.COSINE,
//       ids = null,
//       ...kwargs
//     }: {
//       distanceStrategy?: DistanceStrategy;
//       ids?: string[] | null;
//       [key: string]: any;
//     } = {}
//   ): Promise<Neo4jVector> {
//     const texts = documents.map((doc) => doc.pageContent);
//     const metadatas = documents.map((doc) => doc.metadata);

//     return this.fromTexts(texts, embedding, {
//       distanceStrategy,
//       ids,
//       ...kwargs,
//       metadatas,
//     });
//   }

//   private selectRelevanceScoreFn(): (score: number) => number {
//     if (this.overrideRelevanceScoreFn) {
//       return this.overrideRelevanceScoreFn;
//     }

//     // Default strategy is to rely on distance strategy provided
//     // in vectorstore constructor
//     if (this.distanceStrategy === DistanceStrategy.COSINE) {
//       return (score: number) => score;
//     } else if (this.distanceStrategy === DistanceStrategy.EUCLIDEAN_DISTANCE) {
//       return (score: number) => score;
//     } else {
//       throw new Error(
//         `No supported normalization function for distance_strategy of ${this.distanceStrategy}. Consider providing relevance_score_fn to Neo4jVector constructor.`
//       );
//     }
//   }
// }

// export default Neo4jVector;
