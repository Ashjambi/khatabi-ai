
import React, { useMemo } from 'react';
import { useApp } from '../App';
import FollowUpAssistant from './FollowUpAssistant';
import MyTasks from './MyTasks';
import { getVisibleLetters } from './utils';
import { LetterStatus, CorrespondenceType } from '../types';

export default function Dashboard() {
    const { state, dispatch } = useApp();
    const { letters: allLetters, companySettings, currentUser } = state;
    const visibleLetters = useMemo(() => getVisibleLetters(allLetters, currentUser), [allLetters, currentUser]);

    const handleSelectLetter = (id: string) => {
      dispatch({ type: 'SELECT_LETTER', payload: id });
    };

    // Quick Stats Calculation
    const stats = useMemo(() => {
        return {
            inbound: visibleLetters.filter(l => l.correspondenceType === CorrespondenceType.INBOUND).length,
            outbound: visibleLetters.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND).length,
            pending: visibleLetters.filter(l => [LetterStatus.RECEIVED, LetterStatus.AWAITING_REPLY, LetterStatus.PENDING_REVIEW].includes(l.status)).length,
            total: visibleLetters.length
        };
    }, [visibleLetters]);

    if (!currentUser) {
        return <div className="text-center p-8">Loading...</div>;
    }

    // Updated StatWidget: Monochromatic, Engraved Glass Look
    const StatWidget = ({ label, value }: { label: string, value: number }) => (
        <div className="group relative overflow-hidden rounded-2xl bg-slate-950/30 border border-white/5 p-6 flex flex-col justify-center items-start shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-all duration-300 hover:bg-slate-900/50 hover:border-white/10 hover:shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)]">
            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none"></div>
            
            <p className="relative z-10 text-slate-500 group-hover:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 transition-colors">
                {label}
            </p>
            <p className="relative z-10 text-4xl font-black text-white/90 group-hover:text-white transition-colors tracking-tight">
                {value}
            </p>
        </div>
    );

    return (
        <div className="space-y-8 pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">مركز القيادة</h1>
                    <p className="text-slate-400 font-medium mt-1">نظرة شاملة على تدفق المعاملات وحالة العمليات.</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                        {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* Quick Stats Row - Clean & Engraved Look */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatWidget label="إجمالي المعاملات" value={stats.total} />
                <StatWidget label="الوارد" value={stats.inbound} />
                <StatWidget label="الصادر" value={stats.outbound} />
                <StatWidget label="قيد الإجراء" value={stats.pending} />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                {/* Main Activity Feed (Takes up 2/3 space on large screens) */}
                <div className="xl:col-span-2 space-y-6">
                    <MyTasks 
                        letters={visibleLetters}
                        onSelectLetter={handleSelectLetter}
                        settings={companySettings}
                        currentUser={currentUser}
                        allLetters={allLetters} // Pass all letters for linkage check
                    />
                </div>

                {/* Sidebar Assistant (Takes up 1/3 space) */}
                <div className="xl:col-span-1">
                    <FollowUpAssistant />
                </div>
            </div>
        </div>
    );
}
