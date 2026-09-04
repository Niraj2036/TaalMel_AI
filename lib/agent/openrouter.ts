// OpenRouter LLM Client — calls OpenRouter API for chat completions

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function chatCompletion(messages: any[], tools?: any[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const payload: any = {
    model: 'google/gemma-4-31B-it', // Using the proven model from your Capstone project
    messages,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools.map((t: any) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message;
}
