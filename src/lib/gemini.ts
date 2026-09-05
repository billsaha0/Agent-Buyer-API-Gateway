import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini client
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Takes a search query or product description and returns a 768D vector.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: text,
    config: {
        outputDimensionality: 768
    }
  });
  
  if (!response.embeddings || !response.embeddings[0].values) {
    throw new Error("Failed to generate embedding from Gemini");
  }
  
  return response.embeddings[0].values;
}