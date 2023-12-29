/**
 * Base class for handling authentication flows.
 *
 * @class AuthFlowBase
 */
export abstract class AuthFlowBase {
  /**
   * The client ID used for authentication.
   *
   * @protected
   * @type {string}
   * @memberof AuthFlowBase
   */
  protected clientId: string;

  /**
   * The access token obtained through authentication.
   *
   * @protected
   * @type {string}
   * @memberof AuthFlowBase
   */
  protected accessToken = "";

  /**
   * Creates an instance of AuthFlowBase.
   *
   * @param {string} clientId - The client ID for authentication.
   * @memberof AuthFlowBase
   */
  constructor(clientId: string) {
    this.clientId = clientId;
  }

  /**
   * Abstract method to get the access token.
   *
   * @abstract
   * @returns {Promise<string>} A promise that resolves to the access token.
   * @memberof AuthFlowBase
   */
  public abstract getAccessToken(): Promise<string>;
}
