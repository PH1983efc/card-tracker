import { google } from 'googleapis';

const SHEET_NAME = 'Master'; // change if your tab is named differently
const ID_COLUMN  = 'A';      // column that holds the unique card ID
const GOT_COLUMN = 9;        // column I = 9 (A=1, B=2 ... I=9)

export default async function handler(req, res) {
  const { id, got } = req.body;

  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });

  // Read column A to find which row this card is on
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!${ID_COLUMN}:${ID_COLUMN}`,
  });

  const rows = readRes.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === String(id));

  if (rowIndex === -1) {
    console.error(`Card ID not found in sheet: "${id}"`);
    return res.status(404).json({ success: false, error: `Card "${id}" not found in sheet` });
  }

  const sheetRow = rowIndex + 1; // Sheets rows are 1-indexed
  const colLetter = columnToLetter(GOT_COLUMN);

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!${colLetter}${sheetRow}`,
    valueInputOption: 'USER_ENTERED', // KEY: lets Sheets treat TRUE/FALSE as booleans (ticks the checkbox)
    requestBody: { values: [[got === true || got === 'true' ? true : false]] },
  });

  res.json({ success: true, updatedRow: sheetRow, column: colLetter });
}

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}
