import { checkTreeShaking } from "@langchain/scripts";

checkTreeShaking({
  extraInternals: [
    /node\:/,
    /js-tiktoken/,
    /@langchain\/core/,
    /@langchain\/community/,
    "axios", // axios is a dependency of openai
    "convex",
    "convex/server",
    "convex/values",
    "@rockset/client/dist/codegen/api.js",
    "mysql2/promise",
    "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js",
    "@zilliz/milvus2-sdk-node/dist/milvus/const/Milvus.js",
    "@zilliz/milvus2-sdk-node/dist/milvus/types.js",
    "notion-to-md/build/utils/notion.js",
    "firebase-admin/app",
    "firebase-admin/firestore",
    "web-auth-library/google",
    "@google-ai/generativelanguage/build/protos/protos.js",
  ]
});
