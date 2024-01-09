import { OpenAIEmbeddings } from "@langchain/openai";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";

/*
 * The retrievalQuery is a customizable Cypher query fragment used in the Neo4jVectorStore class to define how
 * search results should be retrieved and presented from the Neo4j database. It allows developers to specify
 * the format and structure of the data returned after a similarity search.
 * Mandatory columns for `retrievalQuery`:
 *
 * 1. text:
 *    - Description: Represents the textual content of the node.
 *    - Type: String
 *
 * 2. score:
 *    - Description: Represents the similarity score of the node in relation to the search query. A
 *      higher score indicates a closer match.
 *    - Type: Float (ranging between 0 and 1, where 1 is a perfect match)
 *
 * 3. metadata:
 *    - Description: Contains additional properties and information about the node. This can include
 *      any other attributes of the node that might be relevant to the application.
 *    - Type: Object (key-value pairs)
 *    - Example: { "id": "12345", "category": "Books", "author": "John Doe" }
 *
 * Note: While you can customize the `retrievalQuery` to fetch additional columns or perform
 * transformations, never omit the mandatory columns. The names of these columns (`text`, `score`,
 * and `metadata`) should remain consistent. Renaming them might lead to errors or unexpected behavior.
 */

// Configuration object for Neo4j connection and other related settings
const config = {
  url: "bolt://localhost:7687", // URL for the Neo4j instance
  username: "neo4j", // Username for Neo4j authentication
  password: "pleaseletmein", // Password for Neo4j authentication
  retrievalQuery: `
    RETURN node.text AS text, score, {a: node.a * 2} AS metadata
  `,
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

const results = await neo4jVectorIndex.similaritySearch("water", 1);

console.log(results);

/*
  [ Document { pageContent: 'Cat drinks milk', metadata: { a: 2 } } ]
*/

await neo4jVectorIndex.close();
