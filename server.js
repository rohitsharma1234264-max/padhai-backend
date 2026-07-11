const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve the frontend (index.html and any other static files) from /public
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.GEMINI_API_KEY;

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'Server par API key set nahi hai.' });
    }

    const { system, messages } = req.body;

    // Convert Anthropic-style messages to Gemini format
    const contents = messages.map(m => {
      let parts = [];
      if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'image') {
            parts.push({
              inline_data: {
                mime_type: block.source.media_type,
                data: block.source.data
              }
            });
          }
        }
      } else {
        parts.push({ text: m.content });
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: parts
      };
    });

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: { maxOutputTokens: 1000 }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json(data);
    }

    // Convert Gemini response back to Anthropic-style shape the frontend expects
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    res.json({ content: [{ type: 'text', text: text }] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server chal raha hai port ' + PORT + ' par'));
