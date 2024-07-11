import * as oracledb from 'oracledb';
import * as dotenv from 'dotenv';
import {createIndex, OracleVS} from "./oravsjs";
import {Document, DocumentInterface} from "@langchain/core/documents";
import {Embeddings} from "@langchain/core/embeddings";
import {promises as fs} from "fs";
import {MaxMarginalRelevanceSearchOptions} from "@langchain/core/vectorstores";
import {Callbacks} from "@langchain/core/callbacks/manager";

interface DBConfig {
  user: string;
  password: string;
  connectString: string;
  poolMin?: number;
  poolMax?: number;
  poolIncrement?: number;
}

interface DataRow {
  id: string;
  link: string;
  text: string;
}

dotenv.config();

async function dbConnect(): Promise<oracledb.Pool> {
  // Create a connection pool
  const pool = await oracledb.createPool({
    user: 'vector',
    password: 'vector',
    connectString: '152.67.235.198:1521/orclpdb1'
  });

  console.log('Connection pool started')
  return pool
}

function getEmbeddingFunction(device: string): EmbeddingFunction | Embeddings | null {
  let embeddingFunction: EmbeddingFunction | Embeddings | null = null;
  try {
    const modelName: string = "sentence-transformers/all-mpnet-base-v2";
    const modelKwargs = { device };
    embeddingFunction = new HuggingFaceEmbeddings(modelName, modelKwargs);
  } catch (ex) {
    console.error("An exception occurred ::", ex);
    // Assuming you have some way to log or handle the traceback. TypeScript/JavaScript does not have a direct equivalent to Python's traceback.print_exc()
  }
  return embeddingFunction;
}

class TestsOracleVS {
  private client: oracledb.Pool | null = null;
  private docsDir: string = "./resources/downloads/oradocs/";
  private filename: string;
  private oraclevs: OracleVS;

  constructor(filename: string, embeddingFunction: Embeddings, dbConfig: Record<string, any>) {
    this.filename = filename;
    try {
      this.oraclevs = new OracleVS(embeddingFunction, dbConfig)
      this.filename = filename;
    } catch (error) {
      console.error("An exception occurred ::", error);
      // Handle error
    }
  }

  async init(): Promise<void> {
    this.client = await dbConnect()
  }

  private createDocument(row: DataRow): Document {
    const metadata = {
      id: row.id,
      link: row.link,
    };

    // Assuming Document accepts metadata and pageContent in its constructor or has a method to set these
    return new Document({pageContent: row.text, metadata: metadata});
  }

  public async testIngestJson(): Promise<Document[]> {
    try {
      const filePath = `${this.docsDir}${this.filename}`;
      const fileContent = await fs.readFile(filePath, {encoding: 'utf8'});
      const jsonData: DataRow[] = JSON.parse(fileContent);
      return jsonData.map((row) => this.createDocument(row));
    } catch (error) {
      console.error('An error occurred while ingesting JSON:', error);
      throw error; // Rethrow the error if you want the calling function to handle it
    }
  }

  public async testCreateIndex(): Promise<void> {
    try {
      const connection = await this.oraclevs.getConnection()

      await createIndex(connection, this.oraclevs, {
        idx_name: "IVF",
        idx_type: "IVF",
        neighbor_part: 64,
        accuracy: 90
      });

      console.log("Index created successfully");
    } catch (ex) {
      console.error("Exception occurred while index creation", ex);
      // TypeScript/JavaScript does not have a direct equivalent to Python's traceback.print_exc(),
      // so we log the error object directly, which includes the stack trace.
    }
  }

  public async testSimilaritySearchByVector(
    embedding: number[],
    k: number,
    filter?: OracleVS["FilterType"],
  ): Promise<[DocumentInterface, number][]> {
    return this.oraclevs.similaritySearchVectorWithScore(
      embedding,
      k,
      filter,
    );
  }

  public async testSimilaritySearchByVectorReturningEmbeddings(
    embedding: number[],
    k: number = 4,
    filter: OracleVS["FilterType"] = null,
  ): Promise<[Document, number, Float32Array | number[]][]> {
    return await this.oraclevs.similaritySearchByVectorReturningEmbeddings( embedding, k, filter);
  }

