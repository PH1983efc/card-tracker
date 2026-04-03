// Save as: api/donruss-update.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: true } };

const SHEET_NAME = 'Donruss'; // Must match your tab name exactly
const GOT_COLUMN = 'G';       // Column G = Got

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { rowIndex, got } = body;

    if (!rowIndex) {
      return res.status(400).json({ success: false, error: 'Missing rowIndex' });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `${SHEET_NAME}!${GOT_COLUMN}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[got === true || got === 'true' ? true : false]] },
    });

    res.json({ success: true, updatedRow: rowIndex });

  } catch (err) {
    console.error('Donruss update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
