import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import * as getPort from 'get-port';


import { GoogleAuth, OAuth2Client } from 'google-auth-library';


import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";



const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];


export interface GoogleDriveLoaderParams extends AsyncCallerParams {
    serviceAccountKey?: string;
    credentialsPath?: string;
    tokenPath?: string;
    folderId?: string | null;
    documentIds?: string[] | null;
    fileIds?: string[] | null;
    recursive?: boolean;
    fileTypes?: string[] | null;
    loadTrashedFiles?: boolean;
    fileLoaderCls?: any;
    fileLoaderKwargs?: { [key: string]: any };
  }

export class GoogleDriveLoader extends BaseDocumentLoader {

    public serviceAccountKey: string;

    public credentialsPath: string;

    public tokenPath: string;

    public folderId: string | null;

    public documentIds: string[] | null;

    public fileIds: string[] | null;

    public recursive: boolean;

    public fileTypes: string[] | null;

    public loadTrashedFiles: boolean;

    public fileLoaderCls: any;

    public fileLoaderKwargs: { [key: string]: any };
  
    constructor({
        serviceAccountKey = join(process.env.HOME, '.credentials', 'keys.json'),
        credentialsPath = join(process.env.HOME, '.credentials', 'credentials.json'),
        tokenPath = join(process.env.HOME, '.credentials', 'token.json'),
        folderId = null,
        documentIds = null,
        fileIds = null,
        recursive = false,
        fileTypes = null,
        loadTrashedFiles = false,
        fileLoaderCls = null,
        fileLoaderKwargs = {},
      }: GoogleDriveLoaderParams = {}) {
        super();
        this.serviceAccountKey = serviceAccountKey;
        this.credentialsPath = credentialsPath;
        this.tokenPath = tokenPath;
        this.folderId = folderId;
        this.documentIds = documentIds;
        this.fileIds = fileIds;
        this.recursive = recursive;
        this.fileTypes = fileTypes;
        this.loadTrashedFiles = loadTrashedFiles;
        this.fileLoaderCls = fileLoaderCls;
        this.fileLoaderKwargs = fileLoaderKwargs;
        // You can add any additional logic here if needed
      }

   validateInputs(inputValues: Record<string, any>): Record<string, any> {
        const values = { ...inputValues };

        // Check for mutual exclusivity and existence of folder_id, document_ids, and file_ids
        if (values.folder_id && (values.document_ids || values.file_ids)) {
            throw new Error("Cannot specify both folder_id and document_ids nor folder_id and file_ids");
        }
    
        if (!values.folder_id && !values.document_ids && !values.file_ids) {
            throw new Error("Must specify either folder_id, document_ids, or file_ids");
        }

        if (values.file_types) {
            if (values.document_ids || values.file_ids) {
                throw new Error("file_types can only be given when folder_id is given, not when document_ids or file_ids are given.");
            }

            const typeMapping: { [key: string]: string } = {
                "document": "application/vnd.google-apps.document",
                "sheet": "application/vnd.google-apps.spreadsheet",
                "pdf": "application/pdf",
            };
        

            const allowedTypes = [...Object.keys(typeMapping), ...Object.values(typeMapping)];
            const shortNames = Object.keys(typeMapping).map(x => `'${x}'`).join(", ");
            const fullNames = Object.values(typeMapping).map(x => `'${x}'`).join(", ");

            values.file_types.forEach((fileType: string) => {
                if (!allowedTypes.includes(fileType)) {
                    throw new Error(`Given file type ${fileType} is not supported. Supported values are: ${shortNames}; and their full-form names: ${fullNames}`);
                }
            });

            // Replace short-form file types with full-form file types
            values.file_types = values.file_types.map((fileType: string) => typeMapping[fileType] || fileType);
        }

        return values;
    }  

