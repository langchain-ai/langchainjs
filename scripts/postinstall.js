// postinstall functions to handle any tasks, fixes or hacks that may arise as a result of dependency issues

(function postinstall() {
  // This is a hack to fix a bug in the domexception package
  // replace line 34 of node_modules/domexception/lib/utils.js
  // original: const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}).prototype);
  // replaced: const AsyncIteratorPrototype = Object.getPrototypeOf(async function* () {}).prototype;
    const fs = require('fs');
    const path = require('path');
    const utilsPath = path.join('./node_modules/domexception/lib/utils.js');
    const utils = fs.readFileSync(utilsPath, 'utf8');
    const fixedUtils = utils.replace(
        "const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}).prototype);",
        "const AsyncIteratorPrototype = Object.getPrototypeOf(async function* () {}).prototype;"
    );
    // save fixedUtils
    const fixedUtilsPath = path.join('./node_modules/domexception/lib/utils.js');
    fs.writeFileSync(fixedUtilsPath, fixedUtils, 'utf8');
    console.log('wrote file')
})()