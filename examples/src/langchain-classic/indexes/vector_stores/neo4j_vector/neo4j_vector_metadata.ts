import { OpenAIEmbeddings } from "@langchain/openai";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";

/**
 * `similaritySearch` Method with Metadata Filtering:
 *
 * Description:
 * This method facilitates advanced similarity searches within a Neo4j vector index, leveraging both text embeddings and metadata attributes.
 * The third parameter, `filter`, allows for the specification of metadata-based conditions that pre-filter the nodes before performing the similarity search.
 * This approach enhances the search precision by allowing users to query based on complex metadata criteria alongside textual similarity.
 * Metadata filtering also support the following operators:
 *
 *  $eq: Equal
 *  $ne: Not Equal
 *  $lt: Less than
 *  $lte: Less than or equal
 *  $gt: Greater than
 *  $gte: Greater than or equal
 *  $in: In a list of values
 *  $nin: Not in a list of values
 *  $between: Between two values
 *  $like: Text contains value
 *  $ilike: lowered text contains value
 *
 * The filter supports a range of query operations such as equality checks, range queries, and compound conditions (using logical operators like $and, $or).
 * This makes it highly adaptable to varied use cases requiring detailed and specific retrieval of documents based on both content and contextual information.
 *
 * Note:
 * Effective use of this method requires a well-structured Neo4j database where nodes are enriched with both text and metadata properties.
 * The method is particularly useful in scenarios where the integration of text analysis with detailed metadata querying is crucial, such as in content recommendation systems, detailed archival searches, or any application where contextual relevance is key.
 */

// Configuration object for Neo4j connection and other related settings
const config = {
  url: "bolt://localhost:7687", // URL for the Neo4j instance
  username: "neo4j", // Username for Neo4j authentication
  password: "pleaseletmein", // Password for Neo4j authentication
  indexName: "vector", // Name of the vector index
  keywordIndexName: "keyword", // Name of the keyword index if using hybrid search
  searchType: "vector" as const, // Type of search (e.g., vector, hybrid)
  nodeLabel: "Chunk", // Label for the nodes in the graph
  textNodeProperty: "text", // Property of the node containing text
  embeddingNodeProperty: "embedding", // Property of the node containing embedding
};

const documents = [
  { pageContent: "what's this", metadata: { a: 2 } },
  { pageContent: "Cat drinks milk", metadata: { a: 1 } },
];

const neo4jVectorIndex = await Neo4jVectorStore.fromDocuments(
  documents,
  new OpenAIEmbeddings(),
  config
);

const filter = { a: { $eq: 1 } };
const results = await neo4jVectorIndex.similaritySearch("water", 1, { filter });

console.log(results);

/*
  [ Document { pageContent: 'Cat drinks milk', metadata: { a: 1 } } ]
*/

await neo4jVectorIndex.close();
