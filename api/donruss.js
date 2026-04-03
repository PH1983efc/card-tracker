// Save as: api/donruss.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: false } };

const SHEET_NAME = 'Donruss'; // Must match your tab name exactly

export default async function handler(req, res) {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: `${SHEET_NAME}!A:G`,
    });

    res.json({ success: true, rows: response.data.values || [] });

  } catch (err) {
    console.error('Donruss read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
