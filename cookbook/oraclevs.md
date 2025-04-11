Oracle AI Vector Search with LangchainJS Integration
Introduction
Oracle AI Vector Search enables semantic search on unstructured data while simultaneously providing relational search capabilities on business data, all within a unified system. This approach eliminates the need for a separate vector database, reducing data fragmentation and improving efficiency.

By integrating Oracle AI Vector Search with Langchain, you can build a powerful pipeline for Retrieval Augmented Generation (RAG), leveraging Oracle's robust database features.

Key Advantages of Oracle Database
Oracle AI Vector Search is built on top of the Oracle Database, providing several key features:

Partitioning Support
Real Application Clusters (RAC) Scalability
Exadata Smart Scans
Geographically Distributed Shard Processing
Transactional Capabilities
Parallel SQL
Disaster Recovery
Advanced Security
Oracle Machine Learning
Oracle Graph Database
Oracle Spatial and Graph
Oracle Blockchain
JSON Support
Guide Overview
This guide demonstrates how to integrate Oracle AI Vector Search with Langchain to create an end-to-end RAG pipeline. You'll learn how to:

Load documents from different sources using OracleDocLoader.
Summarize documents inside or outside the database using OracleSummary.
Generate embeddings either inside or outside the database using OracleEmbeddings.
Chunk documents based on specific needs using OracleTextSplitter.
Store, index, and query data using OracleVS.
Getting Started
If you're new to Oracle Database, consider using the free Oracle 23 AI Database to get started.

Best Practices
User Management: Create dedicated users for your Oracle Database projects instead of using the system user for security and control purposes. See the end-to-end guide for more details.
User Privileges: Be sure to manage user privileges effectively to maintain database security. You can find more information in the official Oracle documentation.
Prerequisites
To get started, install the Oracle JavaScript client driver:

``` typescript
npm install oracledb
```

Document Preparation
Assuming you have documents stored in a file system that you want to use with Oracle AI Vector Search and Langchain, these documents need to be instances of langchain/core/documents.

Example: Ingesting JSON Documents
In the following TypeScript example, we demonstrate how to ingest documents from JSON files:

```typescript
private createDocument(row: DataRow): Document {
    const metadata = {
        id: row.id,    
        link: row.link,
    };
    return new Document({ pageContent: row.text, metadata: metadata });
}

public async ingestJson(): Promise<Document[]> {
   try {
       const filePath = `${this.docsDir}${this.filename}`;
       const fileContent = await fs.readFile(filePath, {encoding: 'utf8'});
       const jsonData: DataRow[] = JSON.parse(fileContent);
       return jsonData.map((row) => this.createDocument(row));
   } catch (error) {
       console.error('An error occurred while ingesting JSON:', error);
       throw error; // Rethrow for the calling function to handle
   }
}
```

Langchain and Oracle Integration
The Oracle AI Vector Search Langchain library offers a rich set of APIs for document processing, which includes loading, chunking, summarizing, and embedding generation. Here's how to set up a connection and integrate Oracle with Langchain.

Connecting to Oracle Database
Below is an example of how to connect to an Oracle Database using both a direct connection and a connection pool:

```typescript
async function dbConnect(): Promise<oracledb.Connection> {
    const connection = await oracledb.getConnection({
        user: '****',
        password: '****',
        connectString: '***.**.***.**:1521/****'
    });
    console.log('Connection created...');
    return connection;
}

async function dbPool(): Promise<oracledb.Pool> {
    const pool = await oracledb.createPool({
        user: '****',
        password: '****',
        connectString: '***.**.***.**:1521/****'
    });
    console.log('Connection pool started...');
    return pool;
}
```

Testing the Integration
Here, we demonstrate how to create a test class TestsOracleVS to explore various features of Oracle Vector Store and its integration with Langchain.

Example Test Class
Testing the Integration
Here, we demonstrate how to create a test class TestsOracleVS to explore various features of Oracle Vector Store and its integration with Langchain.

Example Test Class

