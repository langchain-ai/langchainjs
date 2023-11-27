import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import * as fs from 'fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';


const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

class GoogleDriveLoader extends BaseDocumentLoader {
   service_account_key: string;
   credentials_path: string;
   token_path: string;
   folder_id: string | null;
   document_ids: string[] | null;
   file_ids: string[] | null;
   recursive: boolean;
   file_types: string[] | null;
   load_trashed_files: boolean;
   file_loader_cls: any;
   file_loader_kwargs: { [key: string]: any };

   constructor() {
       super();
       this.service_account_key = join(process.env.HOME, '.credentials', 'keys.json');
       this.credentials_path = join(process.env.HOME, '.credentials', 'credentials.json');
       this.token_path = join(process.env.HOME, '.credentials', 'token.json');
       this.folder_id = null;
       this.document_ids = null;
       this.file_ids = null;
       this.recursive = false;
       this.file_types = null;
       this.load_trashed_files = false;
       this.file_loader_cls = null;
       this.file_loader_kwargs = {};
   }

   validateInputs(values: Record<string, any>): Record<string, any> {
        // Check for mutual exclusivity and existence of folder_id, document_ids, and file_ids
        if (values.folder_id && (values.document_ids || values.file_ids)) {
            throw new Error("Cannot specify both folder_id and document_ids nor folder_id and file_ids");
        }
    
        if (!values.folder_id && !values.document_ids && !values.file_ids) {
            throw new Error("Must specify either folder_id, document_ids, or file_ids");
        }

        if (values['file_types']) {
            if (values['document_ids'] || values['file_ids']) {
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

            values['file_types'].forEach((fileType: string) => {
                if (!allowedTypes.includes(fileType)) {
                    throw new Error(`Given file type ${fileType} is not supported. Supported values are: ${shortNames}; and their full-form names: ${fullNames}`);
                }
            });

            // Replace short-form file types with full-form file types
            values['file_types'] = values['file_types'].map((fileType: string) => typeMapping[fileType] || fileType);
        }

        return values;
    }  

    validateCredentialsPath(credentialsPath: string): void {
        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`credentials_path ${credentialsPath} does not exist`);
        }
    }

    async _load_credentials(): Promise<OAuth2Client> {
        let creds: OAuth2Client | null = null;

        if (fs.existsSync(this.service_account_key)) {
            const service_account_info = JSON.parse(fs.readFileSync(this.service_account_key, 'utf8'));
            creds = new google.auth.JWT(
                service_account_info.client_email,
                undefined,
                service_account_info.private_key,
                SCOPES,
            );
            return creds;

        }

        if (fs.existsSync(this.token_path)) {
            const token = JSON.parse(fs.readFileSync(this.token_path, 'utf8'));
            creds = new google.auth.OAuth2();
            creds.setCredentials(token);
        }

        if (!creds || !creds.valid) {
            if (creds && creds.expired && creds.refresh_token) {
                // TODO: 

            } else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                // TODO: 

                // no need to write to file
                if (creds) {
                    return creds;
                }
            } else {
                // TODO:
                
            }

            // Save the credentials to a file
            fs.writeFileSync(this.token_path, JSON.stringify(creds.credentials));
        }

        return creds;
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
}
