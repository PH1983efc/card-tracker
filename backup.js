import { google } from "googleapis";

export default async function handler(req, res) {
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

    // Read all rows from Master sheet
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });

    const rows = readRes.data.values || [];

    // Create backup sheet name
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `Backup-${timestamp}`;

    // Create new sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: backupName },
            },
          },
        ],
      },
    });

    // Write rows into new sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${backupName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    res.status(200).json({ success: true, backupName });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Backup failed",
      error: error.message,
    });
  }
}
