import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
    VectorStore,
    MaxMarginalRelevanceSearchOptions,
  } from "@langchain/core/vectorstores";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import * as hanaClient from '@sap/hana-client';


export enum DistanceStrategy {
    COSINE = "COSINE",
    EUCLIDEAN_DISTANCE = "EUCLIDEAN_DISTANCE",
  }

  
const HANA_DISTANCE_FUNCTION: Record<DistanceStrategy, [string, string]> = {
[DistanceStrategy.COSINE]: ["COSINE_SIMILARITY", "DESC"],
[DistanceStrategy.EUCLIDEAN_DISTANCE]: ["L2DISTANCE", "ASC"],
};

const defaultDistanceStrategy = DistanceStrategy.COSINE;
const defaultTableName: string = "EMBEDDINGS";
const defaultContentColumn: string = "VEC_TEXT";
const defaultMetadataColumn: string = "VEC_META";
const defaultVectorColumn: string = "VEC_VECTOR";
const defaultVectorColumnLength: number = -1;  // -1 means dynamic length

interface Filter {
    [key: string]: boolean | string | number;
}


/**
 * Interface defining the arguments required to create an instance of
 * `HanaDB`.
 */
export interface HanaDBArgs {
    connection: hanaClient.Connection;
    distanceStrategy?: DistanceStrategy;
    tableName?: string ;
    contentColumn?: string;
    metadataColumn?: string;
    vectorColumn?: string;
    vectorColumnLength?: number;
}


export class HanaDB extends VectorStore {
    private connection: hanaClient.Connection;
    private distanceStrategy: DistanceStrategy;
    // Compile pattern only once, for better performance
    private static compiledPattern = new RegExp("^[a-zA-Z_][a-zA-Z0-9_]*$");
    private tableName: string;
    private contentColumn: string;
    private metadataColumn: string;
    private vectorColumn: string;
    private vectorColumnLength: number;
    declare FilterType: object | string;
    _vectorstoreType(): string {
        return "hanadb";
    }

    constructor(embeddings: EmbeddingsInterface, args: HanaDBArgs) {
        super(embeddings, args);
        this.distanceStrategy = args.distanceStrategy || defaultDistanceStrategy;
        this.tableName = this.sanitizeName(args.tableName || defaultTableName);
        this.contentColumn = this.sanitizeName(args.contentColumn || defaultContentColumn);
        this.metadataColumn = this.sanitizeName(args.metadataColumn || defaultMetadataColumn);
        this.vectorColumn = this.sanitizeName(args.vectorColumn || defaultVectorColumn);
        this.vectorColumnLength = this.sanitizeInt(args.vectorColumnLength || defaultVectorColumnLength); // Using '??' to allow 0 as a valid value

        this.connection = args.connection;
        // this.initialize();
    }

