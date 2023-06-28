import { getEndpoint, OpenAIEndpointConfig } from '../azure.js';

describe('getEndpoint', () => {
  it('should return the correct endpoint with azureOpenAiBasePath and azureOpenAIApiDeploymentName', () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiDeploymentName: 'deploymentName',
      azureOpenAiBasePath: 'https://example.azure.com',
    };
    const result = getEndpoint(config);
    expect(result).toBe('https://example.azure.com/openai/deployments/deploymentName');
  });

  it('should return the correct endpoint with azureOpenAIApiKey, azureOpenAIApiInstanceName, and azureOpenAIApiDeploymentName', () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiKey: 'key',
      azureOpenAIApiInstanceName: 'instanceName',
      azureOpenAIApiDeploymentName: 'deploymentName',
    };
    const result = getEndpoint(config);
    expect(result).toBe('https://instanceName.openai.azure.com/openai/deployments/deploymentName');
  });

  it('should throw error when azureOpenAIApiInstanceName is missing with azureOpenAIApiKey', () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiKey: 'key',
      azureOpenAIApiDeploymentName: 'deploymentName',
    };
    expect(() => getEndpoint(config)).toThrowError('azureOpenAIApiInstanceName is required when using azureOpenAIApiKey');
  });

  it('should throw error when azureOpenAIApiDeploymentName is missing with azureOpenAIApiKey', () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiKey: 'key',
      azureOpenAIApiInstanceName: 'instanceName',
    };
    expect(() => getEndpoint(config)).toThrowError('azureOpenAIApiDeploymentName is a required parameter when using azureOpenAIApiKey');
  });

  it('should return the basePath when neither azureOpenAiBasePath nor azureOpenAIApiKey is provided', () => {
    const config: OpenAIEndpointConfig = {
      basePath: 'https://basepath.com',
    };
    const result = getEndpoint(config);
    expect(result).toBe('https://basepath.com');
  });

  it('should throw error when none of the required fields are provided', () => {
    const config: OpenAIEndpointConfig = {};
    expect(() => getEndpoint(config)).toThrowError('You must provide either an azureOpenAiBasePath or an azureOpenAIApiKey or a basePath');
  });
});
