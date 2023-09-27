// Inlined because of ESM import issues
// From https://github.com/Starcounter-Jack/JSON-Patch

/*! fast-json-patch, version: 3.1.1 */
var jsonpatch = /******/ /* #__PURE__ */ (function (modules) {
  // webpackBootstrap
  /******/ // The module cache
  /******/ var installedModules = {};
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/
    /******/ // Check if module is in cache
    /******/ if (installedModules[moduleId]) {
      /******/ return installedModules[moduleId].exports;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (installedModules[moduleId] = {
      /******/ i: moduleId,
      /******/ l: false,
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ modules[moduleId].call(
      module.exports,
      module,
      module.exports,
      __webpack_require__
    );
    /******/
    /******/ // Flag the module as loaded
    /******/ module.l = true;
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
  /******/
  /******/
  /******/ // expose the modules object (__webpack_modules__)
  /******/ __webpack_require__.m = modules;
  /******/
  /******/ // expose the module cache
  /******/ __webpack_require__.c = installedModules;
  /******/
  /******/ // define getter function for harmony exports
  /******/ __webpack_require__.d = function (exports, name, getter) {
    /******/ if (!__webpack_require__.o(exports, name)) {
      /******/ Object.defineProperty(exports, name, {
        enumerable: true,
        get: getter,
      });
      /******/
    }
    /******/
  };
  /******/
  /******/ // define __esModule on exports
  /******/ __webpack_require__.r = function (exports) {
    /******/ if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
      /******/ Object.defineProperty(exports, Symbol.toStringTag, {
        value: "Module",
      });
      /******/
    }
    /******/ Object.defineProperty(exports, "__esModule", { value: true });
    /******/
  };
  /******/
  /******/ // create a fake namespace object
  /******/ // mode & 1: value is a module id, require it
  /******/ // mode & 2: merge all properties of value into the ns
  /******/ // mode & 4: return value when already ns object
  /******/ // mode & 8|1: behave like require
  /******/ __webpack_require__.t = function (value, mode) {
    /******/ if (mode & 1) value = __webpack_require__(value);
    /******/ if (mode & 8) return value;
    /******/ if (
      mode & 4 &&
      typeof value === "object" &&
      value &&
      value.__esModule
    )
      return value;
    /******/ var ns = Object.create(null);
    /******/ __webpack_require__.r(ns);
    /******/ Object.defineProperty(ns, "default", {
      enumerable: true,
      value: value,
    });
    /******/ if (mode & 2 && typeof value != "string")
      for (var key in value)
        __webpack_require__.d(
          ns,
          key,
          function (key) {
            return value[key];
          }.bind(null, key)
        );
    /******/ return ns;
    /******/
  };
  /******/
  /******/ // getDefaultExport function for compatibility with non-harmony modules
  /******/ __webpack_require__.n = function (module) {
    /******/ var getter =
      module && module.__esModule
        ? /******/ function getDefault() {
            return module["default"];
          }
        : /******/ function getModuleExports() {
            return module;
          };
    /******/ __webpack_require__.d(getter, "a", getter);
    /******/ return getter;
    /******/
  };
  /******/
  /******/ // Object.prototype.hasOwnProperty.call
  /******/ __webpack_require__.o = function (object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
  };
  /******/
  /******/ // __webpack_public_path__
  /******/ __webpack_require__.p = "";
  /******/
  /******/
  /******/ // Load entry module and return exports
  /******/ return __webpack_require__((__webpack_require__.s = 2));
  /******/
})(
  /************************************************************************/
  /******/ [
    /* 0 */
    /***/ function (module, exports) {
      /*!
       * https://github.com/Starcounter-Jack/JSON-Patch
       * (c) 2017-2022 Joachim Wester
       * MIT licensed
       */
      var __extends =
        (this && this.__extends) ||
        (function () {
          var extendStatics = function (d, b) {
            extendStatics =
              Object.setPrototypeOf ||
              ({ __proto__: [] } instanceof Array &&
                function (d, b) {
                  d.__proto__ = b;
                }) ||
              function (d, b) {
                for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
              };
            return extendStatics(d, b);
          };
          return function (d, b) {
            extendStatics(d, b);
            function __() {
              this.constructor = d;
            }
            d.prototype =
              b === null
                ? Object.create(b)
                : ((__.prototype = b.prototype), new __());
          };
        })();
      Object.defineProperty(exports, "__esModule", { value: true });
      var _hasOwnProperty = Object.prototype.hasOwnProperty;
      function hasOwnProperty(obj, key) {
        return _hasOwnProperty.call(obj, key);
      }
      exports.hasOwnProperty = hasOwnProperty;
      function _objectKeys(obj) {
        if (Array.isArray(obj)) {
          var keys_1 = new Array(obj.length);
          for (var k = 0; k < keys_1.length; k++) {
            keys_1[k] = "" + k;
          }
          return keys_1;
        }
        if (Object.keys) {
          return Object.keys(obj);
        }
        var keys = [];
        for (var i in obj) {
          if (hasOwnProperty(obj, i)) {
            keys.push(i);
          }
        }
        return keys;
      }
      exports._objectKeys = _objectKeys;
      /**
       * Deeply clone the object.
       * https://jsperf.com/deep-copy-vs-json-stringify-json-parse/25 (recursiveDeepCopy)
       * @param  {any} obj value to clone
       * @return {any} cloned obj
       */
      function _deepClone(obj) {
        switch (typeof obj) {
          case "object":
            return JSON.parse(JSON.stringify(obj)); //Faster than ES5 clone - http://jsperf.com/deep-cloning-of-objects/5
          case "undefined":
            return null; //this is how JSON.stringify behaves for array items
          default:
            return obj; //no need to clone primitives
        }
      }
      exports._deepClone = _deepClone;
      //3x faster than cached /^\d+$/.test(str)
      function isInteger(str) {
        var i = 0;
        var len = str.length;
        var charCode;
        while (i < len) {
          charCode = str.charCodeAt(i);
          if (charCode >= 48 && charCode <= 57) {
            i++;
            continue;
          }
          return false;
        }
        return true;
      }
      exports.isInteger = isInteger;
      /**
       * Escapes a json pointer path
       * @param path The raw pointer
       * @return the Escaped path
       */
      function escapePathComponent(path) {
        if (path.indexOf("/") === -1 && path.indexOf("~") === -1) return path;
        return path.replace(/~/g, "~0").replace(/\//g, "~1");
      }
      exports.escapePathComponent = escapePathComponent;
      /**
       * Unescapes a json pointer path
       * @param path The escaped pointer
       * @return The unescaped path
       */
      function unescapePathComponent(path) {
        return path.replace(/~1/g, "/").replace(/~0/g, "~");
      }
      exports.unescapePathComponent = unescapePathComponent;
      function _getPathRecursive(root, obj) {
        var found;
        for (var key in root) {
          if (hasOwnProperty(root, key)) {
            if (root[key] === obj) {
              return escapePathComponent(key) + "/";
            } else if (typeof root[key] === "object") {
              found = _getPathRecursive(root[key], obj);
              if (found != "") {
                return escapePathComponent(key) + "/" + found;
              }
            }
          }
        }
        return "";
      }
      exports._getPathRecursive = _getPathRecursive;
      function getPath(root, obj) {
        if (root === obj) {
          return "/";
        }
        var path = _getPathRecursive(root, obj);
        if (path === "") {
          throw new Error("Object not found in root");
        }
        return "/" + path;
      }
      exports.getPath = getPath;
      /**
       * Recursively checks whether an object has any undefined values inside.
       */
      function hasUndefined(obj) {
        if (obj === undefined) {
          return true;
        }
        if (obj) {
          if (Array.isArray(obj)) {
            for (var i_1 = 0, len = obj.length; i_1 < len; i_1++) {
              if (hasUndefined(obj[i_1])) {
                return true;
              }
            }
          } else if (typeof obj === "object") {
            var objKeys = _objectKeys(obj);
            var objKeysLength = objKeys.length;
            for (var i = 0; i < objKeysLength; i++) {
              if (hasUndefined(obj[objKeys[i]])) {
                return true;
              }
            }
          }
        }
        return false;
      }
      exports.hasUndefined = hasUndefined;
      function patchErrorMessageFormatter(message, args) {
        var messageParts = [message];
        for (var key in args) {
          var value =
            typeof args[key] === "object"
              ? JSON.stringify(args[key], null, 2)
              : args[key]; // pretty print
          if (typeof value !== "undefined") {
            messageParts.push(key + ": " + value);
          }
        }
        return messageParts.join("\n");
      }
      var PatchError = /** @class */ (function (_super) {
        __extends(PatchError, _super);
        function PatchError(message, name, index, operation, tree) {
          var _newTarget = this.constructor;
          var _this =
            _super.call(
              this,
              patchErrorMessageFormatter(message, {
                name: name,
                index: index,
                operation: operation,
                tree: tree,
              })
            ) || this;
          _this.name = name;
          _this.index = index;
          _this.operation = operation;
          _this.tree = tree;
          Object.setPrototypeOf(_this, _newTarget.prototype); // restore prototype chain, see https://stackoverflow.com/a/48342359
          _this.message = patchErrorMessageFormatter(message, {
            name: name,
            index: index,
            operation: operation,
            tree: tree,
          });
          return _this;
        }
        return PatchError;
      })(Error);
      exports.PatchError = PatchError;

      /***/
    },
    /* 1 */
    /***/ function (module, exports, __webpack_require__) {
      Object.defineProperty(exports, "__esModule", { value: true });
      var helpers_js_1 = __webpack_require__(0);
      exports.JsonPatchError = helpers_js_1.PatchError;
      exports.deepClone = helpers_js_1._deepClone;
      /* We use a Javascript hash to store each
 function. Each hash entry (property) uses
 the operation identifiers specified in rfc6902.
 In this way, we can map each patch operation
 to its dedicated function in efficient way.
 */
      /* The operations applicable to an object */
      var objOps = {
        add: function (obj, key, document) {
          obj[key] = this.value;
          return { newDocument: document };
        },
        remove: function (obj, key, document) {
          var removed = obj[key];
          delete obj[key];
          return { newDocument: document, removed: removed };
        },
        replace: function (obj, key, document) {
          var removed = obj[key];
          obj[key] = this.value;
          return { newDocument: document, removed: removed };
        },
        move: function (obj, key, document) {
          /* in case move target overwrites an existing value,
        return the removed value, this can be taxing performance-wise,
        and is potentially unneeded */
          var removed = getValueByPointer(document, this.path);
          if (removed) {
            removed = helpers_js_1._deepClone(removed);
          }
          var originalValue = applyOperation(document, {
            op: "remove",
            path: this.from,
          }).removed;
          applyOperation(document, {
            op: "add",
            path: this.path,
            value: originalValue,
          });
          return { newDocument: document, removed: removed };
        },
        copy: function (obj, key, document) {
          var valueToCopy = getValueByPointer(document, this.from);
          // enforce copy by value so further operations don't affect source (see issue #177)
          applyOperation(document, {
            op: "add",
            path: this.path,
            value: helpers_js_1._deepClone(valueToCopy),
          });
          return { newDocument: document };
        },
        test: function (obj, key, document) {
          return {
            newDocument: document,
            test: _areEquals(obj[key], this.value),
          };
        },
        _get: function (obj, key, document) {
          this.value = obj[key];
          return { newDocument: document };
        },
      };
      /* The operations applicable to an array. Many are the same as for the object */
      var arrOps = {
        add: function (arr, i, document) {
          if (helpers_js_1.isInteger(i)) {
            arr.splice(i, 0, this.value);
          } else {
            // array props
            arr[i] = this.value;
          }
          // this may be needed when using '-' in an array
          return { newDocument: document, index: i };
        },
        remove: function (arr, i, document) {
          var removedList = arr.splice(i, 1);
          return { newDocument: document, removed: removedList[0] };
        },
        replace: function (arr, i, document) {
          var removed = arr[i];
          arr[i] = this.value;
          return { newDocument: document, removed: removed };
        },
        move: objOps.move,
        copy: objOps.copy,
        test: objOps.test,
        _get: objOps._get,
      };
      /**
       * Retrieves a value from a JSON document by a JSON pointer.
       * Returns the value.
       *
       * @param document The document to get the value from
       * @param pointer an escaped JSON pointer
       * @return The retrieved value
       */
      function getValueByPointer(document, pointer) {
        if (pointer == "") {
          return document;
        }
        var getOriginalDestination = { op: "_get", path: pointer };
        applyOperation(document, getOriginalDestination);
        return getOriginalDestination.value;
      }
      exports.getValueByPointer = getValueByPointer;
      /**
       * Apply a single JSON Patch Operation on a JSON document.
       * Returns the {newDocument, result} of the operation.
       * It modifies the `document` and `operation` objects - it gets the values by reference.
       * If you would like to avoid touching your values, clone them:
       * `jsonpatch.applyOperation(document, jsonpatch._deepClone(operation))`.
       *
       * @param document The document to patch
       * @param operation The operation to apply
       * @param validateOperation `false` is without validation, `true` to use default jsonpatch's validation, or you can pass a `validateOperation` callback to be used for validation.
       * @param mutateDocument Whether to mutate the original document or clone it before applying
       * @param banPrototypeModifications Whether to ban modifications to `__proto__`, defaults to `true`.
       * @return `{newDocument, result}` after the operation
       */
      function applyOperation(
        document,
        operation,
        validateOperation,
        mutateDocument,
        banPrototypeModifications,
        index
      ) {
        if (validateOperation === void 0) {
          validateOperation = false;
        }
        if (mutateDocument === void 0) {
          mutateDocument = true;
        }
        if (banPrototypeModifications === void 0) {
          banPrototypeModifications = true;
        }
        if (index === void 0) {
          index = 0;
        }
        if (validateOperation) {
          if (typeof validateOperation == "function") {
            validateOperation(operation, 0, document, operation.path);
          } else {
            validator(operation, 0);
          }
        }
        /* ROOT OPERATIONS */
        if (operation.path === "") {
          var returnValue = { newDocument: document };
          if (operation.op === "add") {
            returnValue.newDocument = operation.value;
            return returnValue;
          } else if (operation.op === "replace") {
            returnValue.newDocument = operation.value;
            returnValue.removed = document; //document we removed
            return returnValue;
          } else if (operation.op === "move" || operation.op === "copy") {
            // it's a move or copy to root
            returnValue.newDocument = getValueByPointer(
              document,
              operation.from
            ); // get the value by json-pointer in `from` field
            if (operation.op === "move") {
              // report removed item
              returnValue.removed = document;
            }
            return returnValue;
          } else if (operation.op === "test") {
            returnValue.test = _areEquals(document, operation.value);
            if (returnValue.test === false) {
              throw new exports.JsonPatchError(
                "Test operation failed",
                "TEST_OPERATION_FAILED",
                index,
                operation,
                document
              );
            }
            returnValue.newDocument = document;
            return returnValue;
          } else if (operation.op === "remove") {
            // a remove on root
            returnValue.removed = document;
            returnValue.newDocument = null;
            return returnValue;
          } else if (operation.op === "_get") {
            operation.value = document;
            return returnValue;
          } else {
            /* bad operation */
            if (validateOperation) {
              throw new exports.JsonPatchError(
                "Operation `op` property is not one of operations defined in RFC-6902",
                "OPERATION_OP_INVALID",
                index,
                operation,
                document
              );
            } else {
              return returnValue;
            }
          }
        } /* END ROOT OPERATIONS */ else {
          if (!mutateDocument) {
            document = helpers_js_1._deepClone(document);
          }
          var path = operation.path || "";
          var keys = path.split("/");
          var obj = document;
          var t = 1; //skip empty element - http://jsperf.com/to-shift-or-not-to-shift
          var len = keys.length;
          var existingPathFragment = undefined;
          var key = void 0;
          var validateFunction = void 0;
          if (typeof validateOperation == "function") {
            validateFunction = validateOperation;
          } else {
            validateFunction = validator;
          }
          while (true) {
            key = keys[t];
            if (key && key.indexOf("~") != -1) {
              key = helpers_js_1.unescapePathComponent(key);
            }
            if (
              banPrototypeModifications &&
              (key == "__proto__" ||
                (key == "prototype" && t > 0 && keys[t - 1] == "constructor"))
            ) {
              throw new TypeError(
                "JSON-Patch: modifying `__proto__` or `constructor/prototype` prop is banned for security reasons, if this was on purpose, please set `banPrototypeModifications` flag false and pass it to this function. More info in fast-json-patch README"
              );
            }
            if (validateOperation) {
              if (existingPathFragment === undefined) {
                if (obj[key] === undefined) {
                  existingPathFragment = keys.slice(0, t).join("/");
                } else if (t == len - 1) {
                  existingPathFragment = operation.path;
                }
                if (existingPathFragment !== undefined) {
                  validateFunction(
                    operation,
                    0,
                    document,
                    existingPathFragment
                  );
                }
              }
            }
            t++;
            if (Array.isArray(obj)) {
              if (key === "-") {
                key = obj.length;
              } else {
                if (validateOperation && !helpers_js_1.isInteger(key)) {
                  throw new exports.JsonPatchError(
                    "Expected an unsigned base-10 integer value, making the new referenced value the array element with the zero-based index",
                    "OPERATION_PATH_ILLEGAL_ARRAY_INDEX",
                    index,
                    operation,
                    document
                  );
                } // only parse key when it's an integer for `arr.prop` to work
                else if (helpers_js_1.isInteger(key)) {
                  key = ~~key;
                }
              }
              if (t >= len) {
                if (
                  validateOperation &&
                  operation.op === "add" &&
                  key > obj.length
                ) {
                  throw new exports.JsonPatchError(
                    "The specified index MUST NOT be greater than the number of elements in the array",
                    "OPERATION_VALUE_OUT_OF_BOUNDS",
                    index,
                    operation,
                    document
                  );
                }
                var returnValue = arrOps[operation.op].call(
                  operation,
                  obj,
                  key,
                  document
                ); // Apply patch
                if (returnValue.test === false) {
                  throw new exports.JsonPatchError(
                    "Test operation failed",
                    "TEST_OPERATION_FAILED",
                    index,
                    operation,
                    document
                  );
                }
                return returnValue;
              }
            } else {
              if (t >= len) {
                var returnValue = objOps[operation.op].call(
                  operation,
                  obj,
                  key,
                  document
                ); // Apply patch
                if (returnValue.test === false) {
                  throw new exports.JsonPatchError(
                    "Test operation failed",
                    "TEST_OPERATION_FAILED",
                    index,
                    operation,
                    document
                  );
                }
                return returnValue;
              }
            }
            obj = obj[key];
            // If we have more keys in the path, but the next value isn't a non-null object,
            // throw an OPERATION_PATH_UNRESOLVABLE error instead of iterating again.
            if (
              validateOperation &&
              t < len &&
              (!obj || typeof obj !== "object")
            ) {
              throw new exports.JsonPatchError(
                "Cannot perform operation at the desired path",
                "OPERATION_PATH_UNRESOLVABLE",
                index,
                operation,
                document
              );
            }
          }
        }
      }
      exports.applyOperation = applyOperation;
      /**
       * Apply a full JSON Patch array on a JSON document.
       * Returns the {newDocument, result} of the patch.
       * It modifies the `document` object and `patch` - it gets the values by reference.
       * If you would like to avoid touching your values, clone them:
       * `jsonpatch.applyPatch(document, jsonpatch._deepClone(patch))`.
       *
       * @param document The document to patch
       * @param patch The patch to apply
       * @param validateOperation `false` is without validation, `true` to use default jsonpatch's validation, or you can pass a `validateOperation` callback to be used for validation.
       * @param mutateDocument Whether to mutate the original document or clone it before applying
       * @param banPrototypeModifications Whether to ban modifications to `__proto__`, defaults to `true`.
       * @return An array of `{newDocument, result}` after the patch
       */
      function applyPatch(
        document,
        patch,
        validateOperation = false,
        mutateDocument = true,
        banPrototypeModifications = true
      ) {
        if (mutateDocument === void 0) {
          mutateDocument = true;
        }
        if (banPrototypeModifications === void 0) {
          banPrototypeModifications = true;
        }
        if (validateOperation) {
          if (!Array.isArray(patch)) {
            throw new exports.JsonPatchError(
              "Patch sequence must be an array",
              "SEQUENCE_NOT_AN_ARRAY"
            );
          }
        }
        if (!mutateDocument) {
          document = helpers_js_1._deepClone(document);
        }
        var results = new Array(patch.length);
        for (var i = 0, length_1 = patch.length; i < length_1; i++) {
          // we don't need to pass mutateDocument argument because if it was true, we already deep cloned the object, we'll just pass `true`
          results[i] = applyOperation(
            document,
            patch[i],
            validateOperation,
            true,
            banPrototypeModifications,
            i
          );
          document = results[i].newDocument; // in case root was replaced
        }
        results.newDocument = document;
        return results;
      }
      exports.applyPatch = applyPatch;
      /**
       * Apply a single JSON Patch Operation on a JSON document.
       * Returns the updated document.
       * Suitable as a reducer.
       *
       * @param document The document to patch
       * @param operation The operation to apply
       * @return The updated document
       */
      function applyReducer(document, operation, index) {
        var operationResult = applyOperation(document, operation);
        if (operationResult.test === false) {
          // failed test
          throw new exports.JsonPatchError(
            "Test operation failed",
            "TEST_OPERATION_FAILED",
            index,
            operation,
            document
          );
        }
        return operationResult.newDocument;
      }
      exports.applyReducer = applyReducer;
      /**
       * Validates a single operation. Called from `jsonpatch.validate`. Throws `JsonPatchError` in case of an error.
       * @param {object} operation - operation object (patch)
       * @param {number} index - index of operation in the sequence
       * @param {object} [document] - object where the operation is supposed to be applied
       * @param {string} [existingPathFragment] - comes along with `document`
       */
      function validator(operation, index, document, existingPathFragment) {
        if (
          typeof operation !== "object" ||
          operation === null ||
          Array.isArray(operation)
        ) {
          throw new exports.JsonPatchError(
            "Operation is not an object",
            "OPERATION_NOT_AN_OBJECT",
            index,
            operation,
            document
          );
        } else if (!objOps[operation.op]) {
          throw new exports.JsonPatchError(
            "Operation `op` property is not one of operations defined in RFC-6902",
            "OPERATION_OP_INVALID",
            index,
            operation,
            document
          );
        } else if (typeof operation.path !== "string") {
          throw new exports.JsonPatchError(
            "Operation `path` property is not a string",
            "OPERATION_PATH_INVALID",
            index,
            operation,
            document
          );
        } else if (
          operation.path.indexOf("/") !== 0 &&
          operation.path.length > 0
        ) {
          // paths that aren't empty string should start with "/"
          throw new exports.JsonPatchError(
            'Operation `path` property must start with "/"',
            "OPERATION_PATH_INVALID",
            index,
            operation,
            document
          );
        } else if (
          (operation.op === "move" || operation.op === "copy") &&
          typeof operation.from !== "string"
        ) {
          throw new exports.JsonPatchError(
            "Operation `from` property is not present (applicable in `move` and `copy` operations)",
            "OPERATION_FROM_REQUIRED",
            index,
            operation,
            document
          );
        } else if (
          (operation.op === "add" ||
            operation.op === "replace" ||
            operation.op === "test") &&
          operation.value === undefined
        ) {
          throw new exports.JsonPatchError(
            "Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)",
            "OPERATION_VALUE_REQUIRED",
            index,
            operation,
            document
          );
        } else if (
          (operation.op === "add" ||
            operation.op === "replace" ||
            operation.op === "test") &&
          helpers_js_1.hasUndefined(operation.value)
        ) {
          throw new exports.JsonPatchError(
            "Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)",
            "OPERATION_VALUE_CANNOT_CONTAIN_UNDEFINED",
            index,
            operation,
            document
          );
        } else if (document) {
          if (operation.op == "add") {
            var pathLen = operation.path.split("/").length;
            var existingPathLen = existingPathFragment.split("/").length;
            if (
              pathLen !== existingPathLen + 1 &&
              pathLen !== existingPathLen
            ) {
              throw new exports.JsonPatchError(
                "Cannot perform an `add` operation at the desired path",
                "OPERATION_PATH_CANNOT_ADD",
                index,
                operation,
                document
              );
            }
          } else if (
            operation.op === "replace" ||
            operation.op === "remove" ||
            operation.op === "_get"
          ) {
            if (operation.path !== existingPathFragment) {
              throw new exports.JsonPatchError(
                "Cannot perform the operation at a path that does not exist",
                "OPERATION_PATH_UNRESOLVABLE",
                index,
                operation,
                document
              );
            }
          } else if (operation.op === "move" || operation.op === "copy") {
            var existingValue = {
              op: "_get",
              path: operation.from,
              value: undefined,
            };
            var error = validate([existingValue], document);
            if (error && error.name === "OPERATION_PATH_UNRESOLVABLE") {
              throw new exports.JsonPatchError(
                "Cannot perform the operation from a path that does not exist",
                "OPERATION_FROM_UNRESOLVABLE",
                index,
                operation,
                document
              );
            }
          }
        }
      }
      exports.validator = validator;
      /**
       * Validates a sequence of operations. If `document` parameter is provided, the sequence is additionally validated against the object document.
       * If error is encountered, returns a JsonPatchError object
       * @param sequence
       * @param document
       * @returns {JsonPatchError|undefined}
       */
      function validate(sequence, document, externalValidator) {
        try {
          if (!Array.isArray(sequence)) {
            throw new exports.JsonPatchError(
              "Patch sequence must be an array",
              "SEQUENCE_NOT_AN_ARRAY"
            );
          }
          if (document) {
            //clone document and sequence so that we can safely try applying operations
            applyPatch(
              helpers_js_1._deepClone(document),
              helpers_js_1._deepClone(sequence),
              externalValidator || true
            );
          } else {
            externalValidator = externalValidator || validator;
            for (var i = 0; i < sequence.length; i++) {
              externalValidator(sequence[i], i, document, undefined);
            }
          }
        } catch (e) {
          if (e instanceof exports.JsonPatchError) {
            return e;
          } else {
            throw e;
          }
        }
      }
      exports.validate = validate;
      // based on https://github.com/epoberezkin/fast-deep-equal
      // MIT License
      // Copyright (c) 2017 Evgeny Poberezkin
      // Permission is hereby granted, free of charge, to any person obtaining a copy
      // of this software and associated documentation files (the "Software"), to deal
      // in the Software without restriction, including without limitation the rights
      // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
      // copies of the Software, and to permit persons to whom the Software is
      // furnished to do so, subject to the following conditions:
      // The above copyright notice and this permission notice shall be included in all
      // copies or substantial portions of the Software.
      // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
      // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
      // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
      // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
      // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
      // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
      // SOFTWARE.
      function _areEquals(a, b) {
        if (a === b) return true;
        if (a && b && typeof a == "object" && typeof b == "object") {
          var arrA = Array.isArray(a),
            arrB = Array.isArray(b),
            i,
            length,
            key;
          if (arrA && arrB) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- !== 0; )
              if (!_areEquals(a[i], b[i])) return false;
            return true;
          }
          if (arrA != arrB) return false;
          var keys = Object.keys(a);
          length = keys.length;
          if (length !== Object.keys(b).length) return false;
          for (i = length; i-- !== 0; )
            if (!b.hasOwnProperty(keys[i])) return false;
          for (i = length; i-- !== 0; ) {
            key = keys[i];
            if (!_areEquals(a[key], b[key])) return false;
          }
          return true;
        }
        return a !== a && b !== b;
      }
      exports._areEquals = _areEquals;

      /***/
    },
    /* 2 */
    /***/ function (module, exports, __webpack_require__) {
      var core = __webpack_require__(1);
      Object.assign(exports, core);

      var duplex = __webpack_require__(3);
      Object.assign(exports, duplex);

      var helpers = __webpack_require__(0);
      exports.JsonPatchError = helpers.PatchError;
      exports.deepClone = helpers._deepClone;
      exports.escapePathComponent = helpers.escapePathComponent;
      exports.unescapePathComponent = helpers.unescapePathComponent;

      /***/
    },
    /* 3 */
    /***/ function (module, exports, __webpack_require__) {
      Object.defineProperty(exports, "__esModule", { value: true });
      /*!
       * https://github.com/Starcounter-Jack/JSON-Patch
       * (c) 2017-2021 Joachim Wester
       * MIT license
       */
      var helpers_js_1 = __webpack_require__(0);
      var core_js_1 = __webpack_require__(1);
      var beforeDict = new WeakMap();
      var Mirror = /** @class */ (function () {
        function Mirror(obj) {
          this.observers = new Map();
          this.obj = obj;
        }
        return Mirror;
      })();
      var ObserverInfo = /** @class */ (function () {
        function ObserverInfo(callback, observer) {
          this.callback = callback;
          this.observer = observer;
        }
        return ObserverInfo;
      })();
      function getMirror(obj) {
        return beforeDict.get(obj);
      }
      function getObserverFromMirror(mirror, callback) {
        return mirror.observers.get(callback);
      }
      function removeObserverFromMirror(mirror, observer) {
        mirror.observers.delete(observer.callback);
      }
      /**
       * Detach an observer from an object
       */
      function unobserve(root, observer) {
        observer.unobserve();
      }
      exports.unobserve = unobserve;
      /**
       * Observes changes made to an object, which can then be retrieved using generate
       */
      function observe(obj, callback) {
        var patches = [];
        var observer;
        var mirror = getMirror(obj);
        if (!mirror) {
          mirror = new Mirror(obj);
          beforeDict.set(obj, mirror);
        } else {
          var observerInfo = getObserverFromMirror(mirror, callback);
          observer = observerInfo && observerInfo.observer;
        }
        if (observer) {
          return observer;
        }
        observer = {};
        mirror.value = helpers_js_1._deepClone(obj);
        if (callback) {
          observer.callback = callback;
          observer.next = null;
          var dirtyCheck = function () {
            generate(observer);
          };
          var fastCheck = function () {
            clearTimeout(observer.next);
            observer.next = setTimeout(dirtyCheck);
          };
          if (typeof window !== "undefined") {
            //not Node
            window.addEventListener("mouseup", fastCheck);
            window.addEventListener("keyup", fastCheck);
            window.addEventListener("mousedown", fastCheck);
            window.addEventListener("keydown", fastCheck);
            window.addEventListener("change", fastCheck);
          }
        }
        observer.patches = patches;
        observer.object = obj;
        observer.unobserve = function () {
          generate(observer);
          clearTimeout(observer.next);
          removeObserverFromMirror(mirror, observer);
          if (typeof window !== "undefined") {
            window.removeEventListener("mouseup", fastCheck);
            window.removeEventListener("keyup", fastCheck);
            window.removeEventListener("mousedown", fastCheck);
            window.removeEventListener("keydown", fastCheck);
            window.removeEventListener("change", fastCheck);
          }
        };
        mirror.observers.set(callback, new ObserverInfo(callback, observer));
        return observer;
      }
      exports.observe = observe;
      /**
       * Generate an array of patches from an observer
       */
      function generate(observer, invertible) {
        if (invertible === void 0) {
          invertible = false;
        }
        var mirror = beforeDict.get(observer.object);
        _generate(
          mirror.value,
          observer.object,
          observer.patches,
          "",
          invertible
        );
        if (observer.patches.length) {
          core_js_1.applyPatch(mirror.value, observer.patches);
        }
        var temp = observer.patches;
        if (temp.length > 0) {
          observer.patches = [];
          if (observer.callback) {
            observer.callback(temp);
          }
        }
        return temp;
      }
      exports.generate = generate;
      // Dirty check if obj is different from mirror, generate patches and update mirror
      function _generate(mirror, obj, patches, path, invertible) {
        if (obj === mirror) {
          return;
        }
        if (typeof obj.toJSON === "function") {
          obj = obj.toJSON();
        }
        var newKeys = helpers_js_1._objectKeys(obj);
        var oldKeys = helpers_js_1._objectKeys(mirror);
        var changed = false;
        var deleted = false;
        //if ever "move" operation is implemented here, make sure this test runs OK: "should not generate the same patch twice (move)"
        for (var t = oldKeys.length - 1; t >= 0; t--) {
          var key = oldKeys[t];
          var oldVal = mirror[key];
          if (
            helpers_js_1.hasOwnProperty(obj, key) &&
            !(
              obj[key] === undefined &&
              oldVal !== undefined &&
              Array.isArray(obj) === false
            )
          ) {
            var newVal = obj[key];
            if (
              typeof oldVal == "object" &&
              oldVal != null &&
              typeof newVal == "object" &&
              newVal != null &&
              Array.isArray(oldVal) === Array.isArray(newVal)
            ) {
              _generate(
                oldVal,
                newVal,
                patches,
                path + "/" + helpers_js_1.escapePathComponent(key),
                invertible
              );
            } else {
              if (oldVal !== newVal) {
                changed = true;
                if (invertible) {
                  patches.push({
                    op: "test",
                    path: path + "/" + helpers_js_1.escapePathComponent(key),
                    value: helpers_js_1._deepClone(oldVal),
                  });
                }
                patches.push({
                  op: "replace",
                  path: path + "/" + helpers_js_1.escapePathComponent(key),
                  value: helpers_js_1._deepClone(newVal),
                });
              }
            }
          } else if (Array.isArray(mirror) === Array.isArray(obj)) {
            if (invertible) {
              patches.push({
                op: "test",
                path: path + "/" + helpers_js_1.escapePathComponent(key),
                value: helpers_js_1._deepClone(oldVal),
              });
            }
            patches.push({
              op: "remove",
              path: path + "/" + helpers_js_1.escapePathComponent(key),
            });
            deleted = true; // property has been deleted
          } else {
            if (invertible) {
              patches.push({ op: "test", path: path, value: mirror });
            }
            patches.push({ op: "replace", path: path, value: obj });
            changed = true;
          }
        }
        if (!deleted && newKeys.length == oldKeys.length) {
          return;
        }
        for (var t = 0; t < newKeys.length; t++) {
          var key = newKeys[t];
          if (
            !helpers_js_1.hasOwnProperty(mirror, key) &&
            obj[key] !== undefined
          ) {
            patches.push({
              op: "add",
              path: path + "/" + helpers_js_1.escapePathComponent(key),
              value: helpers_js_1._deepClone(obj[key]),
            });
          }
        }
      }
      /**
       * Create an array of patches from the differences in two objects
       */
      function compare(tree1, tree2, invertible) {
        if (invertible === void 0) {
          invertible = false;
        }
        var patches = [];
        _generate(tree1, tree2, patches, "", invertible);
        return patches;
      }
      exports.compare = compare;

      /***/
    },
    /******/
  ]
);

export default jsonpatch;