    public async initialize(): Promise<void> {
        try {
            await this.createTableIfNotExists();
            this.checkColumn(this.tableName, this.contentColumn,["NCLOB", "NVARCHAR"]);
            this.checkColumn(this.tableName, this.metadataColumn, ["NCLOB", "NVARCHAR"]);
            this.checkColumn(this.tableName, this.vectorColumn, ["REAL_VECTOR"], this.vectorColumnLength)
            
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }
    /**
     * Sanitizes the input string by removing characters that are not alphanumeric or underscores.
     * @param inputStr The string to be sanitized.
     * @returns The sanitized string.
     */
    private sanitizeName(inputStr: string): string {
        return inputStr.replace(/[^a-zA-Z0-9_]/g, "").toUpperCase();
    }

    /**
     * Sanitizes the input integer. Throws an error if the value is less than -1.
     * @param inputInt The input to be sanitized.
     * @returns The sanitized integer.
     */
    private sanitizeInt(inputInt: any): number {
        const value = parseInt(inputInt, 10);
        if (isNaN(value) || value < -1) {
            throw new Error(`Value (${value}) must not be smaller than -1`);
        }
        return value;
    }

    /**
     * Sanitizes a list to ensure all elements are floats (numbers in TypeScript).
     * Throws an error if any element is not a number.
     *
     * @param {number[]} embedding - The array of numbers (floats) to be sanitized.
     * @returns {number[]} The sanitized array of numbers (floats).
     * @throws {Error} Throws an error if any element is not a number.
     */
    private sanitizeListFloat(embedding: number[]): number[] {
        embedding.forEach((value) => {
        if (typeof value !== 'number') {
            throw new Error(`Value (${value}) does not have type number`);
        }
        });
        return embedding;
    }

    /**
     * Sanitizes the keys of the metadata object to ensure they match the required pattern.
     * Throws an error if any key does not match the pattern.
     * 
     * @param {Record<string, any>} metadata - The metadata object with keys to be validated.
     * @returns {Record<string, any>} The original metadata object if all keys are valid.
     * @throws {Error} Throws an error if any metadata key is invalid.
     */
    private sanitizeMetadataKeys(metadata: Record<string, any>): Record<string, any> {
        Object.keys(metadata).forEach(key => {
        if (!HanaDB.compiledPattern.test(key)) {
            throw new Error(`Invalid metadata key ${key}`);
        }
        });
        return metadata;
    }

    /**
     * Parses a string representation of a float array and returns an array of numbers.
     * Assumes the input string is formatted like "1.0,2.0,3.0" (without brackets).
     * 
     * @param {string} arrayAsString - The string representation of the array.
     * @returns {number[]} An array of floats parsed from the string.
     */
    private parseFloatArrayFromString(arrayAsString: string): number[] {
        // Removing the leading and trailing brackets is not necessary if the input is "1.0,2.0,3.0"
        // If your input string includes brackets, uncomment the following line:
        // const arrayWithoutBrackets = arrayAsString.slice(1, -1);
        // Use arrayWithoutBrackets.split(",") if you've uncommented the above line.
        return arrayAsString.split(",").map(x => parseFloat(x));
    }
  

    /**
     * Checks if the specified column exists in the table and validates its data type and length.
     * @param tableName The name of the table.
     * @param columnName The name of the column to check.
     * @param columnType The expected data type(s) of the column.
     * @param columnLength The expected length of the column. Optional.
     */
    private async checkColumn(tableName: string, columnName: string, columnType: string | string[], columnLength?: number): Promise<void> {
        const sqlStr = `
            SELECT DATA_TYPE_NAME, LENGTH 
            FROM SYS.TABLE_COLUMNS 
            WHERE SCHEMA_NAME = CURRENT_SCHEMA 
            AND TABLE_NAME = ? 
            AND COLUMN_NAME = ?`;
    
        try {
            const client = this.connection; // Get the connection object
            // Prepare the statement with parameter placeholders
            const stm = client.prepare(sqlStr);
            // Execute the query with actual parameters to avoid SQL injection
            const resultSet = stm.execQuery([tableName, columnName]);
            
            if (!resultSet.next()) {
                throw new Error(`Column ${columnName} does not exist`);
            } else {
                // Safely assert the type of the returned value to string
                const dataType: string = resultSet.getValue(0) as string;
                const length: number = resultSet.getValue(1) as number;
    
                // Check if dataType is within columnType
                const isValidType = Array.isArray(columnType) ? columnType.includes(dataType) : columnType === dataType;
                if (!isValidType) {
                    throw new Error(`Column ${columnName} has the wrong type: ${dataType}`);
                }
    
                // Check length, if parameter was provided
                if (columnLength != null && length !== columnLength) {
                    throw new Error(`Column ${columnName} has the wrong length: ${length}`);
                }
            }
        } catch (error) {
            console.error('Error checking column:', error);
            throw error; // Rethrow or handle as needed
        } finally {
            // Ensure resources are cleaned up properly
            
        }
    }
    
    private async createTableIfNotExists(): Promise<void> {
        const tableExists = await this.tableExists(this.tableName);
        console.log('Table exists:', tableExists);
        if (!tableExists) {
            let sqlStr = `CREATE TABLE ${this.tableName} (` +
                `${this.contentColumn} NCLOB, ` +
                `${this.metadataColumn} NCLOB, ` +
                `${this.vectorColumn} REAL_VECTOR`;

            sqlStr += this.vectorColumnLength === -1 ? ");" : `(${this.vectorColumnLength}));`;
            console.log(sqlStr)
            try {
                const client = this.connection; 
                await client.exec(sqlStr);
            } catch (error) {
                console.error('Error creating table:', error);
                throw error;
            }
        }
    }

    private async tableExists(tableName: string): Promise<boolean> {
        const tableExistsSQL = `SELECT COUNT(*) AS COUNT FROM SYS.TABLES WHERE SCHEMA_NAME = CURRENT_SCHEMA AND TABLE_NAME = '${tableName.toUpperCase()}'`;
        try {
            const client = this.connection; // Get the connection object
            // console.log(tableExistsSQL)
            const stm = client.prepare(tableExistsSQL);
            const resultSet = stm.execQuery();
            while(resultSet.next()) {
                const result = resultSet.getValue(0)
                if (result === 1) {
                    // Table does  exist
                    console.log('Table does exist.');
                    return true;
                }

            }
        } catch (error) {
            console.error('Error checking table existence:', error);
            throw error;
        }
        return false;
    }

    /**
     * Creates a WHERE clause based on the provided filter object.
     * @param filter - A filter object with keys as metadata fields and values as filter values.
     * @returns A tuple containing the WHERE clause string and an array of query parameters.
     */
    private createWhereByFilter(filter?: Filter): [string, Array<string | number>] {
        let queryTuple: Array<string | number> = [];
        let whereStr = "";
        if (filter) {
        Object.keys(filter).forEach((key, i) => {
            whereStr += i === 0 ? " WHERE " : " AND ";
            whereStr += ` JSON_VALUE(${this.metadataColumn}, '$.${key}') = ?`;

            const value = filter[key];
            if (typeof value === "boolean") {
            queryTuple.push(value ? "true" : "false");
            } else if (typeof value === "number" || typeof value === "string") {
            queryTuple.push(value);
            } else {
            throw new Error(`Unsupported filter data-type: ${typeof value}`);
            }
        });
        }

        return [whereStr, queryTuple];
    }

    /**
     * Deletes entries from the table based on the provided filter.
     * @param ids - Optional. Deletion by ids is not supported and will throw an error.
     * @param filter - Optional. A filter object to specify which entries to delete.
     * @throws Error if 'ids' parameter is provided, as deletion by ids is not supported.
     * @throws Error if 'filter' parameter is not provided, as it is required for deletion.
     * to do: adjust the call signature
     */
    public async delete(options: { ids?: string[]; filter?: Filter}): Promise<void> {
        const { ids, filter } = options;
        if (ids) {
            throw new Error("Deletion via IDs is not supported");
        }
        if (!filter) {
        throw new Error("Parameter 'filter' is required when calling 'delete'");
        }

        const [whereStr, queryTuple] = this.createWhereByFilter(filter);
        const sqlStr = `DELETE FROM ${this.tableName}${whereStr}`;
        // console.log(sqlStr, queryTuple)
        try {
        const client = this.connection;
        await client.execute(sqlStr, queryTuple); 
        } 
        finally {

        }
    }

    /**
     * Static method to create a HanaDB instance from raw texts. This method embeds the documents,
     * creates a table if it does not exist, and adds the documents to the table.
     * @param texts Array of text documents to add.
     * @param metadatas Optional metadata for each text document.
     * @param embedding EmbeddingsInterface instance for document embedding.
     * @param dbConfig Configuration for the HanaDB.
     * @returns A Promise that resolves to an instance of HanaDB.
     */
    static async fromTexts(
        texts: string[],
        metadatas: object[] | object,
        embeddings: EmbeddingsInterface,
        dbConfig: HanaDBArgs
    ): Promise<HanaDB> {
        const instance = new HanaDB(
            embeddings,
            dbConfig
        );
        await instance.initialize();
        await instance.addTexts(texts, metadatas); // Embed and add texts to the database
        return instance;
        // return HanaDB.fromDocuments(docs, embeddings, dbConfig);
    }

    /**
     * Instance method to add more texts to the vector store. This method optionally accepts pre-generated embeddings.
     * @param texts Iterable of strings/text to add to the vector store.
     * @param metadatas Optional list of metadata corresponding to each text.
     * @param embeddings Optional pre-generated embeddings for the texts.
     * @returns A Promise that resolves when texts are added successfully.
     */
    async addTexts(texts: string[], metadatas: object[] | object): Promise<void> {
        // Generate embeddings if not provided
        const embeddings = await this.embeddings.embedDocuments(texts);
        // console.log(embeddings)
        const client = this.connection; 

        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            // console.log(text)
            
            const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
            // console.log(metadata)
            // Serialize the 'metadata' object to a JSON string for inclusion in the SQL query
            const metadataJson = JSON.stringify(metadata);
            const embedding = embeddings[i].join(', '); // Convert embedding array to string representation

            // SQL query to insert the document, metadata, and embedding into the table
            const sqlStr = `INSERT INTO ${this.tableName} (${this.contentColumn}, ${this.metadataColumn}, ${this.vectorColumn}) VALUES (?, ?, TO_REAL_VECTOR(?));`;
            // console.log(sqlStr)
            
            await client.execute(sqlStr, [text, metadataJson, `[${embedding}]`]);
        }
    }


