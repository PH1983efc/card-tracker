import { google } from "googleapis";

export const handler = async () => {
  try {
    // Authenticate with Google
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // Read all rows from the Master tab
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Master!A2:I", // Skip header row
    });

    const rows = response.data.values || [];

    // Convert rows into clean JSON objects
    const cards = rows.map((row) => ({
      cardId: row[0] || "",
      year: row[1] || "",
      cardSet: row[2] || "",
      cardNo: row[3] || "",
      playerName: row[4] || "",
      cardDescription: row[5] || "",
      variant: row[6] || "",
      collecting: row[7] || "",
      got: row[8] || "",
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(cards),
    };
  } catch (error) {
    console.error("READ ERROR:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to read sheet" }),
    };
  }
};

