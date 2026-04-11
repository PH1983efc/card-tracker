// Save as: api/image-search.js

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { query } = body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Missing query' });
    }

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx     = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      return res.status(500).json({ success: false, error: 'Missing search credentials' });
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&searchType=image&q=${encodeURIComponent(query)}&num=5&imgSize=medium`;

    const response = await fetch(url);
    const data     = await response.json();

    if (!data.items || data.items.length === 0) {
      return res.json({ success: false, error: 'No images found' });
    }

    // Return top 5 results so user can pick if needed
    const images = data.items.map(item => ({
      url:     item.link,
      thumb:   item.image?.thumbnailLink || item.link,
      context: item.image?.contextLink || '',
      title:   item.title || ''
    }));

    res.json({ success: true, images });

  } catch (err) {
    console.error('Image search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