    /**
     * Creates an instance of `HanaDB` from an array of
     * Document instances. The documents are added to the database.
     * @param docs List of documents to be converted to vectors.
     * @param embeddings Embeddings instance used to convert the documents to vectors.
     * @param dbConfig Configuration for the HanaDB.
     * @returns Promise that resolves to an instance of `HanaDB`.
     */
    static async fromDocuments(
        docs: Document[],
        embeddings: EmbeddingsInterface,
        dbConfig: HanaDBArgs
    ): Promise<HanaDB> {
        const instance = new this(embeddings, dbConfig);
        await instance.initialize();
        await instance.addDocuments(docs);
        return instance;
    }

    /**
     * Adds an array of documents to the collection. The documents are first
     * converted to vectors using the `embedDocuments` method of the
     * `embeddings` instance.
     * @param documents Array of Document instances to be added to the collection.
     * @returns Promise that resolves when the documents are added.
     */
    async addDocuments(documents: Document[]): Promise<void> {
        const texts = documents.map(doc => doc.pageContent);
        const metadatas = documents.map(doc => doc.metadata);
        return this.addTexts(texts, metadatas);
      }

    /**
     * Adds an array of vectors and corresponding documents to the database.
     * The vectors and documents are batch inserted into the database.
     * @param vectors Array of vectors to be added to the collection.
     * @param documents Array of Document instances corresponding to the vectors.
     * @returns Promise that resolves when the vectors and documents are added.
     */
    async addVectors(vectors: number[][], documents: Document[]): Promise<void> {

    }

