import { google } from "googleapis";

export const handler = async (event) => {
  try {
    const { cardId, got } = JSON.parse(event.body);

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SHEET_ID;
    const sheetName = "Master"; // your tab name
    const gid = 1466458304;     // your actual gid

    // 1. Read all rows to find the matching cardId
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });

    const rows = readRes.data.values;
    if (!rows) throw new Error("No rows found");

    const header = rows[0];
    const cardIdIndex = header.indexOf("Card ID");
    const gotIndex = header.indexOf("Got");

    const rowIndex = rows.findIndex((r) => r[cardIdIndex] === cardId);
    if (rowIndex === -1) throw new Error("Card ID not found");

    const targetRow = rowIndex + 1; // Google Sheets is 1‑indexed

    // 2. Write the new value
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${String.fromCharCode(65 + gotIndex)}${targetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[got]],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
