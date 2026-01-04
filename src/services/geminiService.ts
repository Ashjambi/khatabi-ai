
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  
  const lettersContext = existingLetters.map(l => 
    `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", ExtRef: "${l.externalRefNumber || ''}", Subject: "${l.subject}", Date: "${l.date}"`
  ).join('\n');

  // تعليمات لغوية قصوى لمنع تقطيع الحروف العربية
  const systemInstruction = `أنت خبير لغوي وإداري عربي متخصص في استخلاص البيانات من الوثائق الرسمية.
  
  **قواعد ذهبية للمخرجات:**
  1. يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية (مثل: "خطاب" وليس "خ ط ا ب").
  2. يُمنع منعاً باتاً وضع مسافات بين حروف الكلمة الواحدة.
  3. استخلص البيانات بدقة كما تظهر في المستند وبصيغة JSON.

  **المهام:**
  1. استخرج (الموضوع، المرسل، المستلم، التاريخ، رقم الصادر الخارجي).
  2. طابق الخطاب مع السجلات الموجودة إذا كان هناك إشارة لخطاب سابق:
  ${lettersContext}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
        parts: [
            { text: `حلل صورة الخطاب المرفقة واستخرج البيانات. تأكد أن النص العربي سليم ومتصل وغير مقطع حروفه.` },
            { inlineData: { mimeType, data: base64Image } }
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
            required: ["subject", "from", "to", "date"]
        }
    }
  });

  return JSON.parse(response.text || "{}") as ExtractedLetterDetails;
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات احترافية للرد على هذا الخطاب (الموضوع: ${letter.subject}). 
        المحتوى: ${content}. 
        اكتب الردود بلغة عربية متصلة وسليمة تماماً.`,
        config: {
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
        contents: `راجع النص التالي وقدم اقتراحات لتحسين صياغته الإدارية (مع إبقاء الكلمات متصلة):\n\n${text}`,
        config: {
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
}

export async function summarizeCorrespondenceThread(thread: Letter[]): Promise<string> {
    const ai = getAI();
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}\n${l.body.replace(/<[^>]*>?/gm, ' ')}`).join('\n---\n');

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة في فقرة واحدة بكلمات متصلة:\n\n${threadText}`,
        config: { temperature: 0.2 }
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `من القائمة التالية، ما هي المعاملات التي تحتاج متابعة عاجلة؟ JSON:\n\n${JSON.stringify(summaries)}`,
        config: {
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

export async function searchLettersSmartly(query: string, letters: Letter[]): Promise<any[]> {
    const ai = getAI();
    const list = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ابحث سياقياً عن "${query}" في:\n\n${JSON.stringify(list)}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
}
