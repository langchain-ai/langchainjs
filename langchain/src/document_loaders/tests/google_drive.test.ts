import { test, jest, expect } from "@jest/globals";
import { GoogleDriveLoader } from '../web/google_drive.js'
import { Document } from "../../document.js";


test("Google Drive Test: Folder", async () => {
    const loader = new GoogleDriveLoader();
    loader.recursive = true;
    loader.folderId = "1Ae4Q9bDoHLbryrKrAtOvpxH9tGgqDRYO";
    const documents:Document[] = await loader.load();
    console.log(documents)
    expect(documents.length === 5)
});

test("Google Drive Test: Documents", async () => {
    const loader = new GoogleDriveLoader();
    loader.documentIds = ['1UV2priL48DTMAXntY0GCZ593QwJiEEPhQGr9sPRbFRg','1zz8R1MNcPIvVwTZFrc1XENf8zyDO3_GSOsD-gI-hiD0']
    const documents:Document[] = await loader.load();
    console.log(documents)
    expect(documents.length === 2)
});

test("Google Drive Test: Files", async () => {
    const loader = new GoogleDriveLoader();
    loader.fileIds = ['1DMSyLscZYv2YXzMqeC0VfUaneNxl2dYN','10blRw6Xwt15durwy3TxlVwH-te1dPxcC']
    const documents:Document[] = await loader.load();
    console.log(documents)
    expect(documents.length === 2)
});