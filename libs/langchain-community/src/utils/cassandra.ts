import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";

import {
  Client,
  DseClientOptions,
  types as driverTypes,
} from "cassandra-driver";

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/* =====================================================================================================================
 * =====================================================================================================================
 * Cassandra Client Factory
 * =====================================================================================================================
 * =====================================================================================================================
 */

/**
 * Defines the configuration options for connecting to Astra DB, DataStax's cloud-native Cassandra-as-a-Service.
 * This interface specifies the necessary parameters required to establish a connection with an Astra DB instance,
 * including authentication and targeting specific data centers or regions.
 *
 * Properties:
 * - `token`: The authentication token required for accessing the Astra DB instance. Essential for establishing a secure connection.
 * - `endpoint`: Optional. The URL or network address of the Astra DB instance. Can be used to directly specify the connection endpoint.
 * - `datacenterID`: Optional. The unique identifier of the data center to connect to. Used to compute the endpoint.
 * - `regionName`: Optional. The region name of the Astra DB instance. Used to compute the endpoint. Default to the primary region.
 * - `bundleUrlTemplate`: Optional. The URL template for downloading the secure connect bundle. Used to customize the bundle URL. "database_id" variable will be resolved at runtime.
 *
 * Either `endpoint` or `datacenterID` must be provided to establish a connection to Astra DB.
 */
export interface AstraServiceProviderArgs {
  token: string;
  endpoint?: string | URL;
  datacenterID?: string;
  regionName?: string;
  bundleUrlTemplate?: string;
}

/**
 * Encapsulates the service provider-specific arguments required for creating a Cassandra client.
 * This interface acts as a wrapper for configurations pertaining to various Cassandra service providers,
 * allowing for extensible and flexible client configuration.
 *
 * Currently, it supports:
 * - `astra`: Optional. Configuration parameters specific to Astra DB, DataStax's cloud-native Cassandra service.
 *            Utilizing this property enables tailored connections to Astra DB instances with custom configurations.
 *
 * This structure is designed to be extended with additional service providers in the future, ensuring adaptability
 * and extensibility for connecting to various Cassandra services with distinct configuration requirements.
 */
export interface CassandraServiceProviderArgs {
  astra?: AstraServiceProviderArgs;
}

/**
 * Extends the DataStax driver's client options with additional configurations for service providers,
 * enabling the customization of Cassandra client instances based on specific service requirements.
 * This interface integrates native driver configurations with custom extensions, facilitating the
 * connection to Cassandra databases, including managed services like Astra DB.
 *
 * - `serviceProviderArgs`: Optional. Contains the connection arguments for specific Cassandra service providers,
 *                           such as Astra DB. This allows for detailed and service-specific client configurations,
 *                           enhancing connectivity and functionality across different Cassandra environments.
 *
 * Incorporating this interface into client creation processes ensures a comprehensive setup, encompassing both
 * standard and extended options for robust and versatile Cassandra database interactions.
 */
export interface CassandraClientArgs extends DseClientOptions {
  serviceProviderArgs?: CassandraServiceProviderArgs;
}

/**
 * Provides a centralized and streamlined factory for creating and configuring instances of the Cassandra client.
 * This class abstracts the complexities involved in instantiating and configuring Cassandra client instances,
 * enabling straightforward integration with Cassandra databases. It supports customization through various
 * configuration options, allowing for the creation of clients tailored to specific needs, such as connecting
 * to different clusters or utilizing specialized authentication and connection options.
 *
 * Key Features:
 * - Simplifies the Cassandra client creation process with method-based configurations.
 * - Supports customization for connecting to various Cassandra environments, including cloud-based services like Astra.
 * - Ensures consistent and optimal client configuration, incorporating best practices.
 *
 * Example Usage (Apache Cassandra®):
 * ```
 * const cassandraArgs = {
 *   contactPoints: ['h1', 'h2'],
 *   localDataCenter: 'datacenter1',
 *   credentials: {
 *     username: <...> as string,
 *     password: <...> as string,
 *   },
 * };
 * const cassandraClient = CassandraClientFactory.getClient(cassandraArgs);
 * ```
 *
 * Example Usage (DataStax AstraDB):
 * ```
 * const astraArgs = {
 *   serviceProviderArgs: {
 *     astra: {
 *       token: <...> as string,
 *       endpoint: <...> as string,
 *     },
 *   },
 * };
 * const cassandraClient = CassandraClientFactory.getClient(astraArgs);
 * ``` *
 */
export class CassandraClientFactory {
  /**
   * Asynchronously obtains a configured Cassandra client based on the provided arguments.
   * This method processes the given CassandraClientArgs to produce a configured Client instance
   * from the cassandra-driver, suitable for interacting with Cassandra databases.
   *
   * @param args The configuration arguments for the Cassandra client, including any service provider-specific options.
   * @returns A Promise resolving to a Client object configured according to the specified arguments.
   */
  public static async getClient(args: CassandraClientArgs): Promise<Client> {
    const modifiedArgs = await this.processArgs(args);
    return new Client(modifiedArgs);
  }

  /**
   * Processes the provided CassandraClientArgs for creating a Cassandra client.
   *
   * @param args The arguments for creating the Cassandra client, including service provider configurations.
   * @returns A Promise resolving to the processed CassandraClientArgs, ready for client initialization.
   * @throws Error if the configuration is unsupported, specifically if serviceProviderArgs are provided
   * but do not include valid configurations for Astra.
   */
  private static processArgs(
    args: CassandraClientArgs
  ): Promise<CassandraClientArgs> {
    if (!args.serviceProviderArgs) {
      return Promise.resolve(args);
    }

    if (args.serviceProviderArgs && args.serviceProviderArgs.astra) {
      return CassandraClientFactory.processAstraArgs(args);
    }

    throw new Error("Unsupported configuration for Cassandra client.");
  }

