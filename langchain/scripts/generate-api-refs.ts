import { Project, ts } from "ts-morph";
import path from "path";

const CWD = process.cwd();
const TS_CONFIG_PATH = path.join(CWD, "tsconfig.json");

const setupProject = () => {
  const project = new Project({
    tsConfigFilePath: TS_CONFIG_PATH,
  });
  return project;
};

const getAllExportsFromFile = async (fullPath: string, project: Project) => {
  if (!fullPath.endsWith(".ts")) {
    console.warn("Skipping non-ts file: ", fullPath);
  }
  if (fullPath.endsWith(".test.ts")) {
    console.warn("Skipping test file: ", fullPath);
  }

  const sourceFile = project.addSourceFileAtPath(fullPath);

  // Get all export symbols
  const exports = sourceFile.getExportSymbols().map((symbol) => {
    const declarations = symbol.getDeclarations();

    return declarations.map((declaration) => {
      const classDeclaration = declaration
        .getType()
        .getSymbol()
        ?.getDeclarations()[0];

      if (!classDeclaration) {
        return;
      }

      if (
        ts.isClassDeclaration(classDeclaration) ||
        ts.isInterfaceDeclaration(classDeclaration)
      ) {
        const hierarchy = classDeclaration
          .getBaseTypes()
          .map((bt) => bt.getSymbol()?.getName());
        // ...
      }

      const hierarchy = classDeclaration
        ?.getBaseTypes()
        .map((bt) => bt.getSymbol()?.getName());
      const implementsTypes = classDeclaration
        ?.getImplements()
        .map((impl) => impl.getText());
      const constructors = classDeclaration
        ?.getConstructors()
        .map((ctor) => ctor.getText());
      const properties = classDeclaration
        ?.getProperties()
        .map((prop) => prop.getName());
      const methods = classDeclaration
        ?.getMethods()
        .map((method) => method.getName());

      return {
        kind: declaration.getKindName(),
        name: symbol.getName(),
        jsdocComments: declaration.getJsDocs().map((doc) => doc.getComment()),
        type: declaration.getType().getText(),
        hierarchy: hierarchy,
        implementsTypes: implementsTypes,
        constructors: constructors,
        properties: properties,
        methods: methods,
      };
    });
  });

  // Log the exported symbols and their declarations
  console.log(exports.map((item) => item.declarations));
};

async function main() {
  console.log("Start: ", new Date().toISOString());
  const project = setupProject();

  console.log("Project setup: ", new Date().toISOString());
  const dummyPath = path.join(CWD, "src/chat_models/openai.ts");
  await getAllExportsFromFile(dummyPath, project);
  console.log("Finish: ", new Date().toISOString());
}
main();