``` typescript
class TestsOracleVS {
    client: any | null = null;
    embeddingFunction: HuggingFaceTransformersEmbeddings;
    dbConfig: Record<string, any> = {};
    oraclevs!: OracleVS;

    constructor(embeddingFunction: HuggingFaceTransformersEmbeddings) {
        this.embeddingFunction = embeddingFunction;
    }

    async init(): Promise<void> {
        this.client = await dbPool();
        this.dbConfig = {
            "client": this.client,
            "tableName": "some_tablenm",
            "distanceStrategy": DistanceStrategy.DOT_PRODUCT,
            "query": "What are the salient features of OracleDB?"
        };
        this.oraclevs = new OracleVS(this.embeddingFunction, this.dbConfig);
    }

    public async testCreateIndex(): Promise<void> {
        const connection: oracledb.Connection = await dbConnect();
        await createIndex(connection, this.oraclevs, {
            idxName: "IVF",
            idxType: "IVF",
            neighborPart: 64,
            accuracy: 90
        });
        console.log("Index created successfully");
        await connection.close();
    }

    // We are ready to test SimilaritySearchByVector - To this one passes an embedding which is a number array. a k value and a filter. This call returns documents ordered by distance.
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
    
    // This call does the same except that it returns Documents and embeddings.
    public async testSimilaritySearchByVectorReturningEmbeddings(
        embedding: number[],
        k: number = 4,
        filter?: OracleVS["FilterType"],
    ): Promise<[Document, number, Float32Array | number[]][]> {
        return await this.oraclevs.similaritySearchByVectorReturningEmbeddings( embedding, k, filter);
    }
    
    // This call tests out the MaxMarginalRelevanceSearch the parameters are self explanatory. The Callback is reserved for future use.
    public async testMaxMarginalRelevanceSearch(
        query: string,
        options?: MaxMarginalRelevanceSearchOptions<OracleVS["FilterType"]>,
        _callbacks?: Callbacks
    ): Promise<DocumentInterface[]> {
        if (!options) {
            options = { k: 10, fetchK: 20 }; // Default values for the options
        }
        // @ts-ignore
        return this.oraclevs.maxMarginalRelevanceSearch(query, options, _callbacks);
    }
    
    // This call is the same as above except that it takes a vector instead of a query as an argument.
    public async testMaxMarginalRelevanceSearchByVector(
        query: number[],
        options?: MaxMarginalRelevanceSearchOptions<OracleVS["FilterType"]>,
        _callbacks?: Callbacks | undefined
    ): Promise<DocumentInterface[]> {
        if (!options) {
            options = { k: 10, fetchK: 20 }; // Default values for the options
        }
        return this.oraclevs!.maxMarginalRelevanceSearchByVector(query, options, _callbacks);
    }
    
    // This too is the same as above except that it returns document and the score.
    public async testMaxMarginalRelevanceSearchWithScoreByVector(
        embedding: number[],
        options?: MaxMarginalRelevanceSearchOptions<OracleVS["FilterType"]>,
        _callbacks?: Callbacks | undefined
    ): Promise<Array<{ document: Document; score: number }>> {
        if (!options) {
            options = { k: 10, fetchK: 20 }; // Default values for the options
        }
        return this.oraclevs.maxMarginalRelevanceSearchWithScoreByVector(embedding, options, _callbacks)
    }
    
    // This call tests out the delete feature.
    testDelete( params: { ids?: string[], deleteAll?: boolean } ): Promise<void> {
        return this.oraclevs.delete(params);
    }
}

// The runTestOracleVS is the driver to test out each of the calls.
async function runTestsOracleVS() {
    // Initialize dotenv to load environment variables
    dotenv.config();
    const query = "What is the language used by Oracle database";
    
    // Set up the embedding function model: "Xenova/all-MiniLM-L6-v2"
    const embeddingFunction = new HuggingFaceTransformersEmbeddings();
    if (!embeddingFunction) {
        console.error("Failed to initialize the embedding function.");
        return;
    }
    
    if (!(embeddingFunction instanceof Embeddings)) {
        console.error("Embedding function is not an instance of Embeddings.");
        return;
    }
    
    console.log("Embedding function initialized successfully");
    
    // Initialize the TestsOracleVS class
    const testsOracleVS = new TestsOracleVS("concepts23c_small.json",
    embeddingFunction);
    
    // Initialize connection and other setup
    await testsOracleVS.init();
    
    // Ingest JSON data to create documents
    const documents = await testsOracleVS.testIngestJson();
    await OracleVS.fromDocuments(
        documents,
        testsOracleVS.embeddingFunction,
        testsOracleVS.dbConfig
    )
    
    // Create an index
    await testsOracleVS.testCreateIndex();
    
    // Assume some dummy embedding vector for demonstration
    // const embedding: number[] = [0.1, 0.2, 0.3, 0.4]; // Example embedding
    
    // Perform a similarity search by vector
    const embedding = await embeddingFunction.embedQuery(query);
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
    await testsOracleVS.testMaxMarginalRelevanceSearchByVector(embedding)
    console.log("Max Marginal Relevance Search By Vector:", maxMarginalRelevanceSearchByVector);
    
    const maxMarginalRelevanceSearchWithScoreByVector =
    await testsOracleVS.testMaxMarginalRelevanceSearchWithScoreByVector(embedding)
    console.log("Max Marginal Relevance Search By Vector:", maxMarginalRelevanceSearchWithScoreByVector);
    
}
```
That is all for now.