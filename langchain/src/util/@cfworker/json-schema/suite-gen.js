import { promises as fs } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
const { readdir, writeFile } = fs;

/**
 * @param {string} dir
 */
async function* getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    if (dirent.isSymbolicLink()) {
      continue;
    }
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

const supportedDrafts = {
  4: true,
  7: true,
  "2019-09": true,
  "2020-12": true,
};

async function generate() {
  const packageDir = dirname(
    fileURLToPath(await import.meta.resolve("json-schema-test-suite"))
  );

  let imports = "";
  let suites = "";
  let remotes = "";

  const pattern = /json-schema-test-suite\/tests\/(draft([^/]+)+\/(.*))\.json$/;
  const dir = join(packageDir, "tests");
  for await (const file of getFiles(dir)) {
    const [from, name, draft] = pattern.exec(file);
    if (!supportedDrafts[draft]) {
      continue;
    }
    const importName = name.replace(/[-/]/g, "_");
    imports += `// @ts-ignore\nimport ${importName} from '${from}';\n`;
    suites += `  { draft: '${draft}', name: '${name}', tests: ${importName} },\n`;
  }

  const pattern2 = /json-schema-test-suite\/remotes\/(.*)\.json$/;
  const dir2 = join(packageDir, "remotes");
  for await (const file of getFiles(dir2)) {
    const [from, name] = pattern2.exec(file);
    const importName = "remote_" + name.replace(/[-/]/g, "_");
    imports += `// @ts-ignore\nimport ${importName} from '${from}';\n`;
    remotes += `  { name: 'http://localhost:1234/${name}.json', schema: ${importName} },\n`;
  }

  const code =
    `import { SchemaTestSuite, Remote } from './types';\n${imports}\n` +
    `export const suites: SchemaTestSuite[] = [\n${suites}\n];\n` +
    `export const remotes: Remote[] = [\n${remotes}\n];\n`;

  await writeFile("test/json-schema-test-suite.ts", code);
}

generate();
