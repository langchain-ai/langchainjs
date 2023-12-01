import * as fs from "fs";
import { google, Auth, drive_v3 } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import { PDFLoader } from "../fs/pdf.js";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly"
];

/**
 * GoogleDriveLoaderParams interface for specifying loader configuration options.
 */
export interface GoogleDriveLoaderParams {
  credentialsPath?: string;
  tokenPath?: string;
  folderId?: string | null;
  documentIds?: string[] | null;
  fileIds?: string[] | null;
  recursive?: boolean;
  fileTypes?: string[] | null;
  loadTrashedFiles?: boolean;
  fileLoaderCls?: any | null;
}

/**
 * GoogleDriveLoader is responsible for loading documents from Google Drive.
 * It extends BaseDocumentLoader.
 */
export class GoogleDriveLoader extends BaseDocumentLoader {
  // Define class properties

  public credentialsPath: string;

  public tokenPath: string;

  public folderId: string | null;

  public documentIds: string[] | null;

  public fileIds: string[] | null;

  public recursive: boolean;

  public fileTypes: string[] | null;

  public loadTrashedFiles: boolean;

  public fileLoaderCls: any | null;

  /**
   * Creates an instance of GoogleDriveLoader.
   * @param {GoogleDriveLoaderParams} params - Loader configuration options.
   */
  constructor({
    credentialsPath = getEnvironmentVariable("GOOGLE_DRIVE_CREDENTIALSPATH"),
    tokenPath = getEnvironmentVariable("GOOGLE_DRIVE_TOKENPATH"),
    folderId = null,
    documentIds = null,
    fileIds = null,
    recursive = false,
    fileTypes = null,
    loadTrashedFiles = false,
    fileLoaderCls = null
  }: GoogleDriveLoaderParams = {}) {
    super();
    this.credentialsPath = credentialsPath as string;
    this.tokenPath = tokenPath as string;
    this.folderId = folderId;
    this.documentIds = documentIds;
    this.fileIds = fileIds;
    this.recursive = recursive;
    this.fileTypes = fileTypes;
    this.loadTrashedFiles = loadTrashedFiles;
    this.fileLoaderCls = fileLoaderCls;
  }

    /**
     * Validates input values to ensure they meet required criteria.
     * @throws {Error} - Throws an error if validation fails.
     */
   validateInputs() {
        // Check for mutual exclusivity and existence of folder_id, document_ids, and file_ids
        if (this.folderId && (this.documentIds || this.fileIds)) {
            throw new Error("Cannot specify both folder_id and document_ids nor folder_id and file_ids");
        }
    
        if (!this.folderId && !this.documentIds && !this.fileIds) {
            throw new Error("Must specify either folder_id, document_ids, or file_ids");
        }

        if (this.fileTypes) {
            if (this.documentIds || this.fileIds) {
                throw new Error("file_types can only be given when folder_id is given, not when document_ids or file_ids are given.");
            }

      const typeMapping: { [key: string]: string } = {
        document: "application/vnd.google-apps.document",
        sheet: "application/vnd.google-apps.spreadsheet",
        pdf: "application/pdf"
      };

      const allowedTypes = [
        ...Object.keys(typeMapping),
        ...Object.values(typeMapping)
      ];
      const shortNames = Object.keys(typeMapping)
        .map((x) => `'${x}'`)
        .join(", ");
      const fullNames = Object.values(typeMapping)
        .map((x) => `'${x}'`)
        .join(", ");

            this.fileTypes.forEach((fileType: string) => {
                if (!allowedTypes.includes(fileType)) {
                    throw new Error(`Given file type ${fileType} is not supported. Supported values are: ${shortNames}; and their full-form names: ${fullNames}`);
                }
            });

            // Replace short-form file types with full-form file types
            this.fileTypes = this.fileTypes.map((fileType: string) => typeMapping[fileType] || fileType);
        }
    }  

