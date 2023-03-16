import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: "index.ts",
  output: {
    dir: "dist/rollup",
    format: "esm",
  },
  plugins: [nodeResolve(), commonjs(), json()],
  experimentalLogSideEffects: true,
  external: ["@dqbd/tiktoken"],
};
