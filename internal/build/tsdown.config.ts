import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  dts: true,
  unbundle: true,
  outDir: "dist",
  outExtensions: ({ format }) => {
    if (format === "es") return { js: ".js", dts: ".d.ts" };
    return undefined;
  },
});
