import { CachedContentCreateParams, CachedContentUpdateParams, FileMetadata, FileMetadataResponse, GoogleAICacheManager, ListCacheResponse, ListFilesResponse, ListParams, UploadFileResponse } from "@google/generative-ai/server";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { CachedContent, RequestOptions, SingleRequestOptions } from "@google/generative-ai";

export class GoogleGenerativeAIContextCache {
  private fileManager: GoogleAIFileManager;
  private cacheManager: GoogleAICacheManager;

  constructor(apiKey: string, fileManagerRequestOptions?: RequestOptions, 
    cacheManagerRequestOptions?: RequestOptions
  ) {
    this.fileManager = new GoogleAIFileManager(apiKey, fileManagerRequestOptions);
    this.cacheManager = new GoogleAICacheManager(apiKey, cacheManagerRequestOptions);
  }

  uploadFile(filePath: string, fileMetadata: FileMetadata): Promise<UploadFileResponse> {
    return this.fileManager.uploadFile(filePath, fileMetadata);
  }

  listFiles(listParams?: ListParams, requestOptions?: SingleRequestOptions): Promise<ListFilesResponse> {
    return this.fileManager.listFiles(listParams, requestOptions);
  }

  getFile(fileId: string, requestOptions?: SingleRequestOptions): Promise<FileMetadataResponse> {
    return this.fileManager.getFile(fileId, requestOptions);
  }

  deleteFile(fileId: string): Promise<void> {
    return this.fileManager.deleteFile(fileId);
  }

  createCache(createOptions: CachedContentCreateParams): Promise<CachedContent> {
    return this.cacheManager.create(createOptions);
  }

  listCaches(listParams?: ListParams): Promise<ListCacheResponse> {
    return this.cacheManager.list(listParams);
  }

  getCache(name: string): Promise<CachedContent> {
    return this.cacheManager.get(name);
  }

  updateCache(name: string, updateParams: CachedContentUpdateParams): Promise<CachedContent> {
    return this.cacheManager.update(name, updateParams);
  }

  deleteCache(name: string): Promise<void> {
    return this.cacheManager.delete(name);
  }
}