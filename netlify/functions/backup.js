import { google } from "googleapis";

export const handler = async () => {
  try {
    // Authenticate with Google
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // Create a timestamp for the backup tab name
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);

    const newSheetName = `Backup_${timestamp}`;

    // 1. Copy the Master sheet
    const copyResponse = await sheets.spreadsheets.sheets.copyTo({
      spreadsheetId: process.env.SHEET_ID,
      sheetId: 0, // Usually the first sheet; adjust if Master isn't sheet 0
      requestBody: {
        destinationSpreadsheetId: process.env.SHEET_ID,
      },
    });

    const newSheetId = copyResponse.data.sheetId;

    // 2. Rename the copied sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.SHEET_ID,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: newSheetId,
                title: newSheetName,
              },
              fields: "title",
            },
          },
        ],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        backupName: newSheetName,
      }),
    };
  } catch (error) {
    console.error("BACKUP ERROR:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create backup" }),
    };
  }
};

