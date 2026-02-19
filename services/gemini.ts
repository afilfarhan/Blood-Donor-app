
import { GoogleGenAI } from "@google/genai";
import { Person } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const RECOVERY_DAYS = 56;

export const getGeminiResponse = async (query: string, data: Person[]) => {
  const model = 'gemini-3-flash-preview';
  
  const now = Date.now();
  const dataContext = data.map(p => {
    let eligibility = "Eligible";
    if (p.lastDonationDate) {
      const daysSince = (now - p.lastDonationDate) / (1000 * 60 * 60 * 24);
      if (daysSince < RECOVERY_DAYS) {
        eligibility = `In Recovery (Available in ${Math.ceil(RECOVERY_DAYS - daysSince)} days)`;
      }
    }
    return `ID: ${p.id}, Name: ${p.name}, Phone: ${p.phoneNumber}, Blood: ${p.bloodGroup}, Status: ${eligibility}, Notes: ${p.notes || 'N/A'}`;
  }).join('\n');

  const systemInstruction = `
    You are BloodLine AI, an assistant for a blood donor management app. 
    You have access to a directory of donors:
    ${dataContext}

    Your tasks:
    1. Answer questions about the donors (find matches, counts, or specific info).
    2. Provide general, non-diagnostic information about blood compatibility.
    3. Be helpful, concise, and professional.
    4. IMPORTANT: If a donor is "In Recovery", do NOT recommend them for immediate donation needs.
    5. If a user asks for someone who can donate to a specific blood group, use standard compatibility rules but prioritize "Eligible" donors.
    6. NEVER provide actual medical diagnoses.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: query,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error: Could not connect to AI assistant. Please check your API key.";
  }
};