  /**
   * Asynchronously processes and validates the Astra service provider arguments within the
   * Cassandra client configuration. This includes ensuring the presence of necessary Astra
   * configurations like endpoint or datacenterID, setting up default secure connect bundle paths,
   * and initializing default credentials if not provided.
   *
   * @param args The arguments for creating the Cassandra client with Astra configurations.
   * @returns A Promise resolving to the modified CassandraClientArgs with Astra configurations processed.
   * @throws Error if Astra configuration is incomplete or if both endpoint and datacenterID are missing.
   */
  private static async processAstraArgs(
    args: CassandraClientArgs
  ): Promise<CassandraClientArgs> {
    const astraArgs = args.serviceProviderArgs?.astra;
    if (!astraArgs) {
      throw new Error("Astra configuration is not provided in args.");
    }

    if (!astraArgs.endpoint && !astraArgs.datacenterID) {
      throw new Error(
        "Astra endpoint or datacenterID must be provided in args."
      );
    }

    // Extract datacenterID and regionName from endpoint if provided
    if (astraArgs.endpoint) {
      const endpoint = new URL(astraArgs.endpoint.toString());
      const hostnameParts = endpoint.hostname.split("-");
      const domainSuffix = ".apps.astra.datastax.com";

      if (hostnameParts[hostnameParts.length - 1].endsWith(domainSuffix)) {
        astraArgs.datacenterID =
          astraArgs.datacenterID || hostnameParts.slice(0, 5).join("-");

        // Extract regionName by joining elements from index 5 to the end, and then remove the domain suffix
        const fullRegionName = hostnameParts.slice(5).join("-");
        astraArgs.regionName =
          astraArgs.regionName || fullRegionName.replace(domainSuffix, "");
      }
    }

    // Initialize cloud configuration if not already defined
    const modifiedArgs = {
      ...args,
      cloud: args.cloud || { secureConnectBundle: "" },
    };

    // Set default bundle location if it is not set
    if (!modifiedArgs.cloud.secureConnectBundle) {
      modifiedArgs.cloud.secureConnectBundle =
        await CassandraClientFactory.getAstraDefaultBundleLocation(astraArgs);
    }

    // Ensure secure connect bundle exists
    await CassandraClientFactory.setAstraBundle(
      astraArgs,
      modifiedArgs.cloud.secureConnectBundle
    );

    // Ensure credentials are set
    modifiedArgs.credentials = modifiedArgs.credentials || {
      username: "token",
      password: astraArgs.token,
    };

    return modifiedArgs;
  }

  /**
   * Get the default bundle filesystem location for the Astra Secure Connect Bundle.
   *
   * @param astraArgs The Astra service provider arguments.
   * @returns The default bundle file path.
   */
  private static async getAstraDefaultBundleLocation(
    astraArgs: AstraServiceProviderArgs
  ): Promise<string> {
    const dir = path.join(os.tmpdir(), "cassandra-astra");
    await fs.mkdir(dir, { recursive: true });

    let scbFileName = `astra-secure-connect-${astraArgs.datacenterID}`;
    if (astraArgs.regionName) {
      scbFileName += `-${astraArgs.regionName}`;
    }
    scbFileName += ".zip";
    const scbPath = path.join(dir, scbFileName);

    return scbPath;
  }

