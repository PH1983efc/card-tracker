import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const { cardId, got } = req.body;

    if (!cardId || !got) {
      return res.status(400).json({
        success: false,
        message: "Missing cardId or got",
      });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;
    const sheetName = "Master";

    // Find the row with matching cardId
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });

    const rows = readRes.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === cardId);

    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Card ID not found",
      });
    }

    // Column I = index 8
    const updateRange = `${sheetName}!I${rowIndex + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[got]],
      },
    });

    res.status(200).json({
      success: true,
      message: "Updated successfully",
      updatedRow: rowIndex + 1,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Write failed",
      error: error.message,
    });
  }
}
