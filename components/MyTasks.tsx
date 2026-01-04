
import React, { useMemo, useState } from 'react';
import { Letter, LetterStatus, CompanySettings, User, CorrespondenceType, PriorityLevel } from '../types';
import { getThemeClasses, getStatusChip, getPriorityChip } from './utils';

interface MyTasksProps {
    letters: Letter[];
    allLetters?: Letter[]; // Needed to find children/parents
    onSelectLetter: (id: string) => void;
    settings: CompanySettings;
    currentUser: User;
}

export default function MyTasks({ letters, allLetters = [], onSelectLetter, settings, currentUser }: MyTasksProps) {
    const theme = getThemeClasses(settings.primaryColor);
    const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound' | 'pending'>('all');

    // Filter Logic
    const filteredLetters = useMemo(() => {
        let result = letters;
        
        // 1. Sort by date desc
        result = [...result].sort((a, b) => {
             const dateA = new Date(a.date.split('/').reverse().join('-')).getTime();
             const dateB = new Date(b.date.split('/').reverse().join('-')).getTime();
             return isNaN(dateA) || isNaN(dateB) ? 0 : dateB - dateA;
        });

        // 2. Apply Filter
        if (filter === 'inbound') return result.filter(l => l.correspondenceType === CorrespondenceType.INBOUND);
        if (filter === 'outbound') return result.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND);
        if (filter === 'pending') return result.filter(l => [LetterStatus.RECEIVED, LetterStatus.AWAITING_REPLY, LetterStatus.PENDING_REVIEW, LetterStatus.PENDING_AUDIT].includes(l.status));

        return result.slice(0, 20); // Show recent 20 for 'all'
    }, [letters, filter]);

    // Helper to find related letters
    const getRelationInfo = (letter: Letter) => {
        const parent = letter.referenceId ? allLetters.find(l => l.id === letter.referenceId) : null;
        const children = allLetters.filter(l => l.referenceId === letter.id);
        const hasThread = parent || children.length > 0;
        
        return { parent, children, hasThread };
    };

    const TabButton = ({ id, label }: { id: string, label: string }) => (
        <button
            onClick={() => setFilter(id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 border ${
                filter === id 
                ? `bg-white/10 text-white border-white/20 shadow-inner` 
                : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="glass-card flex flex-col h-full min-h-[500px]">
            {/* Header & Tabs - No Icons */}
            <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-black text-white">
                    سجل المعاملات النشطة
                </h2>
                <div className="flex bg-slate-950/30 p-1 rounded-xl">
                    <TabButton id="all" label="الكل" />
                    <TabButton id="inbound" label="الوارد" />
                    <TabButton id="outbound" label="الصادر" />
                    <TabButton id="pending" label="إجراء" />
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {filteredLetters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <p className="font-bold">لا توجد معاملات تطابق الفلتر الحالي.</p>
                    </div>
                ) : (
                    filteredLetters.map((letter) => {
                        const { hasThread, children, parent } = getRelationInfo(letter);
                        const isInbound = letter.correspondenceType === CorrespondenceType.INBOUND;
                        
                        return (
                            <div 
                                key={letter.id}
                                onClick={() => onSelectLetter(letter.id)}
                                className={`group relative bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 hover:border-indigo-500/30 rounded-xl p-4 transition-all duration-200 cursor-pointer overflow-hidden shadow-sm hover:shadow-md`}
                            >
                                {/* Status Stripe */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isInbound ? 'bg-fuchsia-500' : 'bg-indigo-500'} opacity-50 group-hover:opacity-100 transition-opacity`}></div>

                                <div className="flex flex-col gap-2 pl-2">
                                    {/* Top Row: Subject + Date */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                                                {letter.subject}
                                            </h3>
                                            {/* Thread Indicator - Text Badge */}
                                            {hasThread && (
                                                <span className="flex-shrink-0 bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] border border-white/10 font-bold" title="مرتبط بمعاملات أخرى">
                                                    مرتبط
                                                    {children.length > 0 ? <span className="mr-1 opacity-70">({children.length})</span> : null}
                                                </span>
                                            )}
                                        </div>
                                        <span className="flex-shrink-0 text-[10px] font-mono text-slate-500">{letter.date}</span>
                                    </div>

                                    {/* Middle Row: Details */}
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold">
                                            <span className="flex items-center gap-1.5">
                                                <span className={`text-[10px] font-bold ${isInbound ? 'text-fuchsia-400' : 'text-indigo-400'}`}>
                                                    {isInbound ? 'وارد من:' : 'صادر إلى:'}
                                                </span>
                                                <span className="text-slate-300">{isInbound ? letter.from : letter.to}</span>
                                            </span>
                                            {letter.internalRefNumber && (
                                                <span className="bg-white/5 px-2 py-0.5 rounded text-slate-500 font-mono hidden sm:inline-block border border-white/5">
                                                    #{letter.internalRefNumber}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Badges */}
                                        <div className="flex gap-2">
                                            {letter.priority === PriorityLevel.URGENT && getPriorityChip(letter.priority)}
                                            {getStatusChip(letter.status)}
                                        </div>
                                    </div>
                                    
                                    {/* Bottom Row: Linkage Text Context */}
                                    {hasThread && (
                                        <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                                            {parent && (
                                                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <span className="text-indigo-400 font-bold">رد على:</span>
                                                    <span className="text-slate-400 hover:text-white truncate max-w-[200px]">{parent.subject}</span>
                                                </p>
                                            )}
                                            {children.length > 0 && (
                                                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <span className="text-emerald-400 font-bold">الردود:</span>
                                                    <span className="text-slate-400 hover:text-white truncate max-w-[200px]">{children[0].subject}</span>
                                                    {children.length > 1 && <span className="text-slate-600">+{children.length - 1}</span>}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