  /**
   * Ensures the Astra secure connect bundle specified by the path exists and is up to date.
   * If the file does not exist or is deemed outdated (more than 360 days old), a new secure
   * connect bundle is downloaded and saved to the specified path.
   *
   * @param astraArgs The Astra service provider arguments, including the datacenterID and optional regionName.
   * @param scbPath The path (or URL) where the secure connect bundle is expected to be located.
   * @returns A Promise that resolves when the secure connect bundle is verified or updated successfully.
   * @throws Error if the bundle cannot be retrieved or saved to the specified path.
   */
  private static async setAstraBundle(
    astraArgs: AstraServiceProviderArgs,
    scbPath: string | URL
  ): Promise<void> {
    // If scbPath is a URL, we assume the URL is correct and do nothing further.
    // But if it is a string, we need to check if the file exists and download it if necessary.
    if (typeof scbPath === "string") {
      try {
        // Check if the file exists
        const stats = await fs.stat(scbPath);

        // Calculate the age of the file in days
        const fileAgeInDays =
          (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        // File is more than 360 days old, download a fresh copy
        if (fileAgeInDays > 360) {
          await CassandraClientFactory.downloadAstraSecureConnectBundle(
            astraArgs,
            scbPath
          );
        }
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          // Handle file not found error (ENOENT)
          await CassandraClientFactory.downloadAstraSecureConnectBundle(
            astraArgs,
            scbPath
          );
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Downloads the Astra secure connect bundle based on the provided Astra service provider arguments
   * and saves it to the specified file path. If a regionName is specified and matches one of the
   * available bundles, the regional bundle is preferred. Otherwise, the first available bundle URL is used.
   *
   * @param astraArgs - The Astra service provider arguments, including datacenterID and optional regionName.
   * @param scbPath - The file path where the secure connect bundle should be saved.
   * @returns A promise that resolves once the secure connect bundle is successfully downloaded and saved.
   * @throws Error if there's an issue retrieving the bundle URLs or saving the bundle to the file path.
   */
  private static async downloadAstraSecureConnectBundle(
    astraArgs: AstraServiceProviderArgs,
    scbPath: string
  ): Promise<void> {
    if (!astraArgs.datacenterID) {
      throw new Error("Astra datacenterID is not provided in args.");
    }

    // First POST request gets all bundle locations for the database_id
    const bundleURLTemplate = astraArgs.bundleUrlTemplate
      ? astraArgs.bundleUrlTemplate
      : "https://api.astra.datastax.com/v2/databases/{database_id}/secureBundleURL?all=true";
    const url = bundleURLTemplate.replace(
      "{database_id}",
      astraArgs.datacenterID
    );
    const postResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${astraArgs.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!postResponse.ok) {
      throw new Error(`HTTP error! Status: ${postResponse.status}`);
    }

    const postData = await postResponse.json();
    if (!postData || !Array.isArray(postData) || postData.length === 0) {
      throw new Error("Failed to get secure bundle URLs.");
    }

    // Find the download URL for the region, if specified
    let { downloadURL } = postData[0];
    if (astraArgs.regionName) {
      const regionalBundle = postData.find(
        (bundle) => bundle.region === astraArgs.regionName
      );
      if (regionalBundle) {
        downloadURL = regionalBundle.downloadURL;
      }
    }

    // GET request to download the file itself, and write to disk
    const getResponse = await fetch(downloadURL);
    if (!getResponse.ok) {
      throw new Error(`HTTP error! Status: ${getResponse.status}`);
    }
    const bundleData = await getResponse.arrayBuffer();
    await fs.writeFile(scbPath, Buffer.from(bundleData));
  }
}

/* =====================================================================================================================
 * =====================================================================================================================
 * Cassandra Table
 * =====================================================================================================================
 * =====================================================================================================================
 */

/**
 * Represents the definition of a column within a Cassandra table schema.
 * This interface is used to specify the properties of table columns during table creation
 * and to define how columns are utilized in select queries.
 *
 * Properties:
 * - `name`: The name of the column.
 * - `type`: The data type of the column, used during table creation to define the schema.
 * - `partition`: Optional. Specifies whether the column is part of the partition key. Important for table creation.
 * - `alias`: Optional. An alias for the column that can be used in select queries for readability or to avoid naming conflicts.
 * - `binds`: Optional. Specifies values to be bound to the column in queries, supporting parameterized query construction.
 *
 */
export interface Column {
  name: string;

  // Used by 'create'
  type: string;
  partition?: boolean;

  // Used by 'select'
  alias?: string;
  binds?: unknown | [unknown, ...unknown[]];
}

/**
 * Defines an index on a Cassandra table column, facilitating efficient querying by column values.
 * This interface specifies the necessary configuration for creating secondary indexes on table columns,
 * enhancing query performance and flexibility.
 *
 * Properties:
 * - `name`: The name of the index. Typically related to the column it indexes for clarity.
 * - `value`: The name of the column on which the index is created.
 * - `options`: Optional. Custom options for the index, specified as a string. This can include various index
 *               configurations supported by Cassandra, such as using specific indexing classes or options.
 *
 */
export interface Index {
  name: string;
  value: string;
  options?: string;
}

/**
 * Represents a filter condition used in constructing WHERE clauses for querying Cassandra tables.
 * Filters specify the criteria used to select rows from a table, based on column values.
 *
 * Properties:
 * - `name`: The name of the column to filter on.
 * - `value`: The value(s) to match against the column. Can be a single value or an array of values for operations like IN.
 * - `operator`: Optional. The comparison operator to use (e.g., '=', '<', '>', 'IN'). Defaults to '=' if not specified.
 *
 */
export interface Filter {
  name: string;
  value: unknown | [unknown, ...unknown[]];
  operator?: string;
}

/**
 * Defines a type for specifying WHERE clause conditions in Cassandra queries.
 * This can be a single `Filter` object, an array of `Filter` objects for multiple conditions,
 * or a `Record<string, unknown>` for simple equality conditions keyed by column name.
 */
export type WhereClause = Filter[] | Filter | Record<string, unknown>;

/**
 * Defines the configuration arguments for initializing a Cassandra table within an application.
 * This interface extends `AsyncCallerParams`, incorporating asynchronous operation configurations,
 * and adds specific properties for table creation, query execution, and data manipulation in a
 * Cassandra database context.
 *
 * Properties:
 * - `table`: The name of the table to be used or created.
 * - `keyspace`: The keyspace within which the table exists or will be created.
 * - `primaryKey`: Specifies the column(s) that constitute the primary key of the table. This can be a single
 *                 `Column` object for a simple primary key or an array of `Column` objects for composite keys.
 * - `nonKeyColumns`: Defines columns that are not part of the primary key. Similar to `primaryKey`, this can be a
 *                    single `Column` object or an array of `Column` objects, supporting flexible table schema definitions.
 * - `withClause`: Optional. A string containing additional CQL table options to be included in the CREATE TABLE statement.
 *                 This enables the specification of various table behaviors and properties, such as compaction strategies
 *                 and TTL settings.
 * - `indices`: Optional. An array of `Index` objects defining secondary indices on the table for improved query performance
 *               on non-primary key columns.
 * - `batchSize`: Optional. Specifies the default size of batches for batched write operations to the table, affecting
 *                performance and consistency trade-offs.
 *
 */
export interface CassandraTableArgs extends AsyncCallerParams {
  table: string;
  keyspace: string;
  primaryKey: Column | Column[];
  nonKeyColumns: Column | Column[];
  withClause?: string;
  indices?: Index[];
  batchSize?: number;
}

/**
 * Represents a Cassandra table, encapsulating functionality for schema definition, data manipulation, and querying.
 * This class provides a high-level abstraction over Cassandra's table operations, including creating tables,
 * inserting, updating, selecting, and deleting records. It leverages the CassandraClient for executing
 * operations and supports asynchronous interactions with the database.
 *
 * Key features include:
 * - Table and keyspace management: Allows for specifying table schema, including primary keys, columns,
 *   and indices, and handles the creation of these elements within the specified keyspace.
 * - Data manipulation: Offers methods for inserting (upserting) and deleting data in batches or individually,
 *   with support for asynchronous operation and concurrency control.
 * - Querying: Enables selecting data with flexible filtering, sorting, and pagination options.
 *
 * The class is designed to be instantiated with a set of configuration arguments (`CassandraTableArgs`)
 * that define the table's structure and operational parameters, providing a streamlined interface for
 * interacting with Cassandra tables in a structured and efficient manner.
 *
 * Usage Example:
 * ```typescript
 * const tableArgs: CassandraTableArgs = {
 *   table: 'my_table',
 *   keyspace: 'my_keyspace',
 *   primaryKey: [{ name: 'id', type: 'uuid', partition: true }],
 *   nonKeyColumns: [{ name: 'data', type: 'text' }],
 * };
 * const cassandraClient = new CassandraClient(clientConfig);
 * const myTable = new CassandraTable(tableArgs, cassandraClient);
 * ```
 *
 * This class simplifies Cassandra database interactions, making it easier to perform robust data operations
 * while maintaining clear separation of concerns and promoting code reusability.
 */
export class CassandraTable {
  private client: Client;

  private readonly keyspace: string;

  private readonly table: string;

  private primaryKey: Column[];

  private nonKeyColumns: Column[];

  private indices: Index[];

  private withClause: string;

  private batchSize: number;

  private initializationPromise: Promise<void> | null = null;

  private asyncCaller: AsyncCaller;

  private constructorArgs: CassandraTableArgs;

  /**
   * Initializes a new instance of the CassandraTable class with specified configuration.
   * This includes setting up the table schema (primary key, columns, and indices) and
   * preparing the environment for executing queries against a Cassandra database.
   *
   * @param args Configuration arguments defining the table schema and operational settings.
   * @param client Optional. A Cassandra Client instance. If not provided, one will be created
   *               using the configuration specified in `args`.
   */
  constructor(args: CassandraTableArgs, client?: Client) {
    const {
      keyspace,
      table,
      primaryKey,
      nonKeyColumns,
      withClause = "",
      indices = [],
      batchSize = 1,
      maxConcurrency = 25,
    } = args;

    // Set constructor args, which would include default values
    this.constructorArgs = {
      withClause,
      indices,
      batchSize,
      maxConcurrency,
      ...args,
    };

    this.asyncCaller = new AsyncCaller(this.constructorArgs);

    // Assign properties
    this.keyspace = keyspace;
    this.table = table;
    this.primaryKey = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
    this.nonKeyColumns = Array.isArray(nonKeyColumns)
      ? nonKeyColumns
      : [nonKeyColumns];
    this.withClause = withClause.trim().replace(/^with\s*/i, "");
    this.indices = indices;
    this.batchSize = batchSize;

    // Start initialization but don't wait for it to complete here
    this.initialize(client).catch((error) => {
      console.error("Error during CassandraStore initialization:", error);
    });
  }

  /**
   * Executes a SELECT query on the Cassandra table with optional filtering, ordering, and pagination.
   * Allows for specifying columns to return, filter conditions, sort order, and limits on the number of results.
   *
   * @param columns Optional. Columns to include in the result set. If omitted, all columns are selected.
   * @param filter Optional. Conditions to apply to the query for filtering results.
   * @param orderBy Optional. Criteria to sort the result set.
   * @param limit Optional. Maximum number of records to return.
   * @param allowFiltering Optional. Enables ALLOW FILTERING option for queries that cannot be executed directly due to Cassandra's query restrictions.
   * @param fetchSize Optional. The number of rows to fetch per page (for pagination).
   * @param pagingState Optional. The paging state from a previous query execution, used for pagination.
   * @returns A Promise resolving to the query result set.
   */
  async select(
    columns?: Column[],
    filter?: WhereClause,
    orderBy?: Filter[],
    limit?: number,
    allowFiltering?: boolean,
    fetchSize?: number,
    pagingState?: string
  ): Promise<driverTypes.ResultSet> {
    await this.initialize();

    // Ensure we have an array of Filter from the public interface
    const filters = this.asFilters(filter);

    // If no columns are specified, use all columns
    const queryColumns = columns || [...this.primaryKey, ...this.nonKeyColumns];

    const queryStr = this.buildSearchQuery(
      queryColumns,
      filters,
      orderBy,
      limit,
      allowFiltering
    );

    const queryParams = [];

    queryColumns.forEach(({ binds }) => {
      if (binds !== undefined && binds !== null) {
        if (Array.isArray(binds)) {
          queryParams.push(...binds);
        } else {
          queryParams.push(binds);
        }
      }
    });

    if (filters) {
      filters.forEach(({ value }) => {
        if (Array.isArray(value)) {
          queryParams.push(...value);
        } else {
          queryParams.push(value);
        }
      });
    }

    if (orderBy) {
      orderBy.forEach(({ value }) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            queryParams.push(...value);
          } else {
            queryParams.push(value);
          }
        }
      });
    }

    if (limit) {
      queryParams.push(limit);
    }

    const execOptions = {
      prepare: true,
      fetchSize: fetchSize || undefined,
      pageState: pagingState || undefined,
    };

    return this.client.execute(queryStr, queryParams, execOptions);
  }

  /**
   * Validates the correspondence between provided values and specified columns for database operations.
   * This method checks if the number of values matches the number of specified columns, ensuring
   * data integrity before executing insert or update operations. It also defaults to using all table columns
   * if specific columns are not provided. Throws an error if the validation fails.
   *
   * @param values An array of values or an array of arrays of values to be inserted or updated. Each
   *               inner array represents a set of values corresponding to one row in the table.
   * @param columns Optional. An array of `Column` objects specifying the columns to be used for the operation.
   *                If not provided, the method defaults to using both primary key and non-key columns of the table.
   * @returns An array of `Column` objects that have been validated for the operation.
   * @throws Error if the number of provided values does not match the number of specified columns.
   * @private
   */
  private _columnCheck(
    values: unknown[] | unknown[][],
    columns?: Column[]
  ): Column[] {
    const cols = columns || [...this.primaryKey, ...this.nonKeyColumns];

    if (!cols || cols.length === 0) {
      throw new Error("Columns must be specified.");
    }

    const firstValueSet = Array.isArray(values[0]) ? values[0] : values;

    if (firstValueSet && firstValueSet.length !== cols.length) {
      throw new Error("The number of values must match the number of columns.");
    }

    return cols;
  }

  /**
   * Inserts or updates records in the Cassandra table in batches, managing concurrency and batching size.
   * This method organizes the provided values into batches and uses `_upsert` to perform the database operations.
   *
   * @param values An array of arrays, where each inner array contains values for a single record.
   * @param columns Optional. Columns to be included in the insert/update operations. Defaults to all table columns.
   * @param batchSize Optional. The size of each batch for the operation. Defaults to the class's batchSize property.
   * @returns A Promise that resolves once all records have been upserted.
   */
  async upsert(
    values: unknown[][],
    columns?: Column[],
    batchSize: number = this.batchSize
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }

    // Ensure the store is initialized before proceeding
    await this.initialize();

    const upsertColumns = this._columnCheck(values, columns);

    // Initialize an array to hold promises for each batch insert
    const upsertPromises: Promise<void>[] = [];

    // Buffers to hold the current batch of vectors and documents
    let currentBatch: unknown[][] = [];

    // Loop through each vector/document pair to insert; we use
    // <= vectors.length to ensure the last batch is inserted
    for (let i = 0; i <= values.length; i += 1) {
      // Check if we're still within the array boundaries
      if (i < values.length) {
        // Add the current vector and document to the batch
        currentBatch.push(values[i]);
      }

      // Check if we've reached the batch size or end of the array
      if (currentBatch.length >= batchSize || i === values.length) {
        // Only proceed if there are items in the current batch
        if (currentBatch.length > 0) {
          // Create copies of the current batch arrays to use in the async insert operation
          const batch = [...currentBatch];

          // Execute the insert using the AsyncCaller - it will handle concurrency and queueing.
          upsertPromises.push(
            this.asyncCaller.call(() => this._upsert(batch, upsertColumns))
          );

          // Clear the current buffers for the next iteration
          currentBatch = [];
        }
      }
    }

    // Wait for all insert operations to complete.
    await Promise.all(upsertPromises);
  }

