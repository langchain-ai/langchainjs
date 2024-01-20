import { checkTreeShaking } from "@langchain/scripts";

checkTreeShaking({
  extraInternals: [
    /@langchain\/core\//,
    "convex",
    "convex/server",
    "convex/values",
    "@rockset/client/dist/codegen/api.js",
    "discord.js",
    "mysql2/promise",
    "web-auth-library/google",
    "firebase-admin/app",
    "firebase-admin/firestore",
    "lunary/langchain",
  ],
});
