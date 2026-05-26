import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

const client = new OpenAI({
  apiKey,
  baseURL: "https://api.deepseek.com",
});

export async function generateJSON<T>(prompt: string): Promise<T> {
  const response = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message.content ?? "{}";
  return JSON.parse(text) as T;
}