  /**
   * Deletes rows from the Cassandra table that match the specified WHERE clause conditions.
   *
   * @param whereClause Defines the conditions that must be met for rows to be deleted. Can be a single filter,
   * an array of filters, or a key-value map translating to filter conditions.
   * @returns A Promise that resolves when the DELETE operation has completed.
   */
  async delete(whereClause: WhereClause) {
    await this.initialize();

    const filters = this.asFilters(whereClause);

    const queryStr = `DELETE FROM ${this.keyspace}.${
      this.table
    } ${this.buildWhereClause(filters)}`;

    const queryParams = filters.flatMap(({ value }) => {
      if (Array.isArray(value)) {
        return value;
      } else {
        return [value];
      }
    });

    return this.client.execute(queryStr, queryParams, {
      prepare: true,
    });
  }

  /**
   * Retrieves the Node.js Cassandra client instance associated with this table.
   * This method ensures that the client is initialized and ready for use, returning the
   * Cassandra client object that can be used for database operations directly.
   * It initializes the client if it has not already been initialized.
   *
   * @returns A Promise that resolves to the Cassandra Client instance used by this table for database interactions.
   */
  async getClient() {
    await this.initialize();
    return this.client;
  }

  /**
   * Constructs the PRIMARY KEY clause for a Cassandra CREATE TABLE statement based on the specified columns.
   * This method organizes the provided columns into partition and clustering keys, forming the necessary syntax
   * for the PRIMARY KEY clause in a Cassandra table schema definition. It supports complex primary key structures,
   * including composite partition keys and clustering columns.
   *
   * - Partition columns are those marked with the `partition` property. If multiple partition columns are provided,
   *   they are grouped together in parentheses as a composite partition key.
   * - Clustering columns are those not marked as partition keys and are listed after the partition key(s).
   *   They determine the sort order of rows within a partition.
   *
   * The method ensures the correct syntax for primary keys, handling both simple and composite key structures,
   * and throws an error if no partition or clustering columns are provided.
   *
   * @param columns An array of `Column` objects representing the columns to be included in the primary key.
   *                Each column must have a `name` and may have a `partition` boolean indicating if it is part
   *                of the partition key.
   * @returns The PRIMARY KEY clause as a string, ready to be included in a CREATE TABLE statement.
   * @throws Error if no columns are marked as partition keys or if no columns are provided.
   * @private
   */
  private buildPrimaryKey(columns: Column[]): string {
    // Partition columns may be specified with optional attribute col.partition
    const partitionColumns = columns
      .filter((col) => col.partition)
      .map((col) => col.name)
      .join(", ");

    // All columns not part of the partition key are clustering columns
    const clusteringColumns = columns
      .filter((col) => !col.partition)
      .map((col) => col.name)
      .join(", ");

    let primaryKey = "";

    // If partition columns are specified, they are included in a () wrapper
    // If not, the clustering columns are used, and the first clustering column
    // is the partition key per normal Cassandra behaviour.
    if (partitionColumns && clusteringColumns) {
      primaryKey = `PRIMARY KEY ((${partitionColumns}), ${clusteringColumns})`;
    } else if (partitionColumns) {
      primaryKey = `PRIMARY KEY (${partitionColumns})`;
    } else if (clusteringColumns) {
      primaryKey = `PRIMARY KEY (${clusteringColumns})`;
    } else {
      throw new Error(
        "No partition or clustering columns provided for PRIMARY KEY definition."
      );
    }

    return primaryKey;
  }

