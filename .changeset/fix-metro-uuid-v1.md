---
"@langchain/core": patch
"langchain": patch
---

fix(core, langchain): bump uuid dependency from ^10.0.0 to ^11.0.0 to fix Metro bundler error

The `uuid` v10 package has ambiguous `exports` in its `package.json` which causes Metro (used by Expo/React Native) to resolve the wrong entry point, resulting in `Cannot read properties of undefined (reading 'v1')`. The `uuid` v11 package fixes its exports map to work correctly with Metro's package exports resolution.
