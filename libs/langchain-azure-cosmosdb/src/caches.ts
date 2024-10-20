import {
    BaseCache,
    deserializeStoredGeneration,
    getCacheKey,
    serializeGeneration,
} from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";
import {
    AzureCosmosDBNoSQLConfig,
    AzureCosmosDBNoSQLVectorStore,
} from "./index.js";
import { Document } from "@langchain/core/documents";
import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { CosmosClient, CosmosClientOptions } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

const USER_AGENT_SUFFIX = "LangChain-CDBNoSQL-SemanticCache-JavaScript";
/**
 * Represents a Semantic Cache that uses CosmosDB NoSQL backend as the underlying 
 * storage system. It extends the `BaseCache` class and overrides its methods to
 * provide CosmosDBNoSQL-specific logic.
 * 
 * @example
 * ```typescript
 * const embeddings = new OpenAIEmbeddings();
 * const cache = new AzureCosmosDBNoSQLSemanticCache(embeddings, {
 *   databaseName: DATABASE_NAME,
 *   containerName: CONTAINER_NAME
 * });
 * const model = new ChatOpenAI({cache});
 * 
 * // Invoke the model to perform an action
 * const response = await llm.invoke("Do something random!");
 * console.log(response);
 * ```
 */
export class AzureCosmosDBNoSQLSemanticCache extends BaseCache {
    private embeddings: EmbeddingsInterface;
    private config: AzureCosmosDBNoSQLConfig;
    private cacheDict: { [key: string]: AzureCosmosDBNoSQLVectorStore } = {};

    constructor(embeddings: EmbeddingsInterface, dbConfig: AzureCosmosDBNoSQLConfig) {
        super();
        const connectionString =
            dbConfig.connectionString ??
            getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_CONNECTION_STRING");
        const endpoint =
            dbConfig.endpoint ??
            getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_ENDPOINT");

        var client: CosmosClient;
        if (!dbConfig.client) {
            if (connectionString) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                let [endpoint, key] = connectionString!.split(";");
                [, endpoint] = endpoint.split("=");
                [, key] = key.split("=");

                client = new CosmosClient({
                    endpoint,
                    key,
                    userAgentSuffix: USER_AGENT_SUFFIX,
                });
            } else {
                // Use managed identity
                client = new CosmosClient({
                    endpoint,
                    aadCredentials: dbConfig.credentials ?? new DefaultAzureCredential(),
                    userAgentSuffix: USER_AGENT_SUFFIX,
                } as CosmosClientOptions);
            }
            dbConfig.client = client;
        }
        this.embeddings = embeddings;
        this.config = dbConfig;
    }

    private getLlmCache(llmKey: string) {
        const key = getCacheKey(llmKey);
        if (!this.cacheDict[key]) {
            this.cacheDict[key] = new AzureCosmosDBNoSQLVectorStore(
                this.embeddings,
                this.config,
            );
        }
        return this.cacheDict[key];
    }

    /**
     * Retrieves data from the cache. It constructs a cache key from the given
     * `llmKey`, and retrieves the corresponding value based on the prompt 
     * from the Cosmos DB.
     *
     * @param prompt The prompt for lookup.
     * @param llmKey The LLM key used to construct the cache key.
     * @returns An array of Generations if found, null otherwise.
     */
    public async lookup(prompt: string, llmKey: string) {
        const llmCache = this.getLlmCache(llmKey);

        const results = await llmCache.similaritySearch(prompt, 1);
        if (!results.length) return null;

        const generations = results.flatMap(result =>
            result.metadata.return_value.map((gen: string) =>
                deserializeStoredGeneration(JSON.parse(gen))
            )
        );

        return generations.length > 0 ? generations : null;
    }

    /**
     * Updates the cache with new data. It constructs a cache key from the
     * given `prompt` and stores the `value` in the CosmosDB
     * 
     * @param prompt The prompt for update.
     * @param llmKey The LLM key used to construct the cache key.
     * @param value The value to be stored in the cache.
     */
    public async update(
        prompt: string,
        llmKey: string,
        returnValue: Generation[]
    ) {
        const serializedGenerations = returnValue.map(generation =>
            JSON.stringify(serializeGeneration(generation))
        );
        const llmCache = this.getLlmCache(llmKey);
        const metadata = {
            llm_string: llmKey,
            prompt: prompt,
            return_value: serializedGenerations,
        };
        const doc = new Document({
            pageContent: prompt,
            metadata,
        });
        await llmCache.addDocuments([doc]);
    }

    /**
     * deletes the semantic cache for a given llmKey
     * @param llmKey 
     */
    public async clear(llmKey: string) {
        const key = getCacheKey(llmKey);
        if (this.cacheDict[key]) {
            await this.cacheDict[key].delete();
        }
    }
}