  /**
   * Type guard that checks if a given object conforms to the `Filter` interface.
   * This method is used to determine if an object can be treated as a filter for Cassandra
   * query conditions. It evaluates the object's structure, specifically looking for `name`
   * and `value` properties, which are essential for defining a filter in Cassandra queries.
   *
   * @param obj The object to be evaluated.
   * @returns A boolean value indicating whether the object is a `Filter`. Returns `true`
   *          if the object has both `name` and `value` properties, signifying it meets the
   *          criteria for being used as a filter in database operations; otherwise, returns `false`.
   * @private
   */
  private isFilter(obj: unknown): obj is Filter {
    return (
      typeof obj === "object" && obj !== null && "name" in obj && "value" in obj
    );
  }

  /**
   * Helper to convert Record<string,unknown> to a Filter[]
   * @param record: a key-value Record collection
   * @returns Record as a Filter[]
   */
  private convertToFilters(record: Record<string, unknown>): Filter[] {
    return Object.entries(record).map(([name, value]) => ({
      name,
      value,
      operator: "=",
    }));
  }

  /**
   * Converts a key-value pair record into an array of `Filter` objects suitable for Cassandra query conditions.
   * This utility method allows for a more flexible specification of filter conditions by transforming
   * a simple object notation into the structured format expected by Cassandra query builders. Each key-value
   * pair in the record is interpreted as a filter condition, where the key represents the column name and
   * the value represents the filtering criterion.
   *
   * The method assumes a default equality operator for each filter. It is particularly useful for
   * converting concise filter specifications into the detailed format required for constructing CQL queries.
   *
   * @param record A key-value pair object where each entry represents a filter condition, with the key
   *               as the column name and the value as the filter value. The value can be a single value
   *               or an array to support IN queries with multiple criteria.
   * @returns An array of `Filter` objects, each representing a condition extracted from the input record.
   *          The array can be directly used in constructing query WHERE clauses.
   * @private
   */
  private asFilters(record: WhereClause | undefined): Filter[] {
    if (!record) {
      return [];
    }

    // If record is already an array
    if (Array.isArray(record)) {
      return record.flatMap((item) => {
        // Check if item is a Filter before passing it to convertToFilters
        if (this.isFilter(item)) {
          return [item];
        } else {
          // Here item is treated as Record<string, unknown>
          return this.convertToFilters(item);
        }
      });
    }

    // If record is a single Filter object, return it in an array
    if (this.isFilter(record)) {
      return [record];
    }

    // If record is a Record<string, unknown>, convert it to an array of Filter
    return this.convertToFilters(record);
  }

