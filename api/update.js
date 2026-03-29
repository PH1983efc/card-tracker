import { google } from 'googleapis';

const SHEET_NAME = 'Sheet1';
const ID_COLUMN  = 'A';
const GOT_COLUMN = 9;

export default async function handler(req, res) {
  try {
    console.log('--- update called ---');
    console.log('body:', JSON.stringify(req.body));

    const { id, got } = req.body;

    console.log('id:', id, '| type:', typeof id);
    console.log('got:', got, '| type:', typeof got);
    console.log('email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'MISSING');
    console.log('key:', process.env.GOOGLE_PRIVATE_KEY ? 'SET' : 'MISSING');
    console.log('sheetId:', process.env.GOOGLE_SHEET_ID ? 'SET' : 'MISSING');

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    console.log('auth created');

    const sheets = google.sheets({ version: 'v4', auth });

    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!${ID_COLUMN}:${ID_COLUMN}`,
    });

    console.log('read complete, rows found:', readRes.data.values?.length);

    const rows = readRes.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === String(id));

    console.log('rowIndex:', rowIndex);

    if (rowIndex === -1) {
      console.error('Card not found. First 5 IDs in sheet:', rows.slice(0, 5).map(r => r[0]));
      return res.status(404).json({ success: false, error: `Card "${id}" not found` });
    }

    const sheetRow = rowIndex + 1;
    const colLetter = columnToLetter(GOT_COLUMN);

    console.log(`writing ${got} to ${SHEET_NAME}!${colLetter}${sheetRow}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!${colLetter}${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[got === true || got === 'true' ? true : false]] },
    });

    console.log('write complete');
    res.json({ success: true, updatedRow: sheetRow, column: colLetter });

  } catch (err) {
    console.error('CAUGHT ERROR:', err.message);
    console.error('STACK:', err.stack);
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
