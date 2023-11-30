import { test, jest, expect } from "@jest/globals";
import { GoogleDriveLoader } from '../web/google_drive.js'



test("Google Drive test", async () => {
    console.log("test start")
    const loader = new GoogleDriveLoader();
    const documents = await loader.load();
    console.log(documents[0].pageContent);
});
