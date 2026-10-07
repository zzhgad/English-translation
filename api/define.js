export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  const word = String(request.body?.word || '').trim().toLowerCase();
  if (!/^[a-z]+(?:['-][a-z]+)?$/.test(word)) return response.status(400).json({ error: 'Invalid word' });
  if (!process.env.DEEPSEEK_API_KEY) return response.status(503).json({ error: 'DeepSeek API is not configured' });
  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.2, max_tokens: 220, messages: [{ role: 'system', content: '你是英语学习词典。只返回合法 JSON，不要 Markdown。字段必须是 pos、definition、example、phonetic。definition 用简洁中文，example 保持英文。' }, { role: 'user', content: `解释单词：${word}` }] }) });
    if (!upstream.ok) return response.status(502).json({ error: 'DeepSeek request failed' });
    const data = await upstream.json(); const raw = data.choices?.[0]?.message?.content || ''; const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim());
    return response.status(200).json({ word, pos: parsed.pos || 'word', definition: parsed.definition || '暂无释义', example: parsed.example || 'Keep meeting new words in context.', phonetic: parsed.phonetic || '/ — /' });
  } catch { return response.status(502).json({ error: 'Unable to parse DeepSeek response' }); }
}
