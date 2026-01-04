
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../App';
import { Letter, LetterType, Tone, PriorityLevel, ConfidentialityLevel, GeneratorState, LetterVariations, SmartReply } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { generateSmartReplies } from '../services/geminiService';
import { toast } from 'react-hot-toast';
import { getThemeClasses, sanitizeHTML } from './utils';
import RichTextEditor from './RichTextEditor';
import MultiSelectCombobox from './MultiSelectCombobox';
import { SparklesIcon, FileTextIcon, BotIcon, InboxInIcon, CheckCircleIcon, ArrowRightLeftIcon, Undo2Icon, MessageSquareIcon, SendIcon } from './icons';

interface LetterAnalysis {
    strategic_feedback: string[];
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export default function LetterGenerator() {
    const { state, dispatch } = useApp();
    const { generatorState, learnedPrinciples, companySettings, letters } = state;
    const {
        sender, receiver, subject, cc, priority, confidentiality,
        completionDays, notes, tone, letterType, originalLetterContent, referenceId, objective
    } = generatorState;

    const theme = getThemeClasses(companySettings.primaryColor);
    const [step, setStep] = useState(0); 
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingReplies, setIsLoadingReplies] = useState(false);
    const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
    const [generatedContent, setGeneratedContent] = useState<{variations: LetterVariations, analysis: LetterAnalysis} | null>(null);
    const [finalBody, setFinalBody] = useState('');
    const [objectiveText, setObjectiveText] = useState(objective || '');
    const [isContextCollapsed, setIsContextCollapsed] = useState(false);

