// Save as: api/orders/write.js

import { google } from 'googleapis';

export const config = { api: { bodyParser: true } };

const SHEET_NAME = 'Orders';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { orders } = body;

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.clear({
      spreadsheetId: process.env.SHEET_ID,
      range: `${SHEET_NAME}!A2:A`,
    });

    if (orders && orders.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: 'RAW',
        requestBody: { values: orders.map(o => [JSON.stringify(o)]) },
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error('Orders write error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
