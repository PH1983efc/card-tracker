// Save as: api/image-save.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { rowIndex, imageUrl, sheet } = body;

    if (!rowIndex || !imageUrl || !sheet) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // Master: image URL col J | Donruss: col H | Topps Now: col K
    const config = {
      'main':      { name: 'Master',    col: 'J' },
      'donruss':   { name: 'Donruss',   col: 'H' },
      'topps-now': { name: 'Topps Now', col: 'K' },
    };

    const target = config[sheet];
    if (!target) {
      return res.status(400).json({ success: false, error: `Unknown sheet: ${sheet}` });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `${target.name}!${target.col}${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[imageUrl]] },
    });

    res.json({ success: true });

  } catch (err) {
    console.error('Image save error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}// Save as: api/image-save.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { rowIndex, imageUrl, sheet } = body;

    if (!rowIndex || !imageUrl || !sheet) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // Master sheet: image URL in column J (10)
    // Donruss sheet: image URL in column H (8)
    const sheetName = sheet === 'donruss' ? 'Donruss' : 'Master';
    const col       = sheet === 'donruss' ? 'H' : 'J';

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `${sheetName}!${col}${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[imageUrl]] },
    });

    res.json({ success: true });

  } catch (err) {
    console.error('Image save error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