    /**
     * Return docs most similar to query.
     * @param query Query text for the similarity search.
     * @param k Number of Documents to return. Defaults to 4.
     * @param filter A dictionary of metadata fields and values to filter by.
                    Defaults to None.
     * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
     */
    async similaritySearch(
        query: string,
        k = 4,
        filter?: Filter
    ): Promise<Document[]> {
        const results = await this.similaritySearchWithScore(query, k, filter);
        // console.log(results)
        return results.map((result) => result[0]);
    }

    /**
     * Return documents and score values most similar to query.
     * @param query Query text for the similarity search.
     * @param k Number of Documents to return. Defaults to 4.
     * @param filter A dictionary of metadata fields and values to filter by.
                    Defaults to None.
     * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
     */
    async similaritySearchWithScore(query: string, k: number = 4, filter?:Filter): Promise<[Document, number][]> {
        const queryEmbedding = await this.embeddings.embedQuery(query);
        return this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
        
    }
    
    /**
     * Return docs most similar to the given embedding.
     * @param query Query text for the similarity search.
     * @param k Number of Documents to return. Defaults to 4.
     * @param filter A dictionary of metadata fields and values to filter by.
                    Defaults to None.
     * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
     */
    async similaritySearchVectorWithScore(queryEmbedding: number[], k: number, filter?: Filter): Promise<[Document, number][]> {
        const wholeResult = await this.similaritySearchWithScoreAndVectorByVector(queryEmbedding, k, filter);
        // Return documents and scores, discarding the vectors
        return wholeResult.map(([doc, score]) => [doc, score]);
    }