  /**
   * Validates the existence of credentialsPath.
   * @param {string} credentialsPath - The path to credentials file.
   * @throws {Error} - Throws an error if credentialsPath does not exist.
   */
  validateCredentialsPath(credentialsPath: string): void {
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`credentials_path ${credentialsPath} does not exist`);
    }
  }

  /**
   * Loads saved credentials if they exist.
   * @returns {Promise<Auth.OAuth2Client|null>} - An OAuth2Client instance or null if credentials do not exist.
   */
  async loadSavedCredentialsIfExist(): Promise<Auth.OAuth2Client | null> {
    try {
      const content = await fs.readFileSync(this.tokenPath, "utf8");
      const credentials = JSON.parse(content);
      const client = google.auth.fromJSON(credentials);
      return client as Auth.OAuth2Client;
    } catch (err) {
      return null;
    }
  }

  /**
   * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
   *
   * @param {Auth.OAuth2Client} client
   * @return {Promise<void>}
   */
  async saveCredentials(client: Auth.OAuth2Client): Promise<void> {
    const content = await fs.readFileSync(this.credentialsPath, "utf8");
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token
    });
    await fs.writeFileSync(this.tokenPath, payload);
  }

  /**
   * Authorizes the application to call Google APIs.
   * @returns {Promise<Auth.OAuth2Client>} - An authenticated OAuth2Client instance.
   */
  async authorize(): Promise<Auth.OAuth2Client> {
    let client = await this.loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: this.credentialsPath
    });
    if (client && client.credentials) {
      await this.saveCredentials(client);
    }
    return client as Auth.OAuth2Client;
  }

  /**
   * Loads a Google Sheets document from its ID.
   * @param {string} id - The spreadsheet ID.
   * @param {google.auth.OAuth2} auth - The authenticated Google OAuth client.
   * @returns {Promise<Document[]>} - An array of Document instances.
   */
  async _loadSheetFromId(id: string, auth: Auth.OAuth2Client): Promise<Document[]> {
    const sheetsService = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheetsService.spreadsheets.get({
      spreadsheetId: id
    });
    const sheets = spreadsheet.data.sheets || [];

    const documents: Document[] = [];

    for (const sheet of sheets) {
      const sheetName = sheet.properties?.title;
      const rowCount = sheet.properties?.gridProperties?.rowCount;
      const columnCount = sheet.properties?.gridProperties?.columnCount;

      // Convert column count to letter (e.g., 1 -> A, 26 -> Z)
      if (columnCount && rowCount) {
        const endColumn = String.fromCharCode((64 + columnCount) as number);
        const endRow = rowCount;
        const rangeVal = `${sheetName}!A1:${endColumn}${endRow}`;

        const valueRange = await sheetsService.spreadsheets.values.get({
          spreadsheetId: id,
          range: rangeVal
        });

        if (!valueRange.data.values) {
          continue; // Skip this sheet as it has no data
        }

        // Convert the sheet data to a string format for pageContent
        const pageContent = valueRange.data.values
          .map((row) => row.join(", "))
          .join("\n");

        // Create metadata for the document
        const metadata = {
          sheetName,
          rowCount,
          columnCount
        };

        // Create a new Document with the content and metadata
        const document = new Document({ pageContent, metadata });

        // Add the document to the documents array
        documents.push(document);
      }
    }

    return documents;
  }

  /**
 * Loads a file from Google Drive by its ID and returns an array of documents.
 * defaults to pdf file if no fileLoaderCls is set
 * @param {string} id - The ID of the file to load.
 * @param {Auth.OAuth2Client} auth - The OAuth2Client for authentication.
 * @returns {Promise<Document[]>} - A Promise resolving to an array of documents.
 */
  async _loadFileFromId(
    id: string,
    auth: Auth.OAuth2Client
  ): Promise<Document[]> {
    const service = google.drive({ version: "v3", auth });
    const fileMetaData = await service.files.get({
      fileId: id,
      supportsAllDrives: true,
      fields: "id, name, mimeType, size, modifiedTime, name" // Add any other desired fields
    });

    if (this.fileLoaderCls) {
      const fileBinaryData = await service.files.get({
        fileId: id,
        alt: "media"
      });
      const docs: Document[] = this.fileLoaderCls(fileBinaryData.data);
      for (const doc of docs) {
        doc.metadata.title = fileMetaData.data?.name;
        doc.metadata.source = `https://drive.google.com/file/d/${fileMetaData.data?.id}}/view`;
        doc.metadata.when = fileMetaData.data?.modifiedTime;
      }
      return docs;
    } else {
      // file is a pdf
      // load pdf using PDFLoader
      const fileBinaryData = await service.files.get(
        {
          fileId: id,
          alt: "media"
        },
        { responseType: "blob" }
      );
      const data: Blob = fileBinaryData?.data as unknown as Blob;
      const loader = new PDFLoader(data);
      const docs = await loader.load();
      for (const doc of docs) {
        doc.metadata.title = fileMetaData.data?.name;
        doc.metadata.source = `https://drive.google.com/file/d/${fileMetaData.data?.id}}/view`;
        doc.metadata.when = fileMetaData.data?.modifiedTime;
      }
      return docs;
    }
  }

  /**
 * Loads a Google Docs document from Google Drive by its ID and returns a Document object.
 *
 * @param {string} id - The ID of the Google Docs document to load.
 * @param {Auth.OAuth2Client} auth - The OAuth2Client for authentication.
 * @returns {Promise<Document>} - A Promise resolving to a Document object representing the loaded document.
 * @throws {Error} - Throws an error if there is an issue fetching Google Docs content.
 */
  async _loadDocumentFromId(
    id: string,
    auth: Auth.OAuth2Client
  ): Promise<Document> {
    // Implement loading document logic
    const service = google.drive({ version: "v3", auth });
    const fileMetaData = await service.files.get({
      fileId: id,
      supportsAllDrives: true,
      fields: "modifiedTime,name"
    });
    const fileText = await service.files.export({
      fileId: id,
      mimeType: "text/plain"
    });
    if (fileText && fileText.data && typeof fileText.data === "string") {
      const metadata = {
        source: `https://docs.google.com/document/d/${id}/edit`,
        title: `${fileMetaData.data?.name}`,
        when: `${fileMetaData.data?.modifiedTime}`
      };
      const pageContent = fileText.data;
      return new Document({ pageContent, metadata });
    } else {
      throw new Error("Error fetching Google Docs content, bad response");
    }
  }

  /**
 * Loads multiple files from Google Drive by their IDs and returns an array of Document objects.
 *
 * @param {string[] | null} fileIds - An array of file IDs to load.
 * @param {Auth.OAuth2Client} auth - The OAuth2Client for authentication.
 * @returns {Promise<Document[]>} - A Promise resolving to an array of Document objects representing the loaded files.
 * @throws {Error} - Throws an error if fileIds is null or empty.
 */
  async _loadFilesFromIds(
    fileIds: string[] | null,
    auth: Auth.OAuth2Client
  ): Promise<Document[]> {
    if (!fileIds || fileIds.length === 0) {
      throw new Error("fileIds must be set");
    }

    const loadedFiles: Document[] = [];

    for (const fileId of fileIds) {
      loadedFiles.push(...(await this._loadFileFromId(fileId, auth)));
    }

    return loadedFiles;
  }

  /**
 * Loads multiple Google Docs documents from Google Drive by their IDs and returns an array of Document objects.
 *
 * @param {string[] | null} documentIds - An array of document IDs to load.
 * @param {Auth.OAuth2Client} auth - The OAuth2Client for authentication.
 * @returns {Promise<Document[]>} - A Promise resolving to an array of Document objects representing the loaded documents.
 * @throws {Error} - Throws an error if documentIds is null or empty.
 */
  async _loadDocumentsFromIds(
    documentIds: string[] | null,
    auth: Auth.OAuth2Client
  ): Promise<Document[]> {
    if (!documentIds || documentIds.length === 0) {
      throw new Error("documentIds must be set");
    }

    const loadedDocuments: Document[] = [];

    for (const docId of documentIds) {
      loadedDocuments.push(await this._loadDocumentFromId(docId, auth));
    }

    return loadedDocuments;
  }

  /**
 * Loads documents from a Google Drive folder by its ID and returns an array of Document objects.
 *
 * @param {string} folderId - The ID of the folder to load documents from.
 * @param {Auth.OAuth2Client} auth - The OAuth2Client for authentication.
 * @param {string[] | null} fileTypes - An array of file types to filter the loaded files (e.g., ['application/pdf']).
 * @returns {Promise<Document[]>} - A Promise resolving to an array of Document objects representing the loaded documents.
 */
  async _loadDocumentsFromFolder(
    folderId: string,
    auth: Auth.OAuth2Client,
    fileTypes: string[] | null
  ): Promise<Document[]> {
    const service = google.drive({ version: "v3", auth });
    const files = await this.fetchFilesRecursive(service, folderId);
    const filteredFiles = fileTypes
      ? files.filter((f) => fileTypes.includes(f.mimeType))
      : files;
    const returns: Document[] = [];
    for (const file of filteredFiles) {
      if (file?.trashed && !this.loadTrashedFiles) {
        continue;
      } else if (file.mimeType === "application/vnd.google-apps.document") {
        returns.push(await this._loadDocumentFromId(file.id, auth));
      } else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
        returns.push(...(await this._loadSheetFromId(file.id, auth)));
      } else if (
        file.mimeType === "application/pdf" ||
        this.fileLoaderCls !== null
      ) {
        returns.push(...(await this._loadFileFromId(file.id, auth)));
      }
    }

    return returns;
  }

