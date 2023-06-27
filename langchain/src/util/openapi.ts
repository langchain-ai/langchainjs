import * as yaml from "yaml";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import Document = OpenAPIV3_1.Document;
import ReferenceObject = OpenAPIV3_1.ReferenceObject;
import ParameterObject = OpenAPIV3_1.ParameterObject;
import SchemaObject = OpenAPIV3_1.SchemaObject;
import RequestBodyObject = OpenAPIV3_1.RequestBodyObject;
import OperationObject = OpenAPIV3_1.OperationObject;

export class OpenAPISpec {
  constructor(public document: Document) {}

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
      throw new Error(`No path found for "${path}".`) ;
    }
    return pathItem;
  }

  getReferencedParameter(ref: ReferenceObject) {
    const refComponents = ref.$ref.split("/");
    const refName = refComponents[refComponents.length - 1];
    if (this.getParametersStrict()[refName] === undefined) {
      throw new Error(`No parameter found for "${refName}".`);
    }
    return this.getParametersStrict()[refName];
  }

  getRootReferencedParameter(ref: ReferenceObject): ParameterObject {
    let parameter = this.getReferencedParameter(ref);
    while ((parameter as ReferenceObject).$ref !== undefined) {
      parameter = this.getReferencedParameter(parameter as ReferenceObject);
    }
    return parameter as ParameterObject;
  }

  getReferencedSchema(ref: ReferenceObject): SchemaObject {
    const refComponents = ref.$ref.split("/");
    const refName = refComponents[refComponents.length - 1];
    const schema = this.getSchemasStrict()[refName];
    if (schema === undefined) {
      throw new Error(`No schema found for "${refName}".`);
    }
    return schema;
  }

  getSchema(schema: ReferenceObject | SchemaObject): SchemaObject {
    if ((schema as ReferenceObject).$ref !== undefined) {
      return this.getReferencedSchema(schema as ReferenceObject);
    }
    return schema;
  }

  getRootReferencedSchema(ref: ReferenceObject) {
    let schema = this.getReferencedSchema(ref);
    while ((schema as ReferenceObject).$ref !== undefined) {
      schema = this.getReferencedSchema(schema as ReferenceObject);
    }
    return schema as ParameterObject;
  }

  getReferencedRequestBody(ref: ReferenceObject) {
    const refComponents = ref.$ref.split("/");
    const refName = refComponents[refComponents.length - 1];
    const requestBodies = this.getRequestBodiesStrict();
    if (requestBodies[refName] === undefined) {
      throw new Error(`No request body found for "${refName}"`);
    }
    return requestBodies[refName];
  }

  getRootReferencedRequestBody(ref: ReferenceObject) {
    let requestBody = this.getReferencedRequestBody(ref);
    while ((requestBody as ReferenceObject).$ref !== undefined) {
      requestBody = this.getReferencedRequestBody(requestBody as ReferenceObject);
    }
    return requestBody as RequestBodyObject;
  }

  getMethodsForPath(path: string) {
    const pathItem = this.getPathStrict(path);
    const possibleMethods = Object.values(OpenAPIV3.HttpMethods);
    return possibleMethods.filter((possibleMethod) => {
      return pathItem[possibleMethod] !== undefined;
    });
  }

  getParametersForPath(path: string) {
    const pathItem = this.getPathStrict(path);
    if (pathItem.parameters === undefined) {
      return [];
    }
    return pathItem.parameters.map((parameter) => {
      if ((parameter as ReferenceObject).$ref !== undefined) {
        return this.getRootReferencedParameter(parameter as ReferenceObject);
      }
      return parameter as ParameterObject;
    });
  }

  getOperation(path: string, method: OpenAPIV3.HttpMethods) {
    const pathItem = this.getPathStrict(path);
    if (pathItem[method] === undefined) {
      throw new Error(`No ${method} method found for "path".`);
    }
    return pathItem[method];
  }

  getParametersForOperation(operation: OperationObject) {
    if (operation.parameters === undefined) {
      return [];
    }
    return operation.parameters.map((parameter) => {
      if ((parameter as ReferenceObject).$ref !== undefined) {
        return this.getRootReferencedParameter(parameter as ReferenceObject);
      }
      return parameter as ParameterObject;
    });
  }

  getRequestBodyForOperation(operation: OperationObject) {
    const requestBody = operation.requestBody;
    if ((requestBody as ReferenceObject)?.$ref !== undefined) {
      return this.getRootReferencedRequestBody(requestBody as ReferenceObject);
    }
    return requestBody;
  }

  static getCleanedOperationId(operation: OperationObject, path: string, method: OpenAPIV3_1.HttpMethods) {
    let operationId = operation.operationId;
    if (operationId === undefined) {
      const updatedPath = path.replace(/[^a-zA-Z0-9]/, "_");
      operationId = `${updatedPath.startsWith("/") ? updatedPath.slice(1) : updatedPath}_${method}`;
    }
    return operationId.replace("-", "_").replace(".", "_").replace("/", "_");
  }

  static alertUnsupportedSpec(document: Record<string, any>) {
    const warningMessage = "This may result in degraded performance. Convert your OpenAPI spec to 3.1.0 for better support.";
    const swaggerVersion = document.swagger;
    const openAPIVersion = document.openapi;
    if (openAPIVersion !== undefined && openAPIVersion !== "3.1.0") {
      console.warn(`Attempting to load an OpenAPI ${openAPIVersion} spec. ${warningMessage}`)
    } else if (swaggerVersion !== undefined) {
      console.warn(`Attempting to load a Swagger ${swaggerVersion} spec. ${warningMessage}`);
    } else {
      throw new Error(`Attempting to load an unsupported spec:\n\n${JSON.stringify(document, null, 2)}.`);
    }
  }

  static fromObject(document: Record<string, any>) {
    OpenAPISpec.alertUnsupportedSpec(document);
    return new OpenAPISpec(document as Document);
  }

  static fromString(rawString: string) {
    let document;
    try {
      document = JSON.parse(rawString);
    } catch (e) {
      document = yaml.parse(rawString);
    }
    return OpenAPISpec.fromObject(document);
  }

  static async fromURL(url: string) {
    const response = await fetch(url);
    const rawDocument = await response.text();
    return OpenAPISpec.fromString(rawDocument);
  }
}