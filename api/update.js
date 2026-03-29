import { google } from 'googleapis';

export const config = {
  api: { bodyParser: true },
};

const SHEET_NAME = 'Master';
const ID_COLUMN  = 'A';
const GOT_COLUMN = 9;

export default async function handler(req, res) {
  try {
    // Parse body whether it arrives as string or object
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { id, got } = body;

    console.log('id:', id, '| got:', got);

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!${ID_COLUMN}:${ID_COLUMN}`,
    });

    const rows = readRes.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === String(id));

    if (rowIndex === -1) {
      console.error('Not found. First 5 IDs:', rows.slice(0, 5).map(r => r[0]));
      return res.status(404).json({ success: false, error: `Card "${id}" not found` });
    }

    const sheetRow = rowIndex + 1;
    const colLetter = columnToLetter(GOT_COLUMN);

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!${colLetter}${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[got === true || got === 'true' ? true : false]] },
    });

    res.json({ success: true, updatedRow: sheetRow });

  } catch (err) {
    console.error('ERROR:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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