  /**
   * Constructs the WHERE clause of a CQL query from an array of `Filter` objects.
   * This method generates the conditional part of a Cassandra Query Language (CQL) statement,
   * allowing for complex query constructions based on provided filters. Each filter in the array
   * translates into a condition within the WHERE clause, with support for various comparison operators.
   *
   * The method handles the assembly of these conditions into a syntactically correct CQL WHERE clause,
   * including the appropriate use of placeholders (?) for parameter binding in prepared statements.
   * It supports a range of operators, defaulting to "=" (equality) if an operator is not explicitly specified
   * in a filter. Filters with multiple values (e.g., for IN conditions) are also correctly formatted.
   *
   * @param filters Optional. An array of `Filter` objects representing the conditions to apply in the WHERE clause.
   *                Each `Filter` includes a column name (`name`), a value or array of values (`value`), and optionally,
   *                an operator (`operator`). If no filters are provided, an empty string is returned.
   * @returns The constructed WHERE clause as a string, ready to be appended to a CQL query. If no filters
   *          are provided, returns an empty string, indicating no WHERE clause should be applied.
   * @private
   */
  private buildWhereClause(filters?: Filter[]): string {
    if (!filters || filters.length === 0) {
      return "";
    }

    const whereConditions = filters.map(({ name, operator = "=", value }) => {
      // Normalize the operator to handle case-insensitive comparison
      const normalizedOperator = operator.toUpperCase();

      // Convert value to an array if it's not one, to simplify processing
      const valueArray = Array.isArray(value) ? value : [value];

      if (valueArray.length === 1 && normalizedOperator !== "IN") {
        return `${name} ${operator} ?`;
      } else {
        // Remove quoted strings from 'name' to prevent counting '?' inside quotes as placeholders
        const quotesPattern = /'[^']*'|"[^"]*"/g;
        const modifiedName = name.replace(quotesPattern, "");
        const nameQuestionMarkCount = (modifiedName.match(/\?/g) || []).length;

        // Check if there are enough elements in the array for the right side of the operator,
        // adjusted for any '?' placeholders within the 'name' itself
        if (valueArray.length < nameQuestionMarkCount + 1) {
          throw new Error(
            "Insufficient bind variables for the filter condition."
          );
        }

        // Generate placeholders, considering any '?' placeholders that might have been part of 'name'
        const effectiveLength = Math.max(
          valueArray.length - nameQuestionMarkCount,
          1
        );
        const placeholders = new Array(effectiveLength).fill("?").join(", ");

        // Wrap placeolders in a () if the operator is IN
        if (normalizedOperator === "IN") {
          return `${name} ${operator} (${placeholders})`;
        } else {
          return `${name} ${operator} ${placeholders}`;
        }
      }
    });

