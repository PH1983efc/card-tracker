// Save as: api/read.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: false } };

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
      range: 'Master',
    });

    const rows = response.data.values || [];
    console.log(`Loaded ${rows.length} rows, ${rows[0]?.length || 0} columns`);
    res.json({ success: true, rows });

  } catch (err) {
    console.error('Read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
