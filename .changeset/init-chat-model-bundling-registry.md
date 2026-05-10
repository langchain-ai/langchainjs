---
"langchain": minor
---

Add `registerProviderForBundling` to make `initChatModel` work with bundlers (esbuild, rollup, webpack). Without it, the lib's runtime `import(packageName)` cannot be statically analyzed and provider packages are dropped from production bundles. Call once at app entry with the provider key and the imported package namespace. Without the call, behavior is unchanged.
