// api/gerar.js
const ALLOWED_METHOD = 'POST';
const MAX_INPUT_LEN = 400;

module.exports = async function handler(req, res) {
  try {
    if (req.method !== ALLOWED_METHOD) {
      res.setHeader('Allow', ALLOWED_METHOD);
      return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { business, goal, tone, notes } = req.body || {};
    if (![business, goal, tone].every(Boolean)) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }
    const totalLen = [business, goal, tone, notes || ''].join(' ').length;
    if (totalLen > MAX_INPUT_LEN) {
      return res.status(413).json({ error: 'Entrada muito longa. Resuma as observações.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY ausente no servidor.' });
    }

    const system = `Você é um redator de social media que escreve em PT-BR.
Gere exatamente 3 variações de legenda para Instagram, cada uma com:
1) TÍTULO curto na primeira linha (máx. ~6 palavras),
2) LEGENDA principal com no máximo 300 caracteres,
3) CTA (chamada para ação) direta,
4) 3 HASHTAGS (apenas 3, sem espaços entre palavras, relevantes ao tema).
Formato de saída obrigatória para cada variação:
TÍTULO: <título>
LEGENDA: <texto (<=300 chars)>
CTA: <texto>
HASHTAGS: #exemplo1 #exemplo2 #exemplo3
---
Nada além desse formato. Sem explicações adicionais.`;

    const user = `Contexto do negócio:
- Tipo de negócio: ${business}
- Objetivo do post: ${goal}
- Tom de voz: ${tone}
- Observações: ${notes || 'N/A'}

Instruções extras:
- Texto natural e humano, sem promessas médicas/jurídicas.
- Evite linguagem proibitiva de anúncios (ex.: garantias absolutas).
- Se objetivo for conversão, inclua CTA com ação clara (ex.: "Chame no WhatsApp", "Agende hoje").
- Use hashtags relevantes ao nicho, sempre 3 por variação.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.8,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const err = await safeJson(response);
      console.error('OpenAI error:', response.status, err);
      const msg = err?.error?.message || 'Falha ao consultar a OpenAI.';
      return res.status(502).json({ error: msg });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      console.error('Resposta sem conteúdo', data);
      return res.status(502).json({ error: 'Resposta vazia da OpenAI.' });
    }

    return res.status(200).json({ text });
  } catch (e) {
    console.error('Handler exception:', e);
    return res.status(500).json({ error: 'Erro interno. Verifique os logs.' });
  }
};

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