/**
 * Recursively fetches files from a Google Drive folder.
 * if this.recursive is false, don't recurse into folders
 * @param {drive_v3.Drive} service - The Google Drive service.
 * @param {string} folderId - The ID of the folder to fetch files from.
 * @returns {Promise<drive_v3.Schema$File[]>} - A Promise resolving to an array of files.
 */
  private async fetchFilesRecursive(
    service: any,
    folderId: string
  ): Promise<any[]> {
    const results = await service.files.list({
      q: `'${folderId}' in parents`,
      pageSize: 1000,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: "nextPageToken, files(id, name, mimeType, parents, trashed)"
    });

    const files = results.data.files || [];
    const returns: any[] = [];

    for (const file of files) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        if (this.recursive)
          returns.push(...(await this.fetchFilesRecursive(service, file.id)));
      } else {
        returns.push(file);
      }
    }

    return returns;
  }

  public async load(): Promise<Document[]> {

    const auth = await this.authorize();
    // validate Inputs here and throw appropirate error
    this.validateInputs();
    if (this.folderId) {
      return this._loadDocumentsFromFolder(this.folderId, auth, this.fileTypes);
    } else if (this.documentIds) {
      return this._loadDocumentsFromIds(this.documentIds, auth);
    } else if (this.fileIds) {
      return this._loadFilesFromIds(this.fileIds, auth);
    } else {
      throw new Error("Google Drive Loader: no ids set");
    }
  }
}
