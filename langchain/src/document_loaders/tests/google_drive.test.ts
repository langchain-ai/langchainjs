import { test, jest, expect } from "@jest/globals";
import { GoogleDriveLoader } from '../web/google_drive.js'
import { Document } from "../../document.js";
// https://drive.google.com/drive/u/0/folders/1Ae4Q9bDoHLbryrKrAtOvpxH9tGgqDRYO
// download all files and copy the file id
test("Google Drive Test: Folder", async () => {
    const loader = new GoogleDriveLoader();
    loader.recursive = true;
    loader.folderId = "1Ae4Q9bDoHLbryrKrAtOvpxH9tGgqDRYO";
    const documents:Document[] = await loader.load();
    console.log(documents)
    expect(documents.length).toEqual(5)
});

test("Google Drive Test: Documents", async () => {
    const loader = new GoogleDriveLoader();
    loader.documentIds = ['1UV2priL48DTMAXntY0GCZ593QwJiEEPhQGr9sPRbFRg','1zz8R1MNcPIvVwTZFrc1XENf8zyDO3_GSOsD-gI-hiD0']
    const documents:Document[] = await loader.load();
    console.log(documents)
    expect(documents.length).toEqual(2)
});

test("Google Drive Test: Files", async () => {
    const loader = new GoogleDriveLoader();
    loader.fileIds = ['1DMSyLscZYv2YXzMqeC0VfUaneNxl2dYN','10blRw6Xwt15durwy3TxlVwH-te1dPxcC']
    const documents:Document[] = await loader.load();
    console.log(documents)
    expect(documents.length).toEqual(2)
});


describe('GoogleDriveLoader - validateInputs', () => {
    it('should throw an error when folder_id and document_ids are specified', () => {
      const loader = new GoogleDriveLoader({ folderId: '123', documentIds: ['456'] });
      expect(() => loader.validateInputs()).toThrowError('Cannot specify both folder_id and document_ids nor folder_id and file_ids');
    });
  
    it('should throw an error when none of folder_id, document_ids, or file_ids are specified', () => {
      const loader = new GoogleDriveLoader({});
      expect(() => loader.validateInputs()).toThrowError('Must specify either folder_id, document_ids, or file_ids');
    });
  
    it('should throw an error when file_types are specified with document_ids', () => {
      const loader = new GoogleDriveLoader({ documentIds: ['456'], fileTypes: ['document'] });
      expect(() => loader.validateInputs()).toThrowError('file_types can only be given when folder_id is given, not when document_ids or file_ids are given.');
    });
  
  });