
import React from 'react';
import { EnhancementSuggestion } from '../types';

interface ProofreadModalProps {
    suggestions: EnhancementSuggestion[];
    onClose: () => void;
    onApplyAll: (suggestions: EnhancementSuggestion[]) => void;
    onApplyOne: (suggestion: EnhancementSuggestion) => void;
}

const ProofreadModal: React.FC<ProofreadModalProps> = ({ suggestions, onClose, onApplyAll, onApplyOne }) => {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-slate-900 rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] border border-white/10"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                    <h3 className="text-xl font-bold text-white">التدقيق اللغوي والتحسينات المقترحة</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white font-bold">
                        X
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {suggestions.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <span className="text-4xl text-emerald-500">✓</span>
                            <p className="text-lg font-bold mt-2">النص ممتاز! لا توجد أخطاء.</p>
                        </div>
                    ) : (
                        suggestions.map((suggestion, index) => (
                            <div key={index} className="bg-white/5 p-4 rounded-lg border border-white/5 shadow-sm">
                                <div className="flex items-start gap-3 text-amber-400 mb-3">
                                    <span className="text-lg">💡</span>
                                    <p className="text-sm font-semibold">{suggestion.reason}</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <p className="text-sm text-rose-300 bg-rose-900/20 p-2 rounded-md flex-1 border border-rose-500/20">
                                            <span className="font-bold block mb-1 text-rose-400">الأصلي: </span>
                                            <span className="line-through decoration-rose-500 decoration-2 opacity-70">{suggestion.original_part}</span>
                                        </p>
                                        <p className="text-sm text-emerald-300 bg-emerald-900/20 p-2 rounded-md flex-1 border border-emerald-500/20">
                                            <span className="font-bold block mb-1 text-emerald-400">المقترح: </span>
                                            {suggestion.suggested_improvement}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-left mt-3">
                                    <button onClick={() => onApplyOne(suggestion)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-900/30 rounded-md hover:bg-emerald-900/50 transition-colors border border-emerald-500/30">
                                        تطبيق هذا التعديل
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {suggestions.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-white/10 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="btn-3d-secondary px-6 py-2"
                        >
                            إغلاق
                        </button>
                        <button
                            onClick={() => onApplyAll(suggestions)}
                            className="btn-3d bg-indigo-600 px-6 py-2 text-white"
                        >
                            تطبيق كل التعديلات
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProofreadModal;
