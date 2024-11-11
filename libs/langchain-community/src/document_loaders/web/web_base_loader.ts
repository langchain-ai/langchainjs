import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import type { DocumentLoader } from "@langchain/core/document_loaders/base";

/**
 * Represents the parameters for configuring WebBaseLoaders. It extends the
 * AsyncCallerParams interface and adds additional parameters specific to
 * web-based loaders.
 */
export interface WebBaseLoaderParams extends AsyncCallerParams {
  /**
   * The timeout in milliseconds for the fetch request. Defaults to 10s.
   */
  timeout?: number;

  /**
   * The text decoder to use to decode the response. Defaults to UTF-8.
   */
  textDecoder?: TextDecoder;
  /**
   * The headers to use in the fetch request.
   */
  headers?: HeadersInit;
}

export interface WebBaseLoader extends DocumentLoader {
  timeout: number;

  caller: AsyncCaller;

  textDecoder?: TextDecoder;

  headers?: HeadersInit;
}