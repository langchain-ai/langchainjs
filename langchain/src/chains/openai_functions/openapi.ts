import { OpenAPIV3_1 } from "openapi-types";
import Document = OpenAPIV3_1.Document;
import ParameterObject = OpenAPIV3_1.ParameterObject;
import SchemaObject = OpenAPIV3_1.SchemaObject;

import { OpenAPISpec } from "../../util/openapi.js";
import { ChainValues } from "../../schema/index.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { BaseChain } from "../base.js";
import { LLMChain } from "../llm_chain.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import { ChatPromptTemplate, HumanMessagePromptTemplate } from "../../prompts/chat.js";
import { SequentialChain } from "../sequential_chain.js";
import { JsonOutputFunctionsParser } from "../../output_parsers/openai_functions.js";

type JSONSchemaObject = {
  type: "object",
  properties: Record<string, SchemaObject>,
  required: string[]
}

type OpenAIFunction = {
  name: string,
  description: string,
  parameters: JSONSchemaObject
};

type OpenAPIExecutionMethod = (name: string, requestArgs: Record<string, any>, options?: {
  headers?: Record<string, string>,
  params?: Record<string, any>
}) => Promise<Response>;

// function formatURL (url: string, pathParams: Record<string, string>): string {
//   const expectedPathParamNames = url.match(/{(.*?)}/g);
//   const newParams = {};
//   for (const expectedPathParamName of expectedPathParamNames) {
//     const cleanParamName = expectedPathParamName.replace(/^\.;/, '').replace(/\*$/, '');
//   }
// }

function convertOpenAPIParamsToJSONSchema(params: ParameterObject[], spec: OpenAPISpec) {
  return params.reduce((jsonSchema: JSONSchemaObject, param) => {
    let schema;
    if (param.schema) {
      schema = spec.getSchema(param.schema);
    } else if (param.content) {
      const mediaTypeSchema = Object.values(param.content)[0].schema;
      if (mediaTypeSchema) {
        schema = spec.getSchema(mediaTypeSchema);
      }
      if (!schema) {
        return jsonSchema;
      }
      if (schema.description === undefined) {
        schema.description = param.description ?? "";
      }
      jsonSchema.properties[param.name] = schema;
    } else {
      return jsonSchema;
    }
    if (param.required) {
      jsonSchema.required.push(param.name);
    }
    return jsonSchema;
  }, {
    type: "object",
    properties: {},
    required: []
  });
}

function convertOpenAPISpecToOpenAIFunctions(spec: OpenAPISpec): {
  openAIFunctions: OpenAIFunction[],
  defaultExecutionMethod?: OpenAPIExecutionMethod
} {
  if (!spec.document.paths) {
    return {openAIFunctions: []};
  }
  const nameToCallMap: Record<string, {method: string, url: string}> = {};
  const openAIFunctions = [];
  for (const path of Object.keys(spec.document.paths)) {
    const pathParameters = spec.getParametersForPath(path);
    for (const method of spec.getMethodsForPath(path)) {
      const operation = spec.getOperation(path, method);
      if (!operation) {
        return {openAIFunctions: []};
      }
      const operationParametersByLocation = pathParameters.concat(spec.getParametersForOperation(operation)).reduce((operationParams: Record<string, any>, param) => {
        if (!operationParams[param.in]) {
          operationParams[param.in] = [];
        }
        operationParams[param.in].push(param);
        return operationParams;
      }, {});
      const requestArgs: {
        params: JSONSchemaObject,
        headers: JSONSchemaObject,
        cookies: JSONSchemaObject,
        path_params: JSONSchemaObject,
        data?: SchemaObject
      } = {
        params: convertOpenAPIParamsToJSONSchema(operationParametersByLocation["query"] ?? [], spec),
        headers: convertOpenAPIParamsToJSONSchema(operationParametersByLocation["header"] ?? [], spec),
        cookies: convertOpenAPIParamsToJSONSchema(operationParametersByLocation["cookie"] ?? [], spec),
        path_params: convertOpenAPIParamsToJSONSchema(operationParametersByLocation["path"] ?? [], spec)
      };
      const requestBody = spec.getRequestBodyForOperation(operation);
      if (requestBody?.content) {
        const mediaTypes = [];
        for (const mediaType of Object.values(requestBody.content)) {
          if (mediaType.schema !== undefined) {
            mediaTypes.push(spec.getSchema(mediaType.schema));
          }
        }
        if (mediaTypes.length === 1) {
          requestArgs.data = mediaTypes[0];
        } else if (mediaTypes.length > 1) {
          requestArgs.data = {
            anyOf: mediaTypes
          };
        }
      }
      // const operation = spec.getOperation(path, method);
      const openAIFunction: OpenAIFunction = {
        name: OpenAPISpec.getCleanedOperationId(operation, path, method),
        description: operation.description ?? operation.summary ?? "",
        parameters: {
          type: "object",
          properties: requestArgs,
          required: []
        }
      };
      openAIFunctions.push(openAIFunction);
      nameToCallMap[openAIFunction.name] = {
        method,
        url: spec.baseUrl + path
      };
    }
  }
  return {
    openAIFunctions,
    defaultExecutionMethod: async (name: string, requestArgs: Record<string, any>, options?: {
      headers?: Record<string, string>,
      params?: Record<string, any>
    }) => {
      const { headers, params, ...rest } = options ?? {};
      const { method, url } = nameToCallMap[name];
      const queryString = new URLSearchParams({
        ...params
      }).toString();
      const urlWithQuerystring = url + queryString.length ? ("?" + queryString) : "";
      let body = requestArgs.data;
      if (requestArgs.data !== undefined && typeof requestArgs.data !== "string") {
        body = JSON.stringify(requestArgs.data);
      }
      // const pathParams = requestArgs.path_params;
      //_format_url(url, path_params)
      return fetch(urlWithQuerystring, {
        // ...requestArgs
        method,
        headers: {...requestArgs.headers, ...headers},
        body,
        ...rest
      })
    }
  };
}

