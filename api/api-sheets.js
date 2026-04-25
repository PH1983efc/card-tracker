// Save as: api/sheets.js
// Handles ALL sheet reads - replaces api/read.js, api/donruss.js, api/topps-now.js, api/extra-collections.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: false } };

const SHEET_MAP = {
  'master':            'Master',
  'donruss':           'Donruss',
  'topps-now':         'Topps Now',
  'extra-collections': 'Extra Collections',
  'orders':            'Orders',
};

export default async function handler(req, res) {
  try {
    // Get sheet name from query param: /api/sheets?sheet=donruss
    const sheet = req.query.sheet || 'master';
    const sheetName = SHEET_MAP[sheet];

    if (!sheetName) {
      return res.status(400).json({ success: false, error: `Unknown sheet: ${sheet}` });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: sheetName,
    });

    const rows = response.data.values || [];
    console.log(`${sheetName}: ${rows.length} rows`);
    res.json({ success: true, rows });

  } catch (err) {
    console.error('Sheets read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
