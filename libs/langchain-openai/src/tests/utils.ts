/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-process-env */

// * THIS IS INLINED FROM /internal/test-helpers/src/env.ts
// * Dependency range tests do a shallow copy of the packages it needs from workspace deps, but not exigent workspace deps (like test-helpers).
// * FIXME: This is a temporary solution to avoid adding a dependency on @langchain/test-helpers and not having to publish an internal package.
// * We should fix dep range tests to allow for workspace deps to be used in tests.

import { beforeEach, afterEach } from "@jest/globals";

export const passthrough = Symbol("langchain.test-helpers.env-passthrough");

type UseVariablesOptions = {
  /**
   * If true, the provided variables will replace the existing environment variables.
   * If false, the provided variables will be added as new variables to the existing environment variables.
   * @default false
   */
  replace?: boolean;
};

const _recordWithUndefinedValues = (
  record: Record<string, string | undefined>
): Record<string, undefined> =>
  Object.fromEntries(Object.entries(record).map(([key]) => [key, undefined]));

export const env = {
  /**
   * A symbol that can be used to indicate that the value should be passed through from the environment.
   * This is useful when you want to use the existing value from the environment.
   *
   * @example
   * ```ts
   * env.useVariable("TEST", env.passthrough);
   * ```
   */
  passthrough,
  /**
   * Applies environment variables to the process.env object.
   * If a value is undefined, the corresponding key will be deleted from process.env.
   * Otherwise, the key-value pair will be set in process.env.
   *
   * @param env - Record of environment variable key-value pairs to apply
   */
  applyEnv(env: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  },
  /**
   * Sets up environment variables for tests and handles cleanup.
   * This function will set the specified environment variables before each test
   * and restore the original environment after each test.
   *
   * @param variables - Record of environment variables to set. Values can be:
   *                   - string: Sets the environment variable to this value
   *                   - passthrough: Uses the existing value from the environment
   *                   - undefined: Removes the environment variable
   * @param options - Configuration options
   * @param options.replace - If true, removes all existing env vars before setting new ones.
   *                          If false, merges with existing env vars. Defaults to false.
   *
   * @example
   * ```ts
   * // Set specific env vars while preserving others
   * env.useVariables({
   *   API_KEY: "test-key",
   *   DEBUG: "true",
   * });
   *
   * // Replace all env vars with just these
   * env.useVariables({
   *   API_KEY: "test-key"
   *   // (when you want to preserve the existing value when `replace: true`)
   *   PRESERVE_THIS: env.passthrough
   * }, { replace: true });
   * ```
   */
  useVariables(
    variables: Record<string, string | typeof passthrough | undefined>,
    options: UseVariablesOptions = { replace: false }
  ) {
    const originalEnv = { ...process.env };

    const newEnv = Object.assign(
      // If replacing, set all existing environment variables to undefined
      options.replace ? _recordWithUndefinedValues(process.env) : {},
      // Use the provided variable map
      Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [
          key,
          // If the value is a passthrough symbol, use the existing value from the environment
          value === passthrough ? process.env[key] : value,
        ])
      )
    );

    beforeEach(() => {
      env.applyEnv(newEnv);
    });
    afterEach(() => {
      // Clear the new env by setting all changed values to undefined
      env.applyEnv(_recordWithUndefinedValues(newEnv));
      // Restore the original env
      env.applyEnv(originalEnv);
    });
  },
  /**
   * Helper method to set a single environment variable for tests.
   * Wraps {@link useVariables} for convenience when setting just one variable.
   *
   * @param key - The environment variable name to set
   * @param value - The value to set the environment variable to
   * @param options - Configuration options
   * @param options.replace - If true, removes all existing env vars before setting this one.
   *                          If false, merges with existing env vars. Defaults to false.
   *
   * @example
   * ```ts
   * // Set a single env var while preserving others
   * env.useVariable("API_KEY", "test-key");
   *
   * // Replace all env vars with just this one
   * env.useVariable("API_KEY", "test-key", { replace: true });
   * ```
   */
  useVariable(
    key: string,
    value: string | typeof passthrough | undefined,
    options: UseVariablesOptions = { replace: false }
  ) {
    return env.useVariables({ [key]: value }, options);
  },
};
