import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DEFAULT_EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'];

export const generateThemeEmojis = async (topic: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a list of 16 distinct, high-contrast single emojis related to the topic: "${topic}". 
      If the topic is abstract, be creative. 
      Ensure they are visually distinct from each other. 
      Return ONLY the JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        }
      }
    });

    const text = response.text;
    if (!text) return DEFAULT_EMOJIS;
    
    const emojis = JSON.parse(text);
    if (Array.isArray(emojis) && emojis.length >= 8) {
      return emojis.slice(0, 16); // Ensure we have enough, cap at 16
    }
    return DEFAULT_EMOJIS;
  } catch (error) {
    console.error("Gemini Theme Error:", error);
    return DEFAULT_EMOJIS;
  }
};