import * as fs from "fs";

const langchainPackageJson = JSON.parse(fs.readFileSync("../langchain/package.json"));
const testPackageJson = JSON.parse(fs.readFileSync("./package.json"));

testPackageJson.dependencies = { ...testPackageJson.dependencies, ...langchainPackageJson.dependencies };

fs.writeFileSync("./package.json", JSON.stringify(testPackageJson, null, 2));