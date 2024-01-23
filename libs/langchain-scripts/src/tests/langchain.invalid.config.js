export const config = {
  entrypoints: "should be an object, not a string",
  tsConfigPath: 123, // should be a string
  cjsSource: null, // should be a string
  cjsDestination: true, // should be a string
  abs: "should be a function, not a string",
  requiresOptionalDependency: "should be an array, not a string",
  deprecatedNodeOnly: [123], // array elements should be strings
  deprecatedOmitFromImportMap: [null], // array elements should be strings
  packageSuffix: 456, // should be a string
  shouldTestExports: "should be a boolean, not a string",
  extraImportMapEntries: "should be an array, not a string",
  gitignorePaths: [789], // array elements should be strings
  internals: "should be an array, not a string",
};