    validateCredentialsPath(credentialsPath: string): void {
        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`credentials_path ${credentialsPath} does not exist`);
        }
    }

    public async loadCredentials() {
        let creds = null;

        if (fs.existsSync(this.serviceAccountKey)) {
            const auth = new GoogleAuth({
                keyFile: this.serviceAccountKey,
                scopes: SCOPES,
            });
            return await auth.getClient();
        }


        if (fs.existsSync(this.tokenPath)) {
            const token = fs.readFileSync(this.tokenPath, 'utf8');
            creds = new OAuth2Client();
            creds.setCredentials(JSON.parse(token));
        }

        if (!creds || !creds.credentials) {
            if (creds && this.isTokenValid(creds) && creds.credentials.refresh_token){
                await creds.refreshAccessToken();
            }
        } else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            const auth = new GoogleAuth({
                scopes: SCOPES
            });
            creds = await auth.getClient();
        } else {
            // Handle OAuth2 flow (this part is more complex in Node.js)
            creds = await this.authenticate();

        }

        return creds;
    }

    private isTokenValid(creds: OAuth2Client): boolean {
        const now = new Date().getTime();
        if (creds.credentials && creds.credentials.expiry_date) {
            return now < creds.credentials.expiry_date;
        }
        return false;
    }

    private authenticate(): Promise<OAuth2Client> {
        // Load client secrets from a local file
        const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);
    
        return new Promise((resolve, reject) => {
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
            });
    
            const server = http.createServer((req, res) => {
                if (req.url?.includes('/oauth2callback')) {
                    const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
                    const code = qs.get('code');
                    res.end('Authentication successful! Please return to the console.');
                    server.close();
    
                    oAuth2Client.getToken(code as string)
                        .then(({ tokens }) => {
                            oAuth2Client.setCredentials(tokens);
                            // Store the token to disk for later program executions
                            fs.writeFileSync(this.tokenPath, JSON.stringify(tokens));
                            resolve(oAuth2Client);
                        })
                        .catch(error => {
                            reject(error);
                        });
                }
            }).listen(3000, () => {
                // open the browser to the authorize url to start the workflow
                open(authUrl, {wait: false}).then(cp => cp.unref());
            });
        });
    }
    


    

    async _loadSheetFromId(id: string): Promise<Document[]> {
        // Load a sheet and all tabs from an ID.

        const creds = this._load_credentials(); 
        const sheetsService = google.sheets({ version: 'v4', auth: creds });

        const spreadsheet = await sheetsService.spreadsheets.get({ spreadsheetId: id });
        const sheets = spreadsheet.data.sheets || [];

        let documents: Document[] = [];
        for (const sheet of sheets) {
            const sheetName = sheet.properties.title;

            const result = await sheetsService.spreadsheets.values.get({
                spreadsheetId: id,
                range: sheetName,
            });

            const values = result.data.values || [];
            if (values.length === 0) continue; // empty sheet

            const header = values[0];
            for (let i = 1; i < values.length; i++) {
                const row = values[i];
                const metadata = {
                    source: `https://docs.google.com/spreadsheets/d/${id}/edit?gid=${sheet.properties?.sheetId}`,
                    title: `${spreadsheet.data.properties?.title} - ${sheetName}`,
                    row: i,
                };

                let content: string[] = [];
                for (let j = 0; j < row.length; j++) {
                    const title = header[j]?.trim() || "";
                    content.push(`${title}: ${row[j]?.trim()}`);
                }

                const pageContent = content.join('\n');
                documents.push(new Document({ pageContent: pageContent, metadata: metadata }));
            }
        }

        return documents;
    }



    private async _fetchFilesRecursive(service: any, folderId: string): Promise<any[]> {
        // Implement recursive file fetching logic here
        // You can use the Files: list API with 'q' parameter to get files in a folder
        return [];
    }

    async _loadFileFromId(id: string): Promise<Document[]> {
        // Implement loading file logic
        return [];
      }

    async _loadDocumentFromId(id: string): Promise<Document> {
        // Implement loading document logic
        return {} as Document;
      }
    
    async _loadFilesFromIds(fileIds: string[] | null): Promise<Document[]> {
        if (!fileIds || fileIds.length === 0) {
          throw new Error("fileIds must be set");
        }
    
        const loadedFiles: Document[] = [];
    
        for (const fileId of fileIds) {
          loadedFiles.push(...await this._loadFileFromId(fileId));
        }
    
        return loadedFiles;
      }

    async _loadDocumentsFromIds(documentIds: string[] | null): Promise<Document[]> {
        if (!documentIds || documentIds.length === 0) {
          throw new Error("documentIds must be set");
        }
    
        const loadedDocuments: Document[] = [];
    
        for (const docId of documentIds) {
          loadedDocuments.push(await this._loadDocumentFromId(docId));
        }
    
        return loadedDocuments;
      }

    async _loadDocumentsFromFolder(folderId: string, fileTypes: string[] | null):Promise<Document[]> {
        throw new Error('Method not implemented.');
    }



    public async load(): Promise<Document[]> {
        if (this.folderId){
            return this._loadDocumentsFromFolder(this.folderId,this.fileTypes)
        } else if (this.documentIds){
            return this._loadDocumentsFromIds(this.documentIds)
        } else return this._loadFilesFromIds(this.fileIds)
    }
}
