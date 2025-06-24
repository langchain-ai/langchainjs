import { BatchInterceptor } from "@mswjs/interceptors";

/**
 * Creates and returns a BatchInterceptor appropriate for the current environment (browser or Node.js).
 *
 * This function dynamically imports the correct set of interceptors based on the detected global environment.
 * - In a browser environment (`globalThis.window` is defined), it attempts to import browser interceptors.
 * - In a Node.js environment (`globalThis.process` is defined), it imports Node.js interceptors.
 * - If neither environment is detected, it throws an error.
 *
 * @returns {Promise<BatchInterceptor>} A promise that resolves to a configured BatchInterceptor instance.
 * @throws {Error} If no suitable interceptor is found for the current environment.
 */
export async function globalInterceptor() {
  if (globalThis.window !== undefined) {
    // FIXME: browser interceptors are awkward to import since ts auto assumes node types
    // A no-op right now since we don't do integration tests directly in the browser
    throw new Error("Not implemented");
    // Once a fix is merged for msw, syntax should look like this:
    // const { default: browserInterceptors } = await import(
    //   "@mswjs/interceptors/presets/browser"
    // );
    // const interceptor = new BatchInterceptor({
    //   name: "langchain-net-mocks",
    //   interceptors: browserInterceptors,
    // });
    // return interceptor;
  }
  if (globalThis.process !== undefined) {
    const { default: nodeInterceptors } = await import(
      "@mswjs/interceptors/presets/node"
    );
    const interceptor = new BatchInterceptor({
      name: "langchain-net-mocks",
      interceptors: nodeInterceptors,
    });
    return interceptor;
  }
  throw new Error("No interceptor found for current environment");
}

export type EnvironmentBatchInterceptor = Awaited<
  ReturnType<typeof globalInterceptor>
>;
