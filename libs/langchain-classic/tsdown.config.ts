import { defineConfig } from "tsdown";
import {
  getBuildConfig,
  importConstantsPlugin,
  importMapPlugin,
  lcSecretsPlugin,
} from "@langchain/build";

export default defineConfig([
  getBuildConfig({
    plugins: [
      lcSecretsPlugin({
        enabled: process.env.SKIP_SECRET_SCANNING !== "true",
        strict: process.env.NODE_ENV === "production",
      }),
      importConstantsPlugin({
        enabled: process.env.SKIP_IMPORT_CONSTANTS !== "true",
        optionalEntrypoints: [
          "agents/load",
          "agents/toolkits/sql",
          "tools/sql",
          "tools/webbrowser",
          "chains/load",
          "chains/query_constructor",
          "chains/query_constructor/ir",
          "chains/sql_db",
          "chains/graph_qa/cypher",
          "chat_models/universal",
          "document_loaders/fs/buffer",
          "document_loaders/fs/directory",
          "document_loaders/fs/json",
          "document_loaders/fs/multi_file",
          "document_loaders/fs/text",
          "sql_db",
          "output_parsers/expression",
          "retrievers/self_query",
          "retrievers/self_query/functional",
          "cache/file_system",
          "stores/file/node",
          "storage/file_system",
          "hub",
          "hub/node",
        ],
      }),
      importMapPlugin({
        enabled: process.env.SKIP_IMPORT_MAP !== "true",
        extraImportMapEntries: [
          {
            modules: ["StringOutputParser"],
            alias: ["schema", "output_parser"],
            path: "@langchain/core/output_parsers",
          },
        ],
        deprecatedOmitFromImportMap: ["hub", "hub/node"],
      }),
    ],
  }),
]);
