
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const ARABIC_STRICT_CONNECTED_SCRIPT = `
قاعدة لغوية صارمة جداً:
يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية تماماً. 
يُمنع منعاً باتاً فصل الحروف (مثال: اكتب "خطاب" وليس "خ ط ا ب"). 
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
  const ai = getAI();
  
  // تقليل السياق لأقصى حد لضمان عبور الطلب من Cloudflare
  const recentLetters = existingLetters.slice(0, 10);
  const lettersContext = recentLetters.length > 0 
    ? `الأرشيف الحديث للمطابقة:\n` + recentLetters.map(l => 
        `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", Subject: "${l.subject}"`
      ).join('\n')
    : "";

  const systemInstruction = `أنت مساعد إداري خبير في تصنيف الخطابات الرسمية واستخراج البيانات.
  ${ARABIC_STRICT_CONNECTED_SCRIPT}
  المهمة: حلل المستند المرفق (صورة أو PDF) واستخرج البيانات بصيغة JSON.
  
  السياق:
  ${lettersContext}`;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Flash أكثر استقراراً لملفات PDF الكبيرة في الإنتاج
        contents: {
            parts: [
                { text: `استخرج الحقول التالية من المستند المرفق بصيغة JSON: subject, from, to, date (YYYY-MM-DD), externalRefNumber, summary, category, priority, confidentiality, referenceId (إذا وجد تطابق).` },
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
                    referenceId: { type: Type.STRING },
                    referencedNumber: { type: Type.STRING }
                },
                required: ["subject", "from", "to"]
            }
        }
      });

      const text = response.text;
      if (!text) throw new Error("لم يتم استلام رد من الذكاء الاصطناعي");
      return JSON.parse(text.trim()) as ExtractedLetterDetails;
  } catch (error: any) {
      console.error("Gemini OCR Error:", error);
      throw new Error(error.message || "فشل تحليل المستند");
  }
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
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
}

export async function enhanceLetter(text: string): Promise<EnhancementSuggestion[]> {
    const ai = getAI();
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
                    },
                    required: ["original_part", "suggested_improvement", "reason"]
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}`).join('\n');

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة:\n\n${threadText}`,
        config: { systemInstruction: `أنت خبير تلخيص. ${ARABIC_STRICT_CONNECTED_SCRIPT}` }
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
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
}

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<SmartSearchResult[]> {
    const ai = getAI();
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
                    },
                    required: ["letterId", "relevanceReason", "confidenceScore"]
                }
            }
        }
    });
    
    return JSON.parse(response.text || "[]");
}
