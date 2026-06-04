export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { imageBase64, imageMime } = await req.json();

    const prompt = `Ты эксперт по маркетплейсам Wildberries и Ozon с опытом 7+ лет. Проанализируй карточку товара на скриншоте.

Верни ТОЛЬКО валидный JSON без markdown, без пояснений, строго по структуре:
{
  "score": число от 0 до 100,
  "platform": "WB" или "Ozon" или "Неизвестно",
  "product": "название товара одной строкой",
  "summary": "2-3 предложения общего вывода",
  "issues": [
    {
      "type": "critical" или "warning" или "tip",
      "category": "Фото" или "Заголовок" или "Описание" или "Цена" или "SEO" или "Инфографика" или "Рейтинг" или "Видео",
      "title": "короткое название проблемы",
      "description": "объяснение проблемы 1-2 предложения",
      "fix": "конкретное действие для исправления"
    }
  ],
  "strengths": ["список из 2-3 сильных сторон карточки"]
}

Если карточка хорошая (score выше 75) — укажи это в summary, напиши что улучшений сейчас не требуется, но порекомендуй обновить карточку к следующему сезону или через квартал. Найди 4-7 реальных проблем или советов.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const text = data.content?.map(i => i.text || '').join('') || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Нет JSON в ответе');
    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
