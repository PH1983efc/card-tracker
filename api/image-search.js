// Save as: api/image-search.js

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  try {
    const body  = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { query } = body;

    if (!query) return res.status(400).json({ success: false, error: 'Missing query' });

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx     = process.env.GOOGLE_SEARCH_CX;

    console.log('Search query:', query);
    console.log('API key set:', !!apiKey);
    console.log('CX set:', !!cx);

    if (!apiKey || !cx) {
      return res.status(500).json({ success: false, error: 'Missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX env vars' });
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&searchType=image&q=${encodeURIComponent(query)}&num=5&imgSize=medium&safe=off`;

    const response = await fetch(url);
    const data     = await response.json();

    console.log('Response status:', response.status);
    console.log('Items found:', data.items?.length ?? 0);

    if (data.error) {
      console.error('Google API error:', JSON.stringify(data.error));
      return res.status(500).json({ success: false, error: data.error.message, details: data.error });
    }

    if (!data.items || data.items.length === 0) {
      return res.json({ success: false, error: 'No images found' });
    }

    const images = data.items.map(item => ({
      url:   item.link,
      thumb: item.image?.thumbnailLink || item.link,
      title: item.title || ''
    }));

    res.json({ success: true, images });

  } catch (err) {
    console.error('Image search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
