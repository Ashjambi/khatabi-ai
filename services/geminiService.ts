
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

/**
 * وظيفة للتحقق من المفتاح وتوفير رسالة خطأ واضحة
 */
const getApiKey = () => {
    const key = process.env.API_KEY;
    if (!key || key === "undefined" || key === "") {
        throw new Error("API_KEY_NOT_FOUND_IN_BROWSER");
    }
    return key;
};

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
  try {
      // تهيئة جديدة عند كل استدعاء لضمان الحصول على أحدث مفتاح من البيئة
      const ai = new GoogleGenAI({ apiKey: getApiKey() });
      
      const recentLetters = existingLetters.slice(0, 10);
      const lettersContext = recentLetters.length > 0 
        ? `الأرشيف الحديث للمطابقة:\n` + recentLetters.map(l => 
            `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
          ).join('\n')
        : "";

      const systemInstruction = `أنت خبير OCR إداري. ${ARABIC_STRICT_CONNECTED_SCRIPT}
      حلل المستند واستخرج البيانات كـ JSON.
      السياق: ${lettersContext}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { text: `استخرج الحقول (subject, from, to, date, externalRefNumber, summary) بصيغة JSON.` },
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
                    priority: { type: Type.STRING },
                    confidentiality: { type: Type.STRING },
                    referenceId: { type: Type.STRING }
                },
                required: ["subject", "from", "to"]
            }
        }
      });

      const text = response.text;
      if (!text) throw new Error("لم يصل رد من الذكاء الاصطناعي");
      return JSON.parse(text.trim()) as ExtractedLetterDetails;

  } catch (error: any) {
      if (error.message === "API_KEY_NOT_FOUND_IN_BROWSER") {
          throw new Error("لم يتم حقن مفتاح API في المتصفح. تأكد من إضافة API_KEY في متغيرات Build في Cloudflare وليس فقط Variables.");
      }
      console.error("Gemini OCR Error:", error);
      throw error;
  }
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حسن الصياغة الإدارية للنص التالي:\n\n${text}`,
            config: {
                systemInstruction: `أنت مدقق لغوي إداري. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            original_part: { type: Type.STRING },
                            suggested_improvement: { type: Type.STRING },
                            reason: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `لخص هذه السلسلة:\n\n${threadText}`,
            config: { systemInstruction: `أنت خبير تلخيص. ${ARABIC_STRICT_CONNECTED_SCRIPT}` }
        });
        return response.text || "";
    } catch (e) {
        return "تعذر التلخيص حالياً.";
    }
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `حلل المعاملات التي تحتاج متابعة:\n\n${JSON.stringify(summaries)}`,
            config: {
                systemInstruction: `أنت مساعد متابعة. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            letterId: { type: Type.STRING },
                            summary: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<SmartSearchResult[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const list = letters.map(l => ({ id: l.id, subject: l.subject }));
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `ابحث عن "${query}" في:\n\n${JSON.stringify(list)}`,
            config: {
                systemInstruction: `أنت خبير بحث سياقي. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            letterId: { type: Type.STRING },
                            relevanceReason: { type: Type.STRING },
                            confidenceScore: { type: Type.NUMBER }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return [];
    }
}