    return `WHERE ${whereConditions.join(" AND ")}`;
  }

  /**
   * Generates the ORDER BY clause for a CQL query from an array of `Filter` objects.
   * This method forms the sorting part of a Cassandra Query Language (CQL) statement,
   * allowing for detailed control over the order of results based on specified column names
   * and directions. Each filter in the array represents a column and direction to sort by.
   *
   * It is important to note that unlike the traditional use of `Filter` objects for filtering,
   * in this context, they are repurposed to specify sorting criteria. The `name` field indicates
   * the column to sort by, and the `operator` field is used to specify the sort direction (`ASC` or `DESC`).
   * The `value` field is not utilized for constructing the ORDER BY clause and can be omitted.
   *
   * @param filters Optional. An array of `Filter` objects where each object specifies a column and
   *                direction for sorting. The `name` field of each filter represents the column name,
   *                and the `operator` field should contain the sorting direction (`ASC` or `DESC`).
   *                If no filters are provided, the method returns an empty string.
   * @returns The constructed ORDER BY clause as a string, suitable for appending to a CQL query.
   *          If no sorting criteria are provided, returns an empty string, indicating no ORDER BY
   *          clause should be applied to the query.
   * @private
   */
  private buildOrderByClause(filters?: Filter[]): string {
    if (!filters || filters.length === 0) {
      return "";
    }

    const orderBy = filters.map(({ name, operator, value }) => {
      if (value) {
        return `${name} ${operator} ?`;
      } else if (operator) {
        return `${name} ${operator}`;
      } else {
        return name;
      }
    });

    return `ORDER BY ${orderBy.join(" , ")}`;
  }

  /**
   * Constructs a CQL search query string for retrieving records from a Cassandra table.
   * This method combines various query components, including selected columns, filters, sorting criteria,
   * and pagination options, to form a complete and executable CQL query. It allows for fine-grained control
   * over the query construction process, enabling the inclusion of conditional filtering, ordering of results,
   * and limiting the number of returned records, with an optional allowance for filtering.
   *
   * The method meticulously constructs the SELECT part of the query using the provided columns, applies
   * the WHERE clause based on given filters, sorts the result set according to the orderBy criteria, and
   * restricts the number of results with the limit parameter. Additionally, it can enable the ALLOW FILTERING
   * option for queries that require server-side filtering beyond the capabilities of primary and secondary indexes.
   *
   * @param queryColumns An array of `Column` objects specifying which columns to include in the result set.
   *                     Each column can also have an alias defined for use in the query's result set.
   * @param filters Optional. An array of `Filter` objects to apply as conditions in the WHERE clause of the query.
   * @param orderBy Optional. An array of `Filter` objects specifying the ordering of the returned records.
   *                Although repurposed as `Filter` objects, here they define the column names and the sort direction (ASC/DESC).
   * @param limit Optional. A numeric value specifying the maximum number of records the query should return.
   * @param allowFiltering Optional. A boolean flag that, when true, includes the ALLOW FILTERING clause in the query,
   *                        permitting Cassandra to execute queries that might not be efficiently indexable.
   * @returns A string representing the fully constructed CQL search query, ready for execution against a Cassandra table.
   * @private
   */
  private buildSearchQuery(
    queryColumns: Column[],
    filters?: Filter[],
    orderBy?: Filter[],
    limit?: number,
    allowFiltering?: boolean
  ): string {
    const selectColumns = queryColumns
      .map((col) => (col.alias ? `${col.name} AS ${col.alias}` : col.name))
      .join(", ");

    const whereClause = filters ? this.buildWhereClause(filters) : "";

    const orderByClause = orderBy ? this.buildOrderByClause(orderBy) : "";

    const limitClause = limit ? "LIMIT ?" : "";

    const allowFilteringClause = allowFiltering ? "ALLOW FILTERING" : "";

    const cqlQuery = `SELECT ${selectColumns} FROM ${this.keyspace}.${this.table} ${whereClause} ${orderByClause} ${limitClause} ${allowFilteringClause}`;

    return cqlQuery;
  }

  /**
   * Initializes the CassandraTable instance, ensuring it is ready for database operations.
   * This method is responsible for setting up the internal Cassandra client, creating the table
   * if it does not already exist, and preparing any indices as specified in the table configuration.
   * The initialization process is performed only once; subsequent calls return the result of the
   * initial setup. If a Cassandra `Client` instance is provided, it is used directly; otherwise,
   * a new client is created based on the table's configuration.
   *
   * The initialization includes:
   * - Assigning the provided or newly created Cassandra client to the internal client property.
   * - Executing a CQL statement to create the table with the specified columns, primary key, and
   *   any additional options provided in the `withClause`.
   * - Creating any custom indices as defined in the table's indices array.
   *
   * This method leverages the asynchronous nature of JavaScript to perform potentially time-consuming
   * tasks, such as network requests to the Cassandra cluster, without blocking the execution thread.
   *
   * @param client Optional. A `Client` instance from the cassandra-driver package. If provided, this client
   *               is used for all database operations performed by the instance. Otherwise, a new client
   *               is instantiated based on the configuration provided at the CassandraTable instance creation.
   * @returns A Promise that resolves once the initialization process has completed, indicating the instance
   *          is ready for database operations. If initialization has already occurred, the method returns
   *          immediately without repeating the setup process.
   * @private
   */
  private async initialize(client?: Client): Promise<void> {
    // If already initialized or initialization is in progress, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start the initialization process and store the promise
    this.initializationPromise = this.performInitialization(client)
      .then(() => {
        // Initialization successful
      })
      .catch((error) => {
        // Reset to allow retrying in case of failure
        this.initializationPromise = null;
        throw error;
      });

    return this.initializationPromise;
  }

  /**
   * Performs the actual initialization tasks for the CassandraTable instance.
   * This method is invoked by the `initialize` method to carry out the concrete steps necessary for preparing
   * the CassandraTable instance for operation. It includes establishing the Cassandra client (either by utilizing
   * an existing client passed as a parameter or by creating a new one based on the instance's configuration),
   * and executing the required CQL statements to create the table and its indices according to the specifications
   * provided during the instance's creation.
   *
   * The process encapsulates:
   * 1. Assigning the provided Cassandra `Client` to the instance, or creating a new one if none is provided.
   * 2. Creating the table with the specified schema if it does not exist. This involves constructing a CQL
   *    `CREATE TABLE` statement that includes columns, primary key configuration, and any specified table options.
   * 3. Creating any indices specified in the instance's configuration using CQL `CREATE INDEX` statements, allowing
   *    for custom index options if provided.
   *
   * This method ensures that the table and its environment are correctly set up for subsequent database operations,
   * encapsulating initialization logic to maintain separation of concerns and improve code readability and maintainability.
   *
   * @param client Optional. An instance of the Cassandra `Client` from the cassandra-driver package. If provided,
   *               this client is used for all interactions with the Cassandra database. If not provided, a new client
   *               is instantiated based on the provided configuration during the CassandraTable instance creation.
   * @returns A Promise that resolves when all initialization steps have been successfully completed, indicating
   *          that the CassandraTable instance is fully prepared for database operations.
   * @private
   */
  private async performInitialization(client?: Client) {
    if (client) {
      this.client = client;
    } else {
      this.client = await CassandraClientFactory.getClient(
        this.constructorArgs
      );
    }

    const allColumns = [...this.primaryKey, ...this.nonKeyColumns];

    let cql = "";
    cql = `CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.table} (
      ${
        allColumns.length > 0
          ? `${allColumns.map((col) => `${col.name} ${col.type}`).join(", ")}`
          : ""
      }
      , ${this.buildPrimaryKey(this.primaryKey)}
  ) ${this.withClause ? `WITH ${this.withClause}` : ""};`;

    await this.client.execute(cql);

    // Helper function to format custom index OPTIONS clause
    const _formatOptions = (options: string | undefined): string => {
      if (!options) {
        return "";
      }

      let formattedOptions = options.trim();
      if (!formattedOptions.toLowerCase().startsWith("with options =")) {
        formattedOptions = `WITH OPTIONS =  ${formattedOptions}`;
      }

      return formattedOptions;
    };

    for await (const { name, value, options } of this.indices) {
      const optionsClause = _formatOptions(options);
      cql = `CREATE CUSTOM INDEX IF NOT EXISTS idx_${this.table}_${name}
               ON ${this.keyspace}.${this.table} ${value} USING 'StorageAttachedIndex' ${optionsClause};`;
      await this.client.execute(cql);
    }
  }

  /**
   * Performs the actual insert or update operation (upsert) on the Cassandra table for a batch of values.
   * This method constructs and executes a CQL INSERT statement for each value in the batch.
   *
   * @param values An array of arrays, where each inner array contains values corresponding to the specified columns.
   * @param columns Optional. Specifies the columns into which the values should be inserted. Defaults to all columns.
   * @returns A Promise that resolves when the operation has completed.
   * @private
   */
  private async _upsert(
    values: unknown[][],
    columns?: Column[]
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }

    await this.initialize();

    const upsertColumns = this._columnCheck(values, columns);

    const upsertColumnNames = upsertColumns.map((col) => col.name);

    const columnCount = upsertColumnNames.length;

    const bindPlaceholders = Array(columnCount).fill("?").join(", ");

    const upsertString = `INSERT INTO ${this.keyspace}.${
      this.table
    } (${upsertColumnNames.join(", ")}) VALUES (${bindPlaceholders})`;

    // Initialize an array to hold query objects
    const queries = [];

    for (let i = 0; i < values.length; i += 1) {
      const query = {
        query: upsertString,
        params: values[i],
      };

      // Add the query to the list
      queries.push(query);
    }

    // Execute the queries: use a batch if multiple, otherwise execute a single query
    if (queries.length === 1) {
      await this.client.execute(queries[0].query, queries[0].params, {
        prepare: true,
      });
    } else {
      await this.client.batch(queries, { prepare: true, logged: false });
    }
  }
}
