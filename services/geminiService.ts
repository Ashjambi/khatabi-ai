
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone } from "../types";

const ARABIC_STRICT_CONNECTED_SCRIPT = `
قاعدة لغوية صارمة: يجب أن تكون النصوص العربية بكلمات متصلة تماماً (مثل "خطاب" وليس "خ ط ا ب").
`;

export async function extractDetailsFromLetterImage(
  base64Image: string,
  mimeType: string,
  departments: string[],
  letterTypes: string[],
  priorityLevels: string[],
  confidentialityLevels: string[],
  existingCategories: string[],
  existingLetters: { id: string, subject: string, internalRefNumber?: string, externalRefNumber?: string, date: string }[]
): Promise<ExtractedLetterDetails> {
  // تهيئة مباشرة لضمان الحصول على المفتاح من البيئة
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const recentLetters = existingLetters.slice(0, 10);
  const lettersContext = recentLetters.length > 0 
    ? `الأرشيف الحديث للمطابقة:\n` + recentLetters.map(l => 
        `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
      ).join('\n')
    : "";

  const systemInstruction = `أنت مساعد إداري خبير. ${ARABIC_STRICT_CONNECTED_SCRIPT}
  حلل المستند واستخرج البيانات كـ JSON.
  السياق: ${lettersContext}`;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { text: `استخرج الحقول (subject, from, to, date, externalRefNumber, summary) بصيغة JSON من المرفق.` },
                { inlineData: { mimeType, data: base64Image.replace(/\s/g, '') } }
            ]
        },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    date: { type: Type.STRING },
                    externalRefNumber: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    category: { type: Type.STRING },
                    referenceId: { type: Type.STRING }
                },
                required: ["subject", "from", "to"]
            }
        }
      });

      const text = response.text;
      if (!text) throw new Error("لم يتم استلام رد");
      return JSON.parse(text.trim()) as ExtractedLetterDetails;
  } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error("تعذر تحليل المستند. تأكد من جودة الصورة ومن حقن مفتاح API_KEY في إعدادات البناء.");
  }
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `اقترح 3 مسارات للرد على: ${letter.subject}. المحتوى: ${content}`,
            config: {
                systemInstruction: `أنت مستشار إداري. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            objective: { type: Type.STRING },
                            tone: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["positive", "negative", "neutral", "inquiry"] }
                        },
                        required: ["title", "objective", "tone", "type"]
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]") as SmartReply[];
    } catch (e) {
        return [];
    }
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حسن الصياغة الإدارية للنص التالي:\n\n${text}`,
            config: {
                systemInstruction: `أنت مدقق لغوي إداري خبير. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `لخص هذه السلسلة:\n\n${threadText}`,
            config: { systemInstruction: `أنت خبير تلخيص إداري. ${ARABIC_STRICT_CONNECTED_SCRIPT}` }
        });
        return response.text || "";
    } catch (e) {
        return "تعذر التلخيص حالياً.";
    }
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حلل المعاملات التي تحتاج متابعة:\n\n${JSON.stringify(summaries)}`,
            config: {
                systemInstruction: `أنت مساعد متابعة معاملات. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const list = letters.map(l => ({ id: l.id, subject: l.subject }));
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `ابحث عن "${query}" في:\n\n${JSON.stringify(list)}`,
            config: {
                systemInstruction: `أنت خبير بحث سياقي. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}
