import path from "path";
import url from "url";
import fs from "fs";

const entrypoints = {
  agents: "agents/index",
  tools: "agents/tools/index",
  chains: "chains/index",
  embeddings: "embeddings/index",
  llms: "llms/index",
  prompts: "prompts/index",
  vectorstores: "vectorstores/index",
  text_splitter: "text_splitter",
  memory: "memory/index",
  document: "document",
  docstore: "docstore/index",
  document_loaders: "document_loaders/index",
  chat_models: "chat_models/index",
  schema: "schema/index",
};

const updateJsonFile = (relativePath, updateFunction) => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    relativePath
  );
  const contents = fs.readFileSync(filePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(filePath, JSON.stringify(res, null, 2));
};

const generateFiles = () => {
  const files = [...Object.entries(entrypoints), ["index", "index"]].flatMap(
    ([key, value]) => {
      const compiledPath = `./dist/${value}.js`;
      return [
        [`${key}.js`, `export * from '${compiledPath}'`],
        [`${key}.d.ts`, `export * from '${compiledPath}'`],
      ];
    }
  );

  return Object.fromEntries(files);
};

const updateConfig = () => {
  updateJsonFile("./tsconfig.json", (json) => ({
    ...json,
    typedocOptions: {
      ...json.typedocOptions,
      entryPoints: [...Object.values(entrypoints), "index"].map(
        (value) => `src/${value}.ts`
      ),
    },
  }));

  const generatedFiles = generateFiles();
  const filenames = Object.keys(generatedFiles);

  updateJsonFile("./package.json", (json) => ({
    ...json,
    exports: Object.fromEntries(
      ["index", ...Object.keys(entrypoints)].map((key) => {
        const entryPoint = {
          types: `./${key}.d.ts`,
          import: `./${key}.js`,
        };
        return [key === "index" ? "." : `./${key}`, entryPoint];
      })
    ),
    files: ["dist/", ...filenames],
  }));

  Object.entries(generatedFiles).forEach(([filename, content]) => {
    fs.writeFileSync(filename, content);
  });
  fs.writeFileSync("./.gitignore", filenames.join("\n"));
};

const cleanGenerated = () => {
  const filenames = Object.keys(generateFiles());
  filenames.forEach((fname) => {
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
