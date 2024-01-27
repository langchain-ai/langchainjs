import { Client, DseClientOptions } from "cassandra-driver";
import fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export interface AstraServiceProviderArgs {
  datacenterID?: string;
  endpoint?: string | URL;
  token: string;
  regionName?: string;
}

export interface CassandraServiceProviderArgs {
  astra?: AstraServiceProviderArgs;
}

export interface CassandraClientArgs extends DseClientOptions {
  serviceProviderArgs?: CassandraServiceProviderArgs;
}

/**
 * A factory class for creating Cassandra clients.
 */
export class CasssandraClientFactory {
  /**
   * Get a Cassandra client with the provided arguments.
   * @param args The arguments for creating the Cassandra client.
   * @returns A Client object from the cassandra-driver.
   */
  public static async getClient(args: CassandraClientArgs): Promise<Client> {
    const modifiedArgs = await this.processArgs(args);
    return new Client(modifiedArgs);
  }

  /**
   * Process the arguments for creating a Cassandra client.
   * @param args The arguments for creating the Cassandra client.
   * @returns The processed arguments.
   * @throws Error if the configuration is unsupported (e.g. unknown service provider).
   */
  private static processArgs(
    args: CassandraClientArgs
  ): Promise<CassandraClientArgs> {
    if (!args.serviceProviderArgs) {
      return Promise.resolve(args);
    }

    if (args.serviceProviderArgs && args.serviceProviderArgs.astra) {
      return CasssandraClientFactory.processAstraArgs(args);
    }

    throw new Error("Unsupported configuration for Cassandra client.");
  }

  /**
   * Process the arguments for creating a Cassandra client to Astra.
   * @param args The arguments for creating the Cassandra client.
   * @returns The processed arguments for connecting to Astra.
   * @throws Error if the Astra configuration is not provided.
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
        await CasssandraClientFactory.getAstraDefaultBundleLocation(astraArgs);
    }

    // Ensure secure connect bundle exists
    await CasssandraClientFactory.setAstraBundle(
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
   * Get the default bundle location for Astra.
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
   * Set the Astra bundle for the Cassandra client.
   * @param astraArgs The Astra service provider arguments.
   * @param scbPath The path to the secure connect bundle.
   * @returns Promise that resolves when the bundle is set.
   * @throws Error if the bundle URLs cannot be retrieved or the file cannot be downloaded.
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
          await CasssandraClientFactory.downloadAstraSecureConnectBundle(
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
          await CasssandraClientFactory.downloadAstraSecureConnectBundle(
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
   * Downloads the Astra secure connect bundle for the given Astra service provider arguments
   * and saves it to the specified file path.
   *
   * @param astraArgs - The Astra service provider arguments.
   * @param scbPath - The file path to save the secure connect bundle.
   * @returns A promise that resolves when the secure connect bundle is downloaded and saved.
   * @throws An error if there is an HTTP error or if the secure bundle URLs cannot be retrieved.
   */
  private static async downloadAstraSecureConnectBundle(
    astraArgs: AstraServiceProviderArgs,
    scbPath: string
  ): Promise<void> {
    if (!astraArgs.datacenterID) {
      throw new Error("Astra datacenterID is not provided in args.");
    }

    // First POST request gets all bundle locations for the database_id
    const bundleURLTemplate =
      "https://api.astra.datastax.com/v2/databases/{database_id}/secureBundleURL?all=true";
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
