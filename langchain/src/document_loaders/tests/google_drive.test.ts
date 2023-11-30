import { test, jest, expect } from "@jest/globals";
import { GoogleDriveLoader } from '../web/google_drive.js'
import { Document } from "../../document.js";


test("Google Drive Test: Folder", async () => {
    console.log("test start")
    const loader = new GoogleDriveLoader();
    loader.recursive = false;
    const documents:Document[] = await loader.load();

});

// test("Google Drive Test: Documents", async () => {
//     console.log("test start")
//     const loader = new GoogleDriveLoader();
//     const documents:Document[] = await loader.load();
//     console.log(documents)
// });

// test("Google Drive Test: Files", async () => {
//     console.log("test start")
//     const loader = new GoogleDriveLoader();
//     const documents:Document[] = await loader.load();
//     console.log(documents)
// });