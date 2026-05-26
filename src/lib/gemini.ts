import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

const genAI = new GoogleGenerativeAI(apiKey);

export const geminiFlash = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: { responseMimeType: "application/json" },
});

export async function generateJSON<T>(prompt: string): Promise<T> {
  const result = await geminiFlash.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text) as T;
}