    /**
     * Performs a similarity search based on vector comparison and returns documents along with their similarity scores and vectors.
     * @param embedding The vector representation of the query for similarity comparison.
     * @param k The number of top similar documents to return.
     * @param filter Optional filter criteria to apply to the search query.
     * @returns A promise that resolves to an array of tuples, each containing a Document, its similarity score, and its vector.
     */
    async similaritySearchWithScoreAndVectorByVector(embedding: number[], k: number = 4, filter?: Filter): Promise<Array<[Document, number, number[]]>> {
        const result: Array<[Document, number, number[]]> = [];
        // Sanitize inputs
        k = this.sanitizeInt(k);
        embedding = this.sanitizeListFloat(embedding);
        // Determine the distance function based on the configured strategy
        const distanceFuncName = HANA_DISTANCE_FUNCTION[this.distanceStrategy][0];
        console.log("Distance method " + distanceFuncName)
        // Convert the embedding vector to a string for SQL query
        const embeddingAsString = embedding.join(",");
        let sqlStr = `SELECT TOP ${k}
                    ${this.contentColumn}, 
                    ${this.metadataColumn}, 
                    TO_NVARCHAR(${this.vectorColumn}), 
                    ${distanceFuncName}(${this.vectorColumn}, TO_REAL_VECTOR('[${embeddingAsString}]')) AS CS
                    FROM ${this.tableName}`;
        // Add order by clause to sort by similarity
        const orderStr = ` ORDER BY CS ${HANA_DISTANCE_FUNCTION[this.distanceStrategy][1]}`;

        // Prepare and execute the SQL query
        const [whereStr, queryTuple] = this.createWhereByFilter(filter);
        sqlStr += whereStr + orderStr;
        
        const client = this.connection;
        const stm = client.prepare(sqlStr)
        try {
        // const rows = await client.execute(sqlStr, queryTuple);
        // console.log(rows)
        const resultSet = stm.execQuery(queryTuple);
        while(resultSet.next()){
            const metadata = JSON.parse(resultSet.getValue(1));
            const doc: Document = { pageContent: resultSet.getValue(0), metadata };
            const resultVector = this.parseFloatArrayFromString(resultSet.getValue(2));
            result.push([doc, resultSet.getValue(3), resultVector]);  
        }
        } catch (error) {
        console.error("Failed to execute similarity search", error);
        }
        // console.log(result);
        return result;
    }
    

    /**
     * Return documents selected using the maximal marginal relevance.
     * Maximal marginal relevance optimizes for similarity to the query AND
     * diversity among selected documents.
     * @param query Text to look up documents similar to.
     * @param options.k Number of documents to return.
     * @param options.fetchK=20 Number of documents to fetch before passing to
     *     the MMR algorithm.
     * @param options.lambda=0.5 Number between 0 and 1 that determines the
     *     degree of diversity among the results, where 0 corresponds to maximum
     *     diversity and 1 to minimum diversity.
     * @returns List of documents selected by maximal marginal relevance.
     */
    async maxMarginalRelevanceSearch(
        query: string,
        options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
    ): Promise<Document[]> {
        const { k, fetchK = 20, lambda = 0.5} = options;

        const queryEmbedding = await this.embeddings.embedQuery(query);
        const docs = await this.similaritySearchWithScoreAndVectorByVector(
        queryEmbedding,
        fetchK
        );

        //docs is an Array of tuples: [Document, number, number[]]
        const embeddingList = docs.map((doc) => doc[2]); // Extracts the embedding from each tuple

        // Re-rank the results using MMR
        const mmrIndexes = maximalMarginalRelevance(
        queryEmbedding,
        embeddingList,
        lambda,
        k
        );

        const mmrDocs = mmrIndexes.map((index) => docs[index][0]);
        return mmrDocs;
    }



}