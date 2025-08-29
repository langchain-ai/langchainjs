import {
  AuthenticationDetailsProvider,
  AuthParams,
  ClientConfiguration,
  ConfigFileAuthenticationDetailsProvider,
  InstancePrincipalsAuthenticationDetailsProviderBuilder,
  SessionAuthDetailProvider,
  MaxAttemptsTerminationStrategy,
  Region,
} from "oci-common";

import { GenerativeAiInferenceClient } from "oci-generativeaiinference";

import {
  ConfigFileAuthParams,
  OciGenAiClientParams,
  OciGenAiNewClientAuthType,
} from "./types.js";

export class OciGenAiSdkClient {
  static readonly _DEFAULT_REGION_ID = Region.US_CHICAGO_1.regionId;

  private _client: GenerativeAiInferenceClient;

  private constructor(client: GenerativeAiInferenceClient) {
    this._client = client;
  }

  get client(): GenerativeAiInferenceClient {
    return this._client;
  }

  static async create(
    params: OciGenAiClientParams
  ): Promise<OciGenAiSdkClient> {
    const client: GenerativeAiInferenceClient = await this._getClient(params);
    return new OciGenAiSdkClient(client);
  }

  static async _getClient(
    params: OciGenAiClientParams
  ): Promise<GenerativeAiInferenceClient> {
    if (params.client) {
      return params.client;
    }

    return await this._createAndSetupNewClient(params);
  }

  static async _createAndSetupNewClient(
    params: OciGenAiClientParams
  ): Promise<GenerativeAiInferenceClient> {
    const client: GenerativeAiInferenceClient = await this._createNewClient(
      params
    );

    if (!params.newClientParams?.regionId) {
      client.regionId = this._DEFAULT_REGION_ID;
    } else {
      client.regionId = params.newClientParams.regionId;
    }

    return client;
  }

  static async _createNewClient(
    params: OciGenAiClientParams
  ): Promise<GenerativeAiInferenceClient> {
    const authParams: AuthParams = await this._getClientAuthParams(params);
    const clientConfiguration: ClientConfiguration =
      this._getClientConfiguration(params.newClientParams?.clientConfiguration);
    return new GenerativeAiInferenceClient(authParams, clientConfiguration);
  }

  static async _getClientAuthParams(
    params: OciGenAiClientParams
  ): Promise<AuthParams> {
    if (params.newClientParams?.authType === OciGenAiNewClientAuthType.Other) {
      return <AuthParams>params.newClientParams.authParams;
    }

    const authenticationDetailsProvider: AuthenticationDetailsProvider =
      await this._getAuthProvider(params);
    return { authenticationDetailsProvider };
  }

  static async _getAuthProvider(
    params: OciGenAiClientParams
  ): Promise<AuthenticationDetailsProvider> {
    switch (params.newClientParams?.authType) {
      case undefined:
      case OciGenAiNewClientAuthType.ConfigFile:
        return this._getConfigFileAuthProvider(params);

      case OciGenAiNewClientAuthType.InstancePrincipal:
        return await this._getInstancePrincipalAuthProvider();

      case OciGenAiNewClientAuthType.Session:
        return this._getSessionAuthProvider(params);

      default:
        throw new Error("Invalid authentication type");
    }
  }

  static _getConfigFileAuthProvider(
    params: OciGenAiClientParams
  ): AuthenticationDetailsProvider {
    const configFileAuthParams: ConfigFileAuthParams = <ConfigFileAuthParams>(
      params.newClientParams?.authParams
    );
    return new ConfigFileAuthenticationDetailsProvider(
      configFileAuthParams?.clientConfigFilePath,
      configFileAuthParams?.clientProfile
    );
  }

  static async _getInstancePrincipalAuthProvider(): Promise<AuthenticationDetailsProvider> {
    const instancePrincipalAuthenticationBuilder =
      new InstancePrincipalsAuthenticationDetailsProviderBuilder();
    return await instancePrincipalAuthenticationBuilder.build();
  }

  static _getSessionAuthProvider(
    params: OciGenAiClientParams
  ): AuthenticationDetailsProvider {
    const configFileAuthParams: ConfigFileAuthParams = <ConfigFileAuthParams>(
      params.newClientParams?.authParams
    );
    return new SessionAuthDetailProvider(
      configFileAuthParams?.clientConfigFilePath,
      configFileAuthParams?.clientProfile
    );
  }

  static _getClientConfiguration(
    clientConfiguration: ClientConfiguration | undefined
  ): ClientConfiguration {
    if (clientConfiguration) {
      return clientConfiguration;
    }

    return {
      retryConfiguration: {
        terminationStrategy: new MaxAttemptsTerminationStrategy(1),
      },
    };
  }
}
