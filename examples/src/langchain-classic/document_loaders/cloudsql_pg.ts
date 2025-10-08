import {
  PostgresEngine,
  PostgresEngineArgs,
  PostgresLoader,
  PostgresLoaderOptions,
} from "@langchain/google-cloud-sql-pg";

import * as dotenv from "dotenv";

dotenv.config();

const pgArgs: PostgresEngineArgs = {
  user: process.env.DB_USER ?? "",
  password: process.env.PASSWORD ?? "",
};

async function initializePostgresEngine() {
  const PEInstance = await PostgresEngine.fromInstance(
    process.env.PROJECT_ID ?? "",
    process.env.REGION ?? "",
    process.env.INSTANCE_NAME ?? "",
    process.env.DB_NAME ?? "",
    pgArgs
  );
  return PEInstance;
}

const customFormatter = (row: { [x: string]: any }, contentColumns: any[]) => {
  return contentColumns
    .filter((column) => column in row)
    .map((column) => `${column}: ${row[column]}`)
    .join("\n");
};

async function createPostgresLoader(PEInstance: PostgresEngine) {
  const documentLoaderArgs: PostgresLoaderOptions = {
    tableName: "test_table_custom",
    schemaName: "public",
    contentColumns: ["fruit_name", "variety", "organic"],
    metadataColumns: ["fruit_id", "quantity_in_stock", "price_per_unit"],
    formatter: customFormatter, // or use format: "json" | "yaml" | "csv" | "text"
  };

  const documentLoaderInstance = await PostgresLoader.initialize(
    PEInstance,
    documentLoaderArgs
  );
  return documentLoaderInstance;
}

async function loadDocuments(documentLoaderInstance: PostgresLoader) {
  const documents = await documentLoaderInstance.load();
  return documents;
}

async function main() {
  try {
    const PEInstance = await initializePostgresEngine();
    const documentLoaderInstance = await createPostgresLoader(PEInstance);
    const documents = await loadDocuments(documentLoaderInstance);

    console.log("Loaded Documents:", documents);

    // Close the connection after use
    await PEInstance.closeConnection();
  } catch (error: any) {
    console.error("Error:", error);
    throw Error(error);
  }
}

main();