class SimpleRequestChain extends BaseChain {
  private requestMethod: OpenAPIExecutionMethod;

  inputKey = "function";

  outputKey = "response";

  constructor(config: {requestMethod: OpenAPIExecutionMethod}) {
    super();
    this.requestMethod = config.requestMethod;
  }

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys() {
    return [this.outputKey];
  }

  _chainType() {
    return "simple_request_chain" as const;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    _runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    console.log(values);

    const inputKeyValue = values[this.inputKey];
    const name = inputKeyValue.name;
    const args = inputKeyValue.arguments;
    const response = await this.requestMethod(name, args, {});
    let output;
    if (response.status < 200 || response.status > 299) {
      output = `${response.status}: ${response.statusText} for ${name} called with ${args.params}`;
    } else {
      output = await response.text();
    }

    return { [this.outputKey]: output };
  }

}

export type OpenAPIChainOptions = {
  llm?: ChatOpenAI,
  prompt?: BasePromptTemplate,
  requestChain?: BaseChain,
  verbose?: boolean
}

/**
 * Create a chain for querying an API from a OpenAPI spec.
 * @param spec OpenAPISpec or url/file/text string corresponding to one.
 * @param options Custom options passed into the chain
 * @returns OpenAPIChain
 */
export async function createOpenAPIChain (
  spec: Document | string,
  options: OpenAPIChainOptions = {}
) {
  let convertedSpec;
  if (typeof spec === "string") {
    try {
      convertedSpec = await OpenAPISpec.fromURL(spec);
    } catch (e) {
      try {
        convertedSpec = OpenAPISpec.fromString(spec);
      } catch (e) {
        throw new Error(`Unable to parse spec from source ${spec}.`);
      }
    }
  } else {
    convertedSpec = OpenAPISpec.fromObject(spec);
  }
  const { openAIFunctions, defaultExecutionMethod } = convertOpenAPISpecToOpenAIFunctions(convertedSpec);
  if (defaultExecutionMethod === undefined) {
    throw new Error(`Could not parse any valid operations from the provided spec.`);
  }
  const {
    llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613" }),
    prompt = ChatPromptTemplate.fromPromptMessages([
      HumanMessagePromptTemplate.fromTemplate("Use the provided API's to respond to this user query:\n\n{query}")
    ]),
    requestChain = new SimpleRequestChain({
      requestMethod: defaultExecutionMethod
    }),
    verbose,
    ...rest
  } = options;
  const formatChain = new LLMChain({
    llm,
    prompt,
    outputParser: new JsonOutputFunctionsParser(),
    outputKey: "function",
    llmKwargs: { functions: openAIFunctions },
    verbose
  });
  return new SequentialChain({
    chains: [formatChain, requestChain],
    outputVariables: ["response"],
    inputVariables: formatChain.inputKeys,
    verbose,
    ...rest
  });
}