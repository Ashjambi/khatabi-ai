
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { enhanceLetter } from '../services/geminiService';
import { EnhancementSuggestion } from '../types';
import { useApp } from '../App';
import { getThemeClasses } from './utils';


const LetterEnhancer = () => {
    const { state } = useApp();
    const { companySettings: settings } = state;
    const [originalText, setOriginalText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [enhancements, setEnhancements] = useState<EnhancementSuggestion[] | null>(null);
    const theme = getThemeClasses(settings.primaryColor);

    const handleAnalyze = async () => {
        if (!originalText.trim()) {
            toast.error('الرجاء إدخال نص الخطاب في الحقل المخصص.');
            return;
        }
        setIsLoading(true);
        setEnhancements(null);
        try {
            const results = await enhanceLetter(originalText);
            setEnhancements(results);
            if (results.length === 0) {
                toast.success('خطابك مكتوب بشكل ممتاز! لم يتم العثور على اقتراحات للتحسين.');
            }
        } catch (error) {
            // Error is handled in the service
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('تم نسخ النص المقترح!');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
                    <span>المقارنة والتحسين الذكي</span>
                </h2>
                <p className="text-slate-400 mt-2">أدخل مسودة خطابك، وسيقوم الذكاء الاصطناعي بمقارنتها بالصيغ المعيارية واقتراح تحسينات لجعلها أكثر احترافية وقوة.</p>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/10">
                <label htmlFor="original-letter" className="block text-lg font-semibold text-white mb-2">
                    نص الخطاب الأصلي
                </label>
                <textarea
                    id="original-letter"
                    rows={12}
                    value={originalText}
                    onChange={(e) => {
                        setOriginalText(e.target.value);
                        if (enhancements) setEnhancements(null);
                    }}
                    className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${theme.ring} sm:text-sm leading-relaxed`}
                    placeholder="الصق هنا مسودة الخطاب الذي ترغب في تحسينه..."
                ></textarea>
                <div className="mt-4 text-center">
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !originalText.trim()}
                        className={`w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-white ${theme.bg} rounded-md ${theme.hoverBg} transition-all focus:outline-none focus:ring-2 ${theme.ring} focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <span>تحليل</span>
                        )}
                        <span>{isLoading ? 'جاري التحليل...' : 'قارن وحسّن الخطاب'}</span>
                    </button>
                </div>
            </div>

            {isLoading && (
                 <div className="text-center text-slate-500 py-10">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${theme.text} mx-auto mb-4`}></div>
                    <p>يقوم الخبير اللغوي بتحليل النص...</p>
                </div>
            )}
            
            {enhancements && enhancements.length > 0 && (
                <div className="space-y-6">
                     <h3 className="text-2xl font-bold text-white">نتائج التحليل والتحسينات المقترحة</h3>
                     {enhancements.map((item, index) => (
                         <div key={index} className="bg-slate-900/60 backdrop-blur-md rounded-lg shadow-lg border border-white/10 overflow-hidden">
                             <div className="p-4 bg-white/5 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                     <h4 className="font-semibold text-slate-200">سبب التحسين:</h4>
                                </div>
                                <p className="text-slate-400 mt-1 pr-8">{item.reason}</p>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
                                 <div className="bg-rose-900/10 p-4">
                                     <h5 className="font-bold text-rose-400 mb-2">النص الأصلي</h5>
                                     <p className="text-rose-200/80 leading-relaxed">{item.original_part}</p>

                                 </div>
                                 <div className="bg-emerald-900/10 p-4">
                                     <div className="flex justify-between items-center mb-2">
                                        <h5 className="font-bold text-emerald-400">النص المقترح</h5>
                                        <button onClick={() => handleCopy(item.suggested_improvement)} className={`text-slate-400 hover:${theme.text} transition-colors`} title="نسخ النص المقترح">
                                            نسخ
                                        </button>
                                     </div>
                                     <p className="text-emerald-200 leading-relaxed">{item.suggested_improvement}</p>
                                 </div>
                             </div>
                         </div>
                     ))}
                </div>
            )}
            
            {enhancements && enhancements.length === 0 && !isLoading && (
                 <div className="text-center text-emerald-400 bg-emerald-900/20 p-8 rounded-lg border border-emerald-500/30">
                    <h3 className="text-xl font-bold">خطاب مثالي!</h3>
                    <p className="mt-2 text-emerald-200/70">لم يجد مساعدنا الذكي أي نقاط ضعف جوهرية. عمل رائع!</p>
                </div>
            )}

        </div>
    );
};

export default LetterEnhancer;
