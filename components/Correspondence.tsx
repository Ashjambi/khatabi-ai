
import React, { useState, useMemo } from 'react';
import { Letter, CorrespondenceType, LetterStatus, PriorityLevel } from '../types';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip } from './utils';
import LetterDetails from './LetterDetails';
import { SearchIcon, InboxInIcon, SendIcon, FileTextIcon, LinkIcon, FilterIcon } from './icons';

// Utility to group letters by date labels (Today, Yesterday, etc.)
const groupLettersByDate = (letters: Letter[]) => {
    const groups: { [key: string]: Letter[] } = {
        'اليوم': [],
        'أمس': [],
        'هذا الأسبوع': [],
        'الشهر الحالي': [],
        'أقدم': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    letters.forEach(letter => {
        try {
            // Parse date "YYYY/MM/DD" or similar
            const parts = letter.date.split(/[\/\-]/);
            let dateObj: Date;
            
            // Handle YYYY/MM/DD or DD/MM/YYYY
            if (parts[0].length === 4) {
                 dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
                 dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }

            if (isNaN(dateObj.getTime())) {
                groups['أقدم'].push(letter);
                return;
            }

            if (dateObj.getTime() === today.getTime()) {
                groups['اليوم'].push(letter);
            } else if (dateObj.getTime() === yesterday.getTime()) {
                groups['أمس'].push(letter);
            } else if (dateObj > lastWeek) {
                groups['هذا الأسبوع'].push(letter);
            } else if (dateObj >= startOfMonth) {
                groups['الشهر الحالي'].push(letter);
            } else {
                groups['أقدم'].push(letter);
            }
        } catch (e) {
            groups['أقدم'].push(letter);
        }
    });

    return groups;
};

export default function Correspondence() {
    const { state, dispatch } = useApp();
    const { letters: allLetters, companySettings, currentUser } = state;
    const theme = getThemeClasses(companySettings.primaryColor);

    const [activeFilter, setActiveFilter] = useState<'all' | 'inbound' | 'outbound' | 'drafts'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLetterIdLocal, setSelectedLetterIdLocal] = useState<string | null>(null);

    // 1. Filter Logic
    const filteredLetters = useMemo(() => {
        let result = allLetters;

        // Permission Filter (Optional based on role)
        // if (currentUser) { ... }

        // Tab Filter
        if (activeFilter === 'inbound') {
            result = result.filter(l => l.correspondenceType === CorrespondenceType.INBOUND);
        } else if (activeFilter === 'outbound') {
            result = result.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND);
        } else if (activeFilter === 'drafts') {
            result = result.filter(l => l.status === LetterStatus.DRAFT || l.status === LetterStatus.PENDING_REVIEW);
        } else {
            // "All" - exclude archived to keep it clean, or keep everything? 
            // Let's exclude Archived in "Active" view usually, but for now we keep active workflow items
            result = result.filter(l => l.status !== LetterStatus.ARCHIVED);
        }

        // Search Filter
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(l => 
                l.subject.toLowerCase().includes(lower) || 
                (l.internalRefNumber || '').toLowerCase().includes(lower) ||
                (l.externalRefNumber || '').toLowerCase().includes(lower) ||
                l.from.toLowerCase().includes(lower) ||
                l.to.toLowerCase().includes(lower)
            );
        }

        // Sort by Date Descending
        return result.sort((a, b) => {
             // Simple string compare for YYYY/MM/DD works, but safer to parse
             return new Date(b.date.replace(/\//g, '-')).getTime() - new Date(a.date.replace(/\//g, '-')).getTime();
        });
    }, [allLetters, activeFilter, searchTerm]);

    // 2. Grouping
    const groupedLetters = useMemo(() => groupLettersByDate(filteredLetters), [filteredLetters]);

    // Select first letter automatically if none selected (Desktop only)
    // useEffect(() => {
    //     if (!selectedLetterIdLocal && filteredLetters.length > 0 && window.innerWidth >= 1024) {
    //         setSelectedLetterIdLocal(filteredLetters[0].id);
    //     }
    // }, [filteredLetters]);

    const selectedLetter = allLetters.find(l => l.id === selectedLetterIdLocal);

    // Helpers
    const isThread = (letter: Letter) => letter.referenceId || allLetters.some(l => l.referenceId === letter.id);

    return (
        <div className="flex h-[calc(100vh-8rem)] overflow-hidden gap-6">
            
            {/* --- LIST PANE (Navigation) --- */}
            <div className={`flex-col w-full lg:w-[400px] xl:w-[450px] shrink-0 gap-4 transition-all duration-300 ${selectedLetter ? 'hidden lg:flex' : 'flex'}`}>
                
                {/* Header & Controls */}
                <div className="flex flex-col gap-4 px-1">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-black text-white tracking-tight">المراسلات</h1>
                        <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-slate-300 border border-white/5">
                            {filteredLetters.length} خطاب
                        </span>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="بحث سريع (موضوع، رقم، جهة)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full py-3 pr-10 pl-4 text-sm text-white bg-slate-900/60 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold placeholder-slate-500 transition-all shadow-sm"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-slate-900/40 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'الكل' },
                            { id: 'inbound', label: 'وارد' },
                            { id: 'outbound', label: 'صادر' },
                            { id: 'drafts', label: 'مسودات' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id as any)}
                                className={`flex-1 min-w-[70px] py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                    activeFilter === tab.id 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* The List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-6 pb-4">
                    {filteredLetters.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-500 opacity-60">
                            <FilterIcon className="w-12 h-12 mb-3" />
                            <p className="font-bold">لا توجد نتائج</p>
                        </div>
                    ) : (
                        Object.entries(groupedLetters).map(([groupName, letters]) => {
                            const groupLetters = letters as Letter[];
                            if (groupLetters.length === 0) return null;
                            return (
                                <div key={groupName} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 px-2 sticky top-0 bg-[#020617] py-2 z-10 opacity-90 backdrop-blur">
                                        {groupName}
                                    </h3>
                                    <div className="space-y-2">
                                        {groupLetters.map(letter => {
                                            const isSelected = selectedLetterIdLocal === letter.id;
                                            const isInbound = letter.correspondenceType === CorrespondenceType.INBOUND;
                                            const hasThread = isThread(letter);

                                            return (
                                                <div 
                                                    key={letter.id} 
                                                    onClick={() => setSelectedLetterIdLocal(letter.id)}
                                                    className={`
                                                        group relative p-4 rounded-xl border cursor-pointer transition-all duration-200 select-none
                                                        ${isSelected 
                                                            ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]' 
                                                            : 'bg-slate-900/40 border-white/5 hover:bg-white/5 hover:border-white/10 hover:shadow-md'
                                                        }
                                                    `}
                                                >
                                                    {/* Selection Indicator Bar */}
                                                    {isSelected && <div className="absolute right-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-l-full"></div>}
                                                    
                                                    {/* Header: Icon + Type + Date */}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded-lg ${isInbound ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                                {isInbound ? <InboxInIcon className="w-4 h-4" /> : <SendIcon className="w-4 h-4" />}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-400 truncate max-w-[150px]">
                                                                {isInbound ? letter.from : letter.to}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-black/20 px-2 py-0.5 rounded">
                                                            {letter.date}
                                                        </span>
                                                    </div>

                                                    {/* Subject */}
                                                    <h4 className={`text-sm font-bold leading-snug mb-3 line-clamp-2 ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                                                        {letter.subject}
                                                    </h4>

                                                    {/* Footer: Ref & Status */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-mono text-slate-500 tracking-wider">
                                                                {letter.internalRefNumber || '---'}
                                                            </span>
                                                            {hasThread && (
                                                                <div className="flex items-center gap-0.5 text-slate-500 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                                                                    <LinkIcon className="w-3 h-3" />
                                                                    <span className="font-bold">مرتبط</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="scale-90 origin-left">
                                                            {getStatusChip(letter.status)}
                                                        </div>
                                                    </div>

                                                    {/* Urgent Priority Glow */}
                                                    {letter.priority === PriorityLevel.URGENT && (
                                                        <div className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- DETAIL PANE (Workspace) --- */}
            <div className={`flex-1 h-full glass-card border border-white/10 shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 ${!selectedLetter ? 'hidden lg:flex' : 'w-full'}`}>
                
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

                {selectedLetter ? (
                    <div className="flex flex-col h-full">
                        {/* Mobile Header (Back Button) */}
                        <div className="lg:hidden p-3 border-b border-white/10 bg-slate-900/50 backdrop-blur flex items-center gap-2">
                            <button 
                                onClick={() => setSelectedLetterIdLocal(null)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
                            >
                                ← العودة للقائمة
                            </button>
                        </div>

                        {/* Letter Details Component */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <LetterDetails letter={selectedLetter} />
                        </div>
                    </div>
                ) : (
                    /* Empty State */
                    <div className="h-full flex flex-col items-center justify-center p-10 text-center opacity-60">
                        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                            <FileTextIcon className="w-10 h-10 text-slate-600" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">مركز المراسلات</h2>
                        <p className="text-slate-400 font-medium max-w-sm leading-relaxed">
                            اختر معاملة من القائمة لعرض التفاصيل، الرد، أو اتخاذ الإجراءات اللازمة.
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}