    // AI Chat State
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const parentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);
    const isReplyMode = !!referenceId;

    useEffect(() => {
        if (isReplyMode && parentLetter) {
            const fetchReplies = async () => {
                setIsLoadingReplies(true);
                try {
                    const replies = await generateSmartReplies(parentLetter);
                    setSmartReplies(replies);
                } catch (e) {
                    console.error("Smart replies failed", e);
                } finally {
                    setIsLoadingReplies(false);
                }
            };
            fetchReplies();
        }
    }, [referenceId, parentLetter]);

    useEffect(() => { 
        if (objective) setObjectiveText(objective); 
    }, [objective]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const updateState = (payload: Partial<GeneratorState>) => {
        dispatch({ type: 'UPDATE_GENERATOR_STATE', payload });
    };

    const handleGenerate = async () => {
        if (!objectiveText.trim()) {
            toast.error("الرجاء إدخال التوجيهات أو اختيار مسار رد.");
            return;
        }

        setIsLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const systemInstruction = `أنت خبير الصياغة الإدارية. 
            قاعدة لغوية قطعية: يجب أن تكون جميع النصوص العربية بكلمات متصلة وطبيعية (يُمنع منعاً باتاً فصل الحروف). 
            المهمة: إنشاء 3 مسودات (رسمية، حازمة، دبلوماسية) بصيغة HTML.
            الأسلوب المطلوب: ${learnedPrinciples.map(p => p.text).join(' - ')}`;

            const userPrompt = isReplyMode 
                ? `أنت ترد على خطاب وارد بالمعطيات التالية:
                   السياق الأصلي: ${originalLetterContent}
                   توجيه الرد الحالي: ${objectiveText}
                   الأطراف: من ${sender} إلى ${receiver}
                   الموضوع: ${subject}
                   المطلوب: صياغة رد رسمي متصل الحروف يشير للمرجع.`
                : `أنشئ خطاباً رسمياً جديداً:
                   الموضوع: ${subject}
                   المحتوى المطلوب: ${objectiveText}
                   المرسل: ${sender} | المستلم: ${receiver}
                   الصياغة: لغة عربية رصينة متصلة الحروف.`;

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: { parts: [{ text: userPrompt }] } as any,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            analysis: { type: Type.OBJECT, properties: { strategic_feedback: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                            variations: {
                                type: Type.OBJECT,
                                properties: { neutral: { type: Type.STRING }, strict: { type: Type.STRING }, diplomatic: { type: Type.STRING } },
                                required: ["neutral", "strict", "diplomatic"]
                            }
                        }
                    }
                }
            });

            setGeneratedContent(JSON.parse(response.text || "{}"));
            setStep(1);
        } catch (e) {
            toast.error("فشلت الصياغة الذكية. يرجى المحاولة لاحقاً.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleChatSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsChatLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: {
                    parts: [{
                        text: `النص الحالي للخطاب هو: \n${finalBody}\n\nطلب المستخدم: ${userMessage}\n\nالمطلوب: قم بتعديل النص بناءً على الطلب مع الحفاظ على الرسمية واللغة العربية المتصلة. أعد النص الجديد بصيغة HTML وردودك في JSON.`
                    }]
                } as any,
                config: {
                    systemInstruction: "أنت مساعد صياغة إداري ذكي. عندما يطلب المستخدم تعديلات، قم بتحديث الخطاب وأعد النتيجة بصيغة JSON تحتوي على الحقول (updated_body) و (ai_comment). تأكد من صحة الحروف العربية واتصالها.",
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            updated_body: { type: Type.STRING },
                            ai_comment: { type: Type.STRING }
                        },
                        required: ["updated_body", "ai_comment"]
                    }
                }
            });

            const result = JSON.parse(response.text || "{}");
            if (result.updated_body) {
                setFinalBody(result.updated_body);
                setChatHistory(prev => [...prev, { role: 'model', text: result.ai_comment }]);
                toast.success("تم تحديث النص بناءً على ملاحظاتك.");
            }
        } catch (error) {
            toast.error("فشل المساعد الذكي في معالجة طلبك.");
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleFinalSave = () => {
        dispatch({ 
            type: 'CREATE_LETTER', 
            payload: { 
                newLetterData: { 
                    subject, from: sender, to: receiver, body: finalBody, 
                    type: letterType, tone, attachments: [], cc, priority, 
                    confidentiality, completionDays: Number(completionDays) || undefined, notes 
                } 
            } 
        });
        toast.success("تم اعتماد الخطاب وحفظه بنجاح.");
    };

    return (
        <div className="max-w-[1700px] mx-auto pb-12">
            <div className="flex justify-between items-end mb-8 px-2">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">مركز الصياغة والتحليل</h2>
                    <div className="flex items-center gap-3 mt-2">
                         {isReplyMode ? (
                            <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg text-[11px] font-black border border-emerald-500/20 flex items-center gap-2">
                                <BotIcon className="w-3.5 h-3.5" /> نمط الرد الاستراتيجي
                            </span>
                         ) : (
                            <span className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-lg text-[11px] font-black border border-indigo-500/20 flex items-center gap-2">
                                <SparklesIcon className="w-3.5 h-3.5" /> نمط الإنشاء الحر
                            </span>
                         )}
                         {isReplyMode && <span className="text-slate-500 text-[11px] font-bold">• المرجع: {parentLetter?.internalRefNumber}</span>}
                    </div>
                </div>
                {step > 0 && (
                    <button onClick={() => setStep(step - 1)} className="btn-3d-secondary px-5 py-2.5 flex items-center gap-2 text-xs font-black hover:scale-105 transition-all">
                        <Undo2Icon className="w-4 h-4" /> العودة للتعديل
                    </button>
                )}
            </div>

            <div className={`grid grid-cols-1 ${isReplyMode ? 'lg:grid-cols-12' : ''} gap-8`}>
                
                {/* --- لوحة الخطاب الوارد (المرجع) --- */}
                {isReplyMode && parentLetter && (
                    <div className={`${isContextCollapsed ? 'lg:col-span-1' : 'lg:col-span-4'} transition-all duration-500`}>
                        <div className="glass-card sticky top-6 border-indigo-500/20 bg-slate-950/40 overflow-hidden shadow-2xl rounded-3xl">
                            <div className="p-4 bg-indigo-500/10 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <InboxInIcon className="w-5 h-5 text-indigo-400" />
                                    {!isContextCollapsed && <span className="font-black text-[11px] text-indigo-300 uppercase tracking-widest">الخطاب الوارد المرجعي</span>}
                                </div>
                                <button onClick={() => setIsContextCollapsed(!isContextCollapsed)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                    <ArrowRightLeftIcon className={`w-4 h-4 text-slate-500 ${isContextCollapsed ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                            
                            {!isContextCollapsed && (
                                <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase mb-1">الموضوع</p>
                                        <h3 className="text-lg font-black text-white leading-snug">{parentLetter.subject}</h3>
                                    </div>
                                    
                                    <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/10 shadow-inner ring-1 ring-white/5">
                                        <p className="text-[10px] font-black text-indigo-400 mb-4 flex items-center gap-2 uppercase tracking-widest border-b border-white/5 pb-2">
                                            <FileTextIcon className="w-3.5 h-3.5"/> نص المتن (للقراءة والتحليل)
                                        </p>
                                        <div className="text-[14px] text-white font-bold leading-relaxed max-h-[500px] overflow-y-auto custom-scrollbar prose prose-invert prose-sm prose-p:text-white prose-strong:text-indigo-300" dangerouslySetInnerHTML={{ __html: sanitizeHTML(parentLetter.body) }} />
                                    </div>

                                    <div className="pt-4 border-t border-white/5 flex flex-col gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <div className="flex justify-between"><span>تاريخ الورود:</span><span className="text-slate-300">{parentLetter.date}</span></div>
                                        <div className="flex justify-between"><span>المرسل:</span><span className="text-slate-300 truncate max-w-[150px]">{parentLetter.from}</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- منطقة العمل الرئيسية --- */}
                <div className={`${isReplyMode ? (isContextCollapsed ? 'lg:col-span-11' : 'lg:col-span-8') : 'max-w-5xl mx-auto w-full'} transition-all duration-500`}>
                    
                    {step === 0 && (
                        <div className="glass-card p-8 space-y-8 animate-in slide-in-from-bottom-6 duration-700 border-white/10 rounded-3xl shadow-3xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/40 p-6 rounded-3xl border border-white/5 relative overflow-hidden shadow-inner">
                                <div className="space-y-1 relative z-10">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">الجهة المرسلة (من)</label>
                                    <input type="text" value={sender} onChange={e => updateState({ sender: e.target.value })} className="w-full bg-transparent border-none text-slate-200 font-bold text-base p-0 focus:ring-0 placeholder-slate-800" placeholder="حدد المرسل..." />
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">الجهة المستلمة (إلى)</label>
                                    <input type="text" value={receiver} onChange={e => updateState({ receiver: e.target.value })} className="w-full bg-transparent border-none text-slate-200 font-bold text-base p-0 focus:ring-0 placeholder-slate-800" placeholder="حدد المستلم..." />
                                </div>
                                <div className="md:col-span-2 pt-4 border-t border-white/5 relative z-10">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">موضوع الخطاب</label>
                                    <input type="text" value={subject} onChange={e => updateState({ subject: e.target.value })} className="w-full bg-transparent border-none text-indigo-400 font-black text-xl p-0 focus:ring-0 placeholder-slate-800 mt-1" placeholder="عنوان المعاملة..." />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-sm font-black text-slate-200 flex items-center gap-2">
                                        <MessageSquareIcon className="w-4 h-4 text-indigo-400" />
                                        توجيه الذكاء الاصطناعي (أهداف الرد)
                                    </label>
                                </div>

                                <textarea 
                                    value={objectiveText} 
                                    onChange={e => setObjectiveText(e.target.value)}
                                    rows={5}
                                    className="w-full input-inset p-6 rounded-2xl text-base font-bold leading-relaxed border-indigo-500/10 focus:border-indigo-500 shadow-2xl transition-all placeholder-slate-600 bg-slate-950/20"
                                    placeholder="اشرح هنا ما تريد تحقيقه من هذا الخطاب، وسيقوم النظام بصياغته باحترافية..."
                                />
                                
                                {isReplyMode && (
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                            {isLoadingReplies ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-500"></div> : <SparklesIcon className="w-3 h-3" />}
                                            مسارات استراتيجية مقترحة (الرد السريع)
                                        </p>
                                        <div className="flex flex-col gap-2.5">
                                            {smartReplies.map((reply, i) => (
                                                <button 
                                                    key={i} 
                                                    onClick={() => { setObjectiveText(reply.objective); updateState({ tone: reply.tone as Tone }); }}
                                                    className={`p-4 rounded-xl border text-right transition-all group hover:bg-white/5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 ${objectiveText === reply.objective ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/5 hover:border-indigo-500/40'}`}
                                                >
                                                    <div className="flex-1">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest block mb-1.5 ${objectiveText === reply.objective ? 'text-white/80' : 'text-slate-500'}`}>{reply.title}</span>
                                                        <p className={`text-[13px] font-bold leading-snug ${objectiveText === reply.objective ? 'text-white' : 'text-slate-200'}`}>{reply.objective}</p>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-3">
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded bg-black/30 border border-white/5 ${objectiveText === reply.objective ? 'text-indigo-100' : 'text-slate-500'}`}>{reply.tone}</span>
                                                        {objectiveText === reply.objective && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-center pt-4">
                                <button 
                                    onClick={handleGenerate} 
                                    disabled={isLoading || !objectiveText.trim()}
                                    className={`group relative overflow-hidden px-16 py-5 rounded-2xl font-black text-xl flex items-center gap-4 transition-all shadow-[0_20px_60px_rgba(99,102,241,0.3)] active:scale-95 ${isLoading ? 'bg-slate-700 cursor-not-allowed' : theme.bg + ' text-white hover:brightness-110'}`}
                                >
                                    {isLoading ? (
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                    ) : (
                                        <SparklesIcon className="w-8 h-8 group-hover:rotate-12 transition-all duration-500" />
                                    )}
                                    <span>{isLoading ? 'جاري التحليل...' : 'توليد المسودات الذكية'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 1 && generatedContent && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                             <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl flex items-start gap-5 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                                <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 shrink-0"><BotIcon className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">توصية الخبير الإداري</p>
                                    <p className="text-base text-white font-black leading-relaxed">{generatedContent.analysis.strategic_feedback[0]}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {(['neutral', 'strict', 'diplomatic'] as const).map(vKey => (
                                    <div key={vKey} className="bg-slate-900/80 rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col hover:border-indigo-500/50 hover:shadow-2xl transition-all group/card">
                                        <div className="p-5 bg-white/5 border-b border-white/10 text-center font-black text-white text-sm tracking-tight uppercase">
                                            {vKey === 'neutral' ? 'صيغة رسمية معتدلة' : vKey === 'strict' ? 'صيغة رسمية حازمة' : 'صيغة دبلوماسية مرنة'}
                                        </div>
                                        <div className="p-6 flex-grow text-white text-base leading-relaxed font-bold overflow-y-auto max-h-[450px] custom-scrollbar text-right prose prose-invert prose-sm prose-p:text-white" dangerouslySetInnerHTML={{ __html: sanitizeHTML(generatedContent.variations[vKey]) }} />
                                        <div className="p-5 bg-white/5 border-t border-white/5">
                                            <button 
                                                onClick={() => { setFinalBody(generatedContent.variations[vKey]); setStep(2); }}
                                                className={`w-full py-3.5 rounded-xl font-black text-sm text-white shadow-xl transition-all group-hover/card:scale-[1.02] ${theme.bg}`}
                                            >
                                                اعتماد وتحرير النسخة
                                            </button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-10 duration-700">
                             <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight">المراجعة النهائية والتوزيع</h3>
                                </div>
                                <div className="flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                                    <SparklesIcon className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-black text-indigo-300">مساعد التعديل التفاعلي متاح</span>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                {/* Editor Area */}
                                <div className="xl:col-span-8 shadow-3xl rounded-3xl overflow-hidden border border-white/5 h-fit">
                                    <RichTextEditor value={finalBody} onChange={setFinalBody} ringColor={theme.ring} minHeight="min-h-[650px]" />
                                </div>

                                {/* AI Interaction Chat */}
                                <div className="xl:col-span-4 flex flex-col bg-slate-900/60 rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[750px]">
                                    <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/20 rounded-lg"><BotIcon className="w-5 h-5 text-indigo-400" /></div>
                                        <div>
                                            <h4 className="text-sm font-black text-white">دردشة التعديل الذكي</h4>
                                            <p className="text-[10px] text-slate-500 font-bold">أرسل ملاحظاتك ليقوم AI بتعديل النص</p>
                                        </div>
                                    </div>

                                    {/* Chat Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-[300px]">
                                        {chatHistory.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-40">
                                                <MessageSquareIcon className="w-12 h-12 mb-4 text-slate-500" />
                                                <p className="text-xs font-bold text-slate-400 leading-relaxed">
                                                    "اجعل الخطاب أكثر إيجازاً"<br/>
                                                    "أضف فقرة تطلب موعداً للاجتماع"<br/>
                                                    "غير نبرة الخطاب لتكون أكثر ودية"
                                                </p>
                                            </div>
                                        ) : (
                                            chatHistory.map((msg, idx) => (
                                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[85%] p-3 rounded-2xl text-[12px] font-bold leading-relaxed shadow-lg ${
                                                        msg.role === 'user' 
                                                            ? 'bg-indigo-600 text-white rounded-br-none' 
                                                            : 'bg-slate-800 text-slate-200 border border-white/5 rounded-bl-none'
                                                    }`}>
                                                        {msg.text}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        {isChatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-white/5 flex items-center gap-2">
                                                    <div className="flex gap-1">
                                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Chat Input */}
                                    <form onSubmit={handleChatSubmit} className="p-4 bg-white/5 border-t border-white/10 flex items-center gap-2">
                                        <input 
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="اكتب تعليمات التعديل..."
                                            className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            disabled={isChatLoading}
                                        />
                                        <button 
                                            type="submit"
                                            disabled={!chatInput.trim() || isChatLoading}
                                            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-50 active:scale-95"
                                        >
                                            <SendIcon className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>
                             </div>
                            
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-8 border-t border-white/10 bg-slate-900/20 p-6 rounded-3xl border border-white/5">
                                <div className="w-full md:w-1/2 space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">التوزيع الداخلي (نسخة إلى)</label>
                                    <MultiSelectCombobox options={companySettings.departments} selectedItems={cc} onChange={newCC => updateState({ cc: newCC })} placeholder="اختر الإدارات..." ringColor={theme.ring} />
                                </div>
                                
                                <div className="flex-shrink-0 w-full md:w-auto">
                                    <button 
                                        onClick={handleFinalSave}
                                        className="group relative px-16 py-6 font-black text-xl flex items-center gap-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-[0_20px_60px_rgba(16,185,129,0.3)] transition-all active:scale-95 w-full justify-center"
                                    >
                                        <CheckCircleIcon className="w-8 h-8" />
                                        <span>حفظ واعتماد المعاملة</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