  public async testMaxMarginalRelevanceSearch(
    query: string,
    options?: MaxMarginalRelevanceSearchOptions<OracleVS["FilterType"]>,
    _callbacks?: Callbacks | undefined
  ): Promise<DocumentInterface[]> {
    return this.oraclevs.maxMarginalRelevanceSearch(query, options, _callbacks);
  }

  public async testMaxMarginalRelevanceSearchByVector(
    query: number[],
    options?: MaxMarginalRelevanceSearchOptions<OracleVS["FilterType"]>,
    _callbacks?: Callbacks | undefined
  ): Promise<DocumentInterface[]> {
    return this.oraclevs.maxMarginalRelevanceSearchByVector(query, options, _callbacks);
  }
  public async testMaxMarginalRelevanceSearchWithScoreByVector(
    embedding: number[],
    options?: MaxMarginalRelevanceSearchOptions<OracleVS["FilterType"]>,
    _callbacks?: Callbacks | undefined // implement passing to embedQuery later
  ): Promise<Array<{ document: Document; score: number }>> {
    return this.oraclevs.maxMarginalRelevanceSearchWithScoreByVector(embedding, options, _callbacks)
  }

  testDelete( params: { ids?: string[], deleteAll?: boolean } ): Promise<void> {
    return this.oraclevs.delete(params);
  }
}

async function runTestsOracleVS() {
  // Initialize dotenv to load environment variables
  dotenv.config();
  const query = "What is the language used by Oracle database";
  // Setup DB config - assuming these values are stored in your .env file
  const dbConfig: DBConfig = {
    user: process.env.DB_USER || 'vector',
    password: process.env.DB_PASSWORD || 'vector',
    connectString: process.env.DB_CONNECT_STRING || '152.67.235.198:1521/orclpdb1',
    poolMin: parseInt(process.env.DB_POOL_MIN || '4'),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10'),
    poolIncrement: parseInt(process.env.DB_POOL_INCREMENT || '2')
  };

  // Set up the embedding function
  const device: string = "cpu"; // Assuming CPU usage, adjust as necessary
  const embeddingFunction: Embeddings | null = getEmbeddingFunction(device);

  if (!embeddingFunction) {
    console.error("Failed to initialize the embedding function.");
    return;
  }

  // Initialize the TestsOracleVS class
  const testsOracleVS = new TestsOracleVS("concepts23c_small.json",
    embeddingFunction, dbConfig);

  // Initialize connection and other setup
  await testsOracleVS.init();

  // Ingest JSON data to create documents
  const documents = await testsOracleVS.testIngestJson();
  console.log("Ingested Documents:", documents);

  // Create an index
  await testsOracleVS.testCreateIndex();

  // Assume some dummy embedding vector for demonstration
  // const embedding: number[] = [0.1, 0.2, 0.3, 0.4]; // Example embedding

  // Perform a similarity search by vector
  const embedding = await this.embeddings.embedQuery(query);
  const similaritySearchByVector = await testsOracleVS.testSimilaritySearchByVector(embedding, 5);
  console.log("Similarity Search Results:", similaritySearchByVector);

  // Perform a similarity search by vector
  const similaritySearchByEmbeddings =
    await testsOracleVS.testSimilaritySearchByVectorReturningEmbeddings(embedding, 5)
  console.log("Similarity Search Results:", similaritySearchByEmbeddings);

  const maxMarginalRelevanceSearch =
    await testsOracleVS.testMaxMarginalRelevanceSearch(query)
  console.log("Max Marginal Relevance Search:", maxMarginalRelevanceSearch);

  const maxMarginalRelevanceSearchByVector =
    testsOracleVS.testMaxMarginalRelevanceSearchByVector(embedding)
  console.log("Max Marginal Relevance Search By Vector:", maxMarginalRelevanceSearchByVector);

  const maxMarginalRelevanceSearchWithScoreByVector =
    testsOracleVS.testMaxMarginalRelevanceSearchWithScoreByVector(embedding)
  console.log("Max Marginal Relevance Search By Vector:", maxMarginalRelevanceSearchWithScoreByVector);

}

// Run the demonstration
runTestsOracleVS().catch(console.error);