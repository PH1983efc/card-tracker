import { google } from "googleapis";

export const handler = async (event) => {
  try {
    const { cardId, got } = JSON.parse(event.body);

    if (!cardId || !got) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing cardId or got value" }),
      };
    }

    // Authenticate with Google
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // Load all rows so we can find the correct row number
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Master!A2:A", // Only Card ID column
    });

    const rows = response.data.values || [];

    // Find the row index where Card ID matches
    const rowIndex = rows.findIndex((row) => row[0] == cardId);

    if (rowIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Card ID not found" }),
      };
    }

    // Convert row index to actual sheet row number (add 2 because header + 0-index)
    const sheetRow = rowIndex + 2;

    // Update column I (Got)
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `Master!I${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[got]], // "Yes" or "No"
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("WRITE ERROR:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to update sheet" }),
    };
  }
};

