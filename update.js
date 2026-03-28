import { google } from 'googleapis';

export default async function handler(req, res) {
  const { id, got } = req.body;

  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });

  // Find the row where column A matches the card id
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Sheet1!A:A',
  });

  const rows = readRes.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === id);

  if (rowIndex === -1) {
    return res.status(404).json({ success: false, error: 'Card not found' });
  }

  // Column I (index 8) is the "got" column — row is 1-indexed in Sheets
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Sheet1!I${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[got ? 'TRUE' : 'FALSE']] },
  });

  res.json({ success: true });
}