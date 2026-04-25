// Save as: api/update.js (replaces existing update.js)
// Handles ALL updates - Master, Donruss, Topps Now, Extra Collections

import { google } from 'googleapis';

export const config = { api: { bodyParser: true } };

const SHEET_CONFIG = {
  'master':            { name: 'Master',            gotCol: 'I', imageCol: 'J' },
  'donruss':           { name: 'Donruss',            gotCol: 'G', imageCol: 'H' },
  'topps-now':         { name: 'Topps Now',          gotCol: 'J', imageCol: 'K' },
  'extra-collections': { name: 'Extra Collections',  gotCol: 'H', imageCol: null },
};

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { sheet, rowIndex, got, imageUrl } = body;

    if (!sheet || !rowIndex) {
      return res.status(400).json({ success: false, error: 'Missing sheet or rowIndex' });
    }

    const config = SHEET_CONFIG[sheet];
    if (!config) {
      return res.status(400).json({ success: false, error: `Unknown sheet: ${sheet}` });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // Update got column
    if (got !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: `${config.name}!${config.gotCol}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[got === true || got === 'true' ? true : false]] },
      });
    }

    // Update image column
    if (imageUrl !== undefined && config.imageCol) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: `${config.name}!${config.imageCol}${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[imageUrl]] },
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
