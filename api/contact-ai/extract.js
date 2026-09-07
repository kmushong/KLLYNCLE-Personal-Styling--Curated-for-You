const extractionSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
    message: { type: 'string' }
  },
  required: ['name', 'email', 'message'],
  additionalProperties: false
};

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({ error: 'AI extraction is not configured on the server.' });
  }

  const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
  if (!text) return response.status(400).json({ error: 'A note is required.' });
  if (text.length > 6000) return response.status(413).json({ error: 'Please keep your note under 6,000 characters.' });

  const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: { name: 'contact_fields', strict: true, schema: extractionSchema } },
        messages: [
          {
            role: 'system',
            content: 'Extract contact details from the users note. Return JSON only. Use an empty string when name or email is not provided. Preserve the users meaning in message and briefly identify the inquiry type within it.'
          },
          { role: 'user', content: text }
        ]
      })
    });

    if (!aiResponse.ok) {
      console.error('AI provider error:', await aiResponse.text());
      return response.status(502).json({ error: 'The AI service could not process this note.' });
    }

    const payload = await aiResponse.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return response.status(502).json({ error: 'The AI service returned an empty response.' });

    const fields = JSON.parse(content);
    return response.status(200).json({
      name: typeof fields.name === 'string' ? fields.name.trim() : '',
      email: typeof fields.email === 'string' ? fields.email.trim() : '',
      message: typeof fields.message === 'string' ? fields.message.trim() : ''
    });
  } catch (error) {
    console.error('AI extraction failed:', error);
    return response.status(500).json({ error: 'Unable to extract contact details right now.' });
  }
};
