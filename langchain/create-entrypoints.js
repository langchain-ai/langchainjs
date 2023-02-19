/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");

const entrypoints = {
  agents: "agents/index.ts",
  tools: "agents/tools/index.ts",
  chains: "chains/index.ts",
  embeddings: "embeddings/index.ts",
  llms: "llms/index.ts",
  prompts: "prompts/index.ts",
  vectorstores: "vectorstores/index.ts",
  text_splitter: "text_splitter.ts",
  memory: "memory/index.ts",
  document: "document.ts",
};

const updateJsonFile = (relativePath, updateFunction) => {
  const filePath = path.resolve(__dirname, relativePath);
  const contents = fs.readFileSync(filePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(filePath, JSON.stringify(res, null, 2));
};

const updateConfig = () => {
  updateJsonFile("./tsconfig.json", (json) => ({
    ...json,
    typedocOptions: {
      ...json.typedocOptions,
      entryPoints: [...Object.values(entrypoints), "index.ts"].map(
        (x) => `./${x}`
      ),
    },
  }));

  updateJsonFile("./package.json", (json) => ({
    ...json,
    files: [
      "dist/",
      ...Object.keys(entrypoints).flatMap((key) => [
        `${key}.js`,
        `${key}.d.ts`,
      ]),
    ],
  }));

  Object.entries(entrypoints).forEach(([key, value]) => {
    const withoutExt = value.slice(0, -path.extname(value).length);
    const modulePath =
      path.basename(withoutExt) === "index"
        ? path.dirname(withoutExt)
        : withoutExt;
    const compiledPath = `./dist/${modulePath}`;
    fs.writeFileSync(
      `./${key}.js`,
      `module.exports = require('${compiledPath}')`
    );
    fs.writeFileSync(`./${key}.d.ts`, `export * from '${compiledPath}'`);
  });

  fs.writeFileSync(
    "./.gitignore",
    Object.keys(entrypoints)
      .flatMap((key) => [`${key}.js`, `${key}.d.ts`])
      .join("\n")
  );
};

const cleanGenerated = () => {
  Object.keys(entrypoints)
    .flatMap((key) => [`${key}.js`, `${key}.d.ts`])
    .forEach((fname) => {
      try {
        fs.unlinkSync(fname);
      } catch {
        // ignore error
      }
    });
};

const command = process.argv[2];

if (command === "clean") {
  cleanGenerated();
} else {
  updateConfig();
}
