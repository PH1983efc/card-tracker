// Save as: api/orders/read.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: false } };

const SHEET_NAME = 'Orders';

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
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = response.data.values || [];
    const orders = rows.slice(1)
      .map(row => { try { return JSON.parse(row[0]); } catch { return null; } })
      .filter(Boolean);

    res.json({ success: true, orders });

  } catch (err) {
    console.error('Orders read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
