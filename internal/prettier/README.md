# @langchain/prettier-config

Shared Prettier configuration for LangChain.js projects.

## Package Scripts

Packages should use format scripts like:

```json
{
  "scripts": {
    "format": "prettier --write \"src\"",
    "format:check": "prettier --check \"src\""
  }
}
```

Note: No `--config` flag is needed since Prettier automatically finds the root config.

## Explicit Reference (Optional)

If you need to explicitly reference the config (e.g., for external tools), you can add to your `package.json`:

```json
{
  "prettier": "@langchain/prettier-config",
  "devDependencies": {
    "@langchain/prettier-config": "workspace:*"
  }
}
```

## Extending

If you need to extend or override the configuration, create a `.prettierrc.js` file in your package:

```js
import baseConfig from "@langchain/prettier-config";

export default {
  ...baseConfig,
  // your overrides here
};
```
