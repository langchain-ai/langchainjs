import * as yaml from "js-yaml";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export class OpenAPISpec {
  constructor(public document: OpenAPIV3_1.Document) {}

  get baseUrl() {
    return this.document.servers ? this.document.servers[0].url : undefined;
  }

  getPathsStrict() {
    if (!this.document.paths) {
      throw new Error("No paths found in spec");
    }
    return this.document.paths;
  }

  getParametersStrict() {
    if (!this.document.components?.parameters) {
      throw new Error("No parameters found in spec");
    }
    return this.document.components.parameters;
  }

  getSchemasStrict() {
    if (!this.document.components?.schemas) {
      throw new Error("No schemas found in spec.");
    }
    return this.document.components.schemas;
  }

  getRequestBodiesStrict() {
    if (!this.document.components?.requestBodies) {
      throw new Error("No request body found in spec.");
    }
    return this.document.components.requestBodies;
  }

  getPathStrict(path: string) {
    const pathItem = this.getPathsStrict()[path];
    if (pathItem === undefined) {
      throw new Error(`No path found for "${path}".`);
    }
    return pathItem;
  }

  getReferencedParameter(ref: OpenAPIV3_1.ReferenceObject) {
    const refComponents = ref.$ref.split("/");
    const refName = refComponents[refComponents.length - 1];
    if (this.getParametersStrict()[refName] === undefined) {
      throw new Error(`No parameter found for "${refName}".`);
    }
    return this.getParametersStrict()[refName];
  }

  getRootReferencedParameter(
    ref: OpenAPIV3_1.ReferenceObject
  ): OpenAPIV3_1.ParameterObject {
    let parameter = this.getReferencedParameter(ref);
    while ((parameter as OpenAPIV3_1.ReferenceObject).$ref !== undefined) {
      parameter = this.getReferencedParameter(
        parameter as OpenAPIV3_1.ReferenceObject
      );
    }
    return parameter as OpenAPIV3_1.ParameterObject;
  }

  getReferencedSchema(
    ref: OpenAPIV3_1.ReferenceObject
  ): OpenAPIV3_1.SchemaObject {
    const refComponents = ref.$ref.split("/");
    const refName = refComponents[refComponents.length - 1];
    const schema = this.getSchemasStrict()[refName];
    if (schema === undefined) {
      throw new Error(`No schema found for "${refName}".`);
    }
    return schema;
  }

  getSchema(
    schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject
  ): OpenAPIV3_1.SchemaObject {
    if ((schema as OpenAPIV3_1.ReferenceObject).$ref !== undefined) {
      return this.getReferencedSchema(schema as OpenAPIV3_1.ReferenceObject);
    }
    return schema;
  }

  getRootReferencedSchema(ref: OpenAPIV3_1.ReferenceObject) {
    let schema = this.getReferencedSchema(ref);
    while ((schema as OpenAPIV3_1.ReferenceObject).$ref !== undefined) {
      schema = this.getReferencedSchema(schema as OpenAPIV3_1.ReferenceObject);
    }
    return schema as OpenAPIV3_1.ParameterObject;
  }

  getReferencedRequestBody(ref: OpenAPIV3_1.ReferenceObject) {
    const refComponents = ref.$ref.split("/");
    const refName = refComponents[refComponents.length - 1];
    const requestBodies = this.getRequestBodiesStrict();
    if (requestBodies[refName] === undefined) {
      throw new Error(`No request body found for "${refName}"`);
    }
    return requestBodies[refName];
  }

  getRootReferencedRequestBody(ref: OpenAPIV3_1.ReferenceObject) {
    let requestBody = this.getReferencedRequestBody(ref);
    while ((requestBody as OpenAPIV3_1.ReferenceObject).$ref !== undefined) {
      requestBody = this.getReferencedRequestBody(
        requestBody as OpenAPIV3_1.ReferenceObject
      );
    }
    return requestBody as OpenAPIV3_1.RequestBodyObject;
  }

  getMethodsForPath(path: string): OpenAPIV3.HttpMethods[] {
    const pathItem = this.getPathStrict(path);
    // This is an enum in the underlying package.
    // Werestate here to allow "import type" above and not cause warnings in certain envs.
    const possibleMethods = [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace",
    ];
    return possibleMethods.filter(
      (possibleMethod) =>
        pathItem[possibleMethod as OpenAPIV3.HttpMethods] !== undefined
    ) as OpenAPIV3.HttpMethods[];
  }

  getParametersForPath(path: string) {
    const pathItem = this.getPathStrict(path);
    if (pathItem.parameters === undefined) {
      return [];
    }
    return pathItem.parameters.map((parameter) => {
      if ((parameter as OpenAPIV3_1.ReferenceObject).$ref !== undefined) {
        return this.getRootReferencedParameter(
          parameter as OpenAPIV3_1.ReferenceObject
        );
      }
      return parameter as OpenAPIV3_1.ParameterObject;
    });
  }

  getOperation(path: string, method: OpenAPIV3.HttpMethods) {
    const pathItem = this.getPathStrict(path);
    if (pathItem[method] === undefined) {
      throw new Error(`No ${method} method found for "path".`);
    }
    return pathItem[method];
  }

  getParametersForOperation(operation: OpenAPIV3_1.OperationObject) {
    if (operation.parameters === undefined) {
      return [];
    }
    return operation.parameters.map((parameter) => {
      if ((parameter as OpenAPIV3_1.ReferenceObject).$ref !== undefined) {
        return this.getRootReferencedParameter(
          parameter as OpenAPIV3_1.ReferenceObject
        );
      }
      return parameter as OpenAPIV3_1.ParameterObject;
    });
  }

  getRequestBodyForOperation(
    operation: OpenAPIV3_1.OperationObject
  ): OpenAPIV3_1.RequestBodyObject {
    const { requestBody } = operation;
    if ((requestBody as OpenAPIV3_1.ReferenceObject)?.$ref !== undefined) {
      return this.getRootReferencedRequestBody(
        requestBody as OpenAPIV3_1.ReferenceObject
      );
    }
    return requestBody as OpenAPIV3_1.RequestBodyObject;
  }

  static getCleanedOperationId(
    operation: OpenAPIV3_1.OperationObject,
    path: string,
    method: OpenAPIV3_1.HttpMethods
  ) {
    let { operationId } = operation;
    if (operationId === undefined) {
      const updatedPath = path.replaceAll(/[^a-zA-Z0-9]/, "_");
      operationId = `${
        updatedPath.startsWith("/") ? updatedPath.slice(1) : updatedPath
      }_${method}`;
    }
    return operationId
      .replaceAll("-", "_")
      .replaceAll(".", "_")
      .replaceAll("/", "_");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static alertUnsupportedSpec(document: Record<string, any>) {
    const warningMessage =
      "This may result in degraded performance. Convert your OpenAPI spec to 3.1.0 for better support.";
    const swaggerVersion = document.swagger;
    const openAPIVersion = document.openapi;
    if (openAPIVersion !== undefined && openAPIVersion !== "3.1.0") {
      console.warn(
        `Attempting to load an OpenAPI ${openAPIVersion} spec. ${warningMessage}`
      );
    } else if (swaggerVersion !== undefined) {
      console.warn(
        `Attempting to load a Swagger ${swaggerVersion} spec. ${warningMessage}`
      );
    } else {
      throw new Error(
        `Attempting to load an unsupported spec:\n\n${JSON.stringify(
          document,
          null,
          2
        )}.`
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromObject(document: Record<string, any>) {
    OpenAPISpec.alertUnsupportedSpec(document);
    return new OpenAPISpec(document as OpenAPIV3_1.Document);
  }

  static fromString(rawString: string) {
    let document;
    try {
      document = JSON.parse(rawString);
    } catch (e) {
      document = yaml.load(rawString);
    }
    return OpenAPISpec.fromObject(document);
  }

  static async fromURL(url: string) {
    const response = await fetch(url);
    const rawDocument = await response.text();
    return OpenAPISpec.fromString(rawDocument);
  }
}
