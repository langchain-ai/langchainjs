import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";

export default getBuildConfig({
  entry: ["./src/index.ts"],
  // These are type-only imports (import type) from transitive dependencies
  // of @aws-sdk/client-bedrock-runtime. They are listed as devDependencies
  // since they're only needed for type checking, not at runtime.
  external: ["@aws-sdk/types", "@smithy/types"],
  inlineOnly: false,
  plugins: [
    cjsCompatPlugin({
      files: ["dist/", "CHANGELOG.md", "README.md", "LICENSE"],
    }),
  ],
});
