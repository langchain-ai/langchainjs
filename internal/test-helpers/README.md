# Test Helpers

This package exports a number of utilities that are helpful in testing.

## `env`

This module provides utilities for managing environment variables (`process.env`) within your tests, particularly for Jest. It ensures that environment variable changes are isolated to individual tests and automatically cleaned up afterward.

### Usage

Import the `env` helper from `@langchain/test-helpers/env`.

```typescript
import { env } from "@langchain/test-helpers/env";
```

#### `env.useVariables(variables, options)`

This is the primary function for setting multiple environment variables for your tests. You call it at the top level of your test file, and it uses `beforeEach` and `afterEach` hooks to manage the environment.

**Arguments:**

- `variables`: An object where keys are environment variable names and values are what you want to set them to.
  - `string`: Sets the variable to that string value.
  - `undefined`: Deletes the environment variable.
  - `env.passthrough`: A special symbol that tells the helper to keep the original value of the environment variable, if it exists.
- `options`: An optional configuration object.
  - `replace` (boolean, default: `false`): If `true`, all existing environment variables on `process.env` will be cleared before applying the ones you've specified. If `false`, your variables will be merged with the existing environment.

**Example: Setting specific environment variables**

```ts
// Set specific env vars while preserving others
env.useVariables({
  API_KEY: "test-key",
  DEBUG: "true",
});
```

**Example: Replacing the environment**

This is useful for creating isolated test environments. You can use `env.passthrough` to preserve specific variables from the original environment.

```ts
// Replace all env vars with just these
env.useVariables(
  {
    API_KEY: "test-key",
    // Preserve the existing value of PRESERVE_THIS
    PRESERVE_THIS: env.passthrough,
  },
  { replace: true }
);
```

#### `env.useVariable(key, value, options)`

A convenience wrapper around `useVariables` for when you only need to set a single environment variable.

**Example:**

```ts
// Set a single env var while preserving others
env.useVariable("API_KEY", "test-key");

// Replace all env vars with just this one
env.useVariable("API_KEY", "test-key", { replace: true });
```

#### `env.applyEnv(envObject)`

This is a lower-level function used internally by the helpers, but it's exported for direct use. It takes an object and applies its key-value pairs to `process.env`. If a value is `undefined`, the corresponding key is deleted from `process.env`. This function applies changes immediately and does **not** handle automatic cleanup.

```ts
env.applyEnv({
  KEY_A: "VALUE_A",
  KEY_B: undefined, // This will delete process.env.KEY_B
});
```
