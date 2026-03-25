import { google } from "googleapis";

export const handler = async () => {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SHEET_ID;
    const sheetName = "Master";
    const gid = 1466458304; // your actual gid

    // 1. Read the Master sheet
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });

    const rows = readRes.data.values || [];

    // 2. Create a new backup sheet with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `Backup-${timestamp}`;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: backupName,
              },
            },
          },
        ],
      },
    });

    // 3. Write the data into the backup sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${backupName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, backupName }),
    };
  } catch (error) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      message: "Backup failed",
      error: error.message,
      stack: error.stack
    }),
  };
}
};
