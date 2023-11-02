import { Project } from "ts-morph";

const BLACKLISTED_CLASS_NAMED = ['BaseLLM', 'LLM', 'FakeListLLM', ]

/**
 * Need to get all parent class methods too.
 */
function getLLMTable() {
  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });
  // Add source files from directory
  const sourceFiles = project.addSourceFilesAtPaths("./src/llms/*.ts");
  /**
   * Store class methods
   * @type {{ [key: string]: string[] }}
   */
  const classesAndMethods = {};
  // Iterate through each source file
  for (const sourceFile of sourceFiles) {
    // Get all classes in the source file
    const classes = sourceFile.getClasses();
    // Iterate through each class
    for (const classDec of classes) {
      // Only consider exported classes
      if (classDec.isExported()) {
        const className = classDec.getName();
        const methods = [];
        // Get all methods of the class
        const methodDeclarations = classDec.getMethods();
        // Iterate through each method
        for (const method of methodDeclarations) {
          methods.push(method.getName());
        }
        if (!className) {
          console.log('current', classesAndMethods);
          throw new Error('Missing class name')
        }
        if (!methods.includes('_call') || BLACKLISTED_CLASS_NAMED.includes(className)) {
          continue;
        }
        // Store in result object
        classesAndMethods[className] = methods;
      }
    }
  }
  const methodList = ['invoke', 'stream', 'batch'];
  for (const method of methodList) {
    const entries = Object.entries(classesAndMethods);
    entries.forEach(([className, methods]) => {
      console.log('class name', className);
      console.log('methods', methods);
    })
  }
}

getLLMTable()