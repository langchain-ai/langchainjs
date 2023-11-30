import { test, jest, expect } from "@jest/globals";
import { GoogleDriveLoader } from '../web/google_drive.js'
import { Document } from "../../document.js";


test("Google Drive test", async () => {
    console.log("test start")
    const loader = new GoogleDriveLoader();
    const documents:Document[] = await loader.load();
    console.log(documents)
});
