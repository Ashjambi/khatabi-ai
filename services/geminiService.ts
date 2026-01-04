
import { GoogleGenAI, Type } from "@google/genai";
import { Letter, ExtractedLetterDetails, EnhancementSuggestion, FollowUpItem, SmartReply, Tone, SmartSearchResult } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// قاعدة لغوية قطعية لمنع تقطيع الحروف العربية في كافة المخرجات
const ARABIC_STRICT_CONNECTED_SCRIPT = `
قاعدة لغوية صارمة جداً (Linguistic Enforcement):
يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية تماماً. 
يُمنع منعاً باتاً فصل الحروف (مثال: اكتب "خطاب" وليس "خ ط ا ب"). 
استخدم الخط العربي المتصل القياسي فقط. أي مخرج بحروف مقطعة سيعتبر خطأ برمجياً جسيماً.
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
  
  // نرسل فقط آخر 20 خطاباً لتقليل حجم الطلب وتجنب قيود الشبكة في Cloudflare
  const recentLetters = existingLetters.slice(0, 20);
  const lettersContext = recentLetters.length > 0 
    ? `**سياق الأرشيف الأخير للمطابقة:**\n` + recentLetters.map(l => 
        `- ID: "${l.id}", Ref: "${l.internalRefNumber || ''}", ExtRef: "${l.externalRefNumber || ''}", Subject: "${l.subject}"`
      ).join('\n')
    : "لا توجد سجلات سابقة للمطابقة.";

  const systemInstruction = `أنت خبير OCR وإدارة وثائق حكومية محترف. مهمتك هي تحليل صورة المستند واستخراج البيانات بدقة متناهية.
  ${ARABIC_STRICT_CONNECTED_SCRIPT}
  
  **التعليمات التقنية:**
  1. استخرج الحقول المطلوبة بصيغة JSON فقط.
  2. إذا وجد رقم إشارة أو تاريخ لخطاب سابق في المتن، حاول مطابقته مع السياق المقدم وتحديد الـ referenceId.
  3. تأكد من أن التاريخ المستخرج بصيغة YYYY-MM-DD.
  4. لخص "المحتوى" في جملة واحدة احترافية تحت حقل summary.

  **السياق المتوفر:**
  ${lettersContext}`;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", // استخدام Pro لمهام OCR المعقدة
        contents: {
            parts: [
                { text: `حلل هذه الصورة واستخرج البيانات كـ JSON مع الالتزام بقواعد اللغة العربية المتصلة.` },
                { inlineData: { mimeType, data: base64Image } }
            ]
        },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING, description: "موضوع الخطاب" },
                    from: { type: Type.STRING, description: "جهة الإرسال" },
                    to: { type: Type.STRING, description: "جهة الاستلام أو القسم الموجه له" },
                    date: { type: Type.STRING, description: "تاريخ الخطاب YYYY-MM-DD" },
                    externalRefNumber: { type: Type.STRING, description: "رقم الصادر المسجل على الورقة" },
                    summary: { type: Type.STRING, description: "ملخص قصير جداً للإجراء المطلوب" },
                    category: { type: Type.STRING, description: "تصنيف مقترح (مثال: مالي، إداري، فني)" },
                    priority: { type: Type.STRING, enum: priorityLevels },
                    confidentiality: { type: Type.STRING, enum: confidentialityLevels },
                    referenceId: { type: Type.STRING, description: "معرف الخطاب المرتبط من السياق" },
                    referencedNumber: { type: Type.STRING, description: "رقم الخطاب المشار إليه في النص" }
                },
                required: ["subject", "from", "to", "summary"]
            }
        }
      });

      if (!response.text) throw new Error("Empty response from AI");
      return JSON.parse(response.text.trim()) as ExtractedLetterDetails;
  } catch (error) {
      console.error("OCR Service Error:", error);
      throw error;
  }
}

export async function generateSmartReplies(letter: Letter): Promise<SmartReply[]> {
    const ai = getAI();
    const content = letter.summary || letter.body.replace(/<[^>]*>?/gm, ' ');
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `اقترح 3 مسارات استراتيجية ذكية للرد على هذا الخطاب (الموضوع: ${letter.subject}). 
        المحتوى: ${content}.`,
        config: {
            systemInstruction: `أنت مستشار إداري خبير. اقترح مسارات رد مهنية متنوعة. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        objective: { type: Type.STRING },
                        tone: { type: Type.STRING, enum: ["رسمية صارمة", "محايدة", "دبلوماسية", "تعاونية"] },
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
        contents: `راجع النص التالي وقدم اقتراحات لتحسين صياغته الإدارية:\n\n${text}`,
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
    const threadText = thread.map(l => `${l.from} -> ${l.to}: ${l.subject}\n${l.body.replace(/<[^>]*>?/gm, ' ')}`).join('\n---\n');

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `لخص هذه السلسلة في فقرة واحدة مركزة:\n\n${threadText}`,
        config: { systemInstruction: `أنت خبير تلخيص معاملات. ${ARABIC_STRICT_CONNECTED_SCRIPT}`, temperature: 0.2 }
    });
    return response.text || "";
}

export async function getFollowUpSummary(letters: Letter[]): Promise<FollowUpItem[]> {
    const ai = getAI();
    const summaries = letters.map(l => ({ id: l.id, subject: l.subject }));
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حلل القائمة وحدد المعاملات التي تحتاج متابعة عاجلة:\n\n${JSON.stringify(summaries)}`,
        config: {
            systemInstruction: `أنت مساعد متابعة إداري. ${ARABIC_STRICT_CONNECTED_SCRIPT}`,
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
        contents: `ابحث سياقياً عن "${query}" في قائمة المعاملات التالية وقيم مدى الارتباط:\n\n${JSON.stringify(list)}`,
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
