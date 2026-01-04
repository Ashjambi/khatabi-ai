
import React, { useState, useMemo } from 'react';
import { getFollowUpSummary } from '../services/geminiService';
import { toast } from 'react-hot-toast';
import { useApp } from '../App';
import { getThemeClasses, getVisibleLetters } from './utils';

type FollowUpItem = {
    summary: string;
    letterId: string;
};

export default function FollowUpAssistant() {
    const { state, dispatch } = useApp();
    const { letters: allLetters, companySettings: settings, currentUser } = state;
    const visibleLetters = useMemo(() => getVisibleLetters(allLetters, currentUser), [allLetters, currentUser]);

    const [isLoading, setIsLoading] = useState(false);
    const [followUps, setFollowUps] = useState<FollowUpItem[] | null>(null);
    const theme = getThemeClasses(settings.primaryColor);

    const onSelectLetter = (id: string) => {
        dispatch({ type: 'SELECT_LETTER', payload: id });
    };

    const handleAnalyze = async () => {
        setIsLoading(true);
        setFollowUps(null);
        try {
            const results = await getFollowUpSummary(visibleLetters);
            setFollowUps(results);
            if (results.length === 0) {
                toast.success("كل شيء على ما يرام! لا توجد معاملات معلقة.");
            }
        } catch (error) {
            // Error is handled in the service
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className='flex items-center gap-4'>
                    <div>
                        <h2 className="text-xl font-black text-white">مساعد المتابعة الآلي</h2>
                        <p className="text-sm font-semibold text-slate-400">يقوم الذكاء الاصطناعي بتحليل الخطابات وتنبيهك بما يحتاج إلى متابعة.</p>
                    </div>
                </div>
                 <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white ${theme.bg} rounded-md ${theme.hoverBg} transition-colors focus:outline-none focus:ring-2 ${theme.ring} focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
                >
                    {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : null}
                    <span>{isLoading ? 'جاري التحليل...' : 'تحليل وتحديث'}</span>
                </button>
            </div>

            <div className="bg-white/5 p-4 rounded-xl min-h-[10rem] flex flex-col border border-white/5">
                {isLoading && (
                     <div className="m-auto text-center text-slate-400">
                        <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${theme.border} mx-auto mb-2`}></div>
                        <p className="font-bold">جاري تحليل المراسلات...</p>
                    </div>
                )}

                {!isLoading && followUps === null && (
                     <div className="m-auto text-center text-slate-400">
                        <p className="font-bold">اضغط على زر "تحليل وتحديث" لبدء المراجعة الآلية.</p>
                    </div>
                )}
                
                {!isLoading && followUps && followUps.length === 0 && (
                    <div className="m-auto text-center text-emerald-400">
                        <p className="font-bold">لا توجد عناصر تتطلب المتابعة حاليًا.</p>
                    </div>
                )}
                
                {!isLoading && followUps && followUps.length > 0 && (
                    <ul className="space-y-3">
                        {followUps.map((item) => (
                            <li key={item.letterId}>
                                <button onClick={() => onSelectLetter(item.letterId)} className={`w-full text-right p-3 bg-white/5 rounded-lg border border-white/10 ${theme.hoverLightBg} hover:${theme.border} transition-all duration-200 flex items-center gap-3 shadow-lg group`}>
                                   <span className="text-sm text-slate-200 group-hover:text-white font-bold">{item.summary}</span>
                                   <span className={`mr-auto text-xs ${theme.text} font-bold`}>التفاصيل</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
