import ts from "typescript";
import * as path from "path";

function extractConstructorParams(
  sourceFile: string,
  className: string
): { type: string; fields: string[] } | null {
  const absolutePath = path.resolve(sourceFile);
  const program = ts.createProgram([absolutePath], {
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS,
  });
  const source = program.getSourceFile(absolutePath);
  const typeChecker = program.getTypeChecker();

  if (!source) {
    console.error(`Could not find source file: ${absolutePath}`);
    return null;
  }

  let result: { type: string; fields: string[] } | null = null;

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      node.members.forEach((member) => {
        if (
          ts.isConstructorDeclaration(member) &&
          member.parameters.length > 0
        ) {
          const firstParam = member.parameters[0];
          const type = typeChecker.getTypeAtLocation(firstParam);
          const typeString = typeChecker.typeToString(type);

          // Get properties of the type
          const fields: string[] = [];
          type.getProperties().forEach((prop) => {
            // Get the type of the property
            const propType = typeChecker.getTypeOfSymbolAtLocation(
              prop,
              firstParam
            );
            // Only include non-function properties that don't start with __
            if (
              !prop.getName().startsWith("__") &&
              prop.getName() !== "callbackManager" &&
              !(propType.getCallSignatures().length > 0)
            ) {
              fields.push(prop.getName());
            }
          });

          result = {
            type: typeString,
            fields,
          };
        }
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return result;
}
const filepath = process.argv[2];
const className = process.argv[3];

if (!filepath || !className) {
  console.error(
    "Usage: node extract_serializable_fields.ts <filepath> <className>"
  );
  process.exit(1);
}

const results = extractConstructorParams(filepath, className);

if (results?.fields?.length) {
  console.log(JSON.stringify(results?.fields, null, 2));
} else {
  console.error("No constructor parameters found");
}
