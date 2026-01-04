
import React, { useMemo } from 'react';
import { Letter, CorrespondenceType, LetterStatus, CompanySettings } from '../types';
import { getThemeClasses } from './utils';
// @FIX: Imported CheckCircleIcon to resolve name error
import { CheckCircleIcon } from './icons';

interface WorkflowTrackerProps {
    letter: Letter;
    settings: CompanySettings;
}

const parseDateString = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
        const parts = dateString.split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (parts[2].length === 4) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    } catch (e) {}
    return new Date(dateString);
};

const WorkflowTracker = ({ letter, settings }: WorkflowTrackerProps): React.ReactNode => {
    const theme = getThemeClasses(settings.primaryColor);
    
    const enrichedPath = useMemo(() => {
        const stages: {
            dept: string,
            status: 'completed' | 'active' | 'rejected' | 'upcoming',
            action?: string,
            userName?: string,
            date?: string,
            duration?: string
        }[] = [];

        // نقطة البداية
        const initialDept = letter.correspondenceType === CorrespondenceType.INBOUND ? "مركز الوارد" : (letter.from || settings.defaultDepartment);
        
        // استخراج المسار من سجل الإجراءات (الإحالات)
        const pathSequence = [initialDept];
        letter.approvalHistory.forEach(h => {
            const referralMatch = h.action.match(/تمت إحالة الخطاب إلى: (.*)/);
            if (referralMatch && referralMatch[1]) {
                pathSequence.push(referralMatch[1].trim());
            }
        });

        // إذا كان هناك قسم حالي غير موجود في المسار، نضيفه
        if (!pathSequence.includes(letter.currentDepartment)) {
            pathSequence.push(letter.currentDepartment);
        }

        let previousDate = parseDateString(letter.date);

        pathSequence.forEach((dept, index) => {
            const isLast = index === pathSequence.length - 1;
            const isCurrent = dept === letter.currentDepartment;
            
            let status: 'completed' | 'active' | 'rejected' | 'upcoming' = 'upcoming';
            if (index < pathSequence.length - 1) {
                status = 'completed';
            } else if (isCurrent) {
                status = (letter.status === LetterStatus.REJECTED) ? 'rejected' : 
                         ([LetterStatus.SENT, LetterStatus.ARCHIVED, LetterStatus.REPLIED].includes(letter.status)) ? 'completed' : 'active';
            }

            // العثور على آخر إجراء في هذا القسم
            // @FIX: Replaced findLast with reverse().find() for compatibility with older build targets
            const stageAction = [...letter.approvalHistory].reverse().find(h => 
                h.action.includes(dept) || (settings.users.find(u => u.id === h.userId)?.department === dept)
            ) || (index === 0 ? letter.approvalHistory[0] : undefined);

            let durationStr = '';
            if (stageAction) {
                const stageDate = parseDateString(stageAction.date);
                if (stageDate && previousDate && status === 'completed') {
                    const diff = Math.ceil(Math.abs(stageDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
                    durationStr = diff > 0 ? `${diff} يوم` : 'أقل من يوم';
                    previousDate = stageDate;
                } else if (status === 'active' && previousDate) {
                    const diff = Math.ceil(Math.abs(new Date().getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
                    durationStr = `منذ ${diff} يوم`;
                }
            }

            stages.push({
                dept,
                status,
                action: stageAction?.action,
                userName: stageAction?.userName,
                date: stageAction?.date,
                duration: durationStr
            });
        });

        return stages;
    }, [letter, settings]);

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 mb-6">
                <span className="w-1 h-5 bg-indigo-500 rounded-full"></span>
                <h3 className="text-lg font-black text-white">تتبع مسار المعاملة</h3>
            </div>
            
            <div className="flex overflow-x-auto pb-4 no-scrollbar">
                {enrichedPath.map((stage, i) => {
                    const isCompleted = stage.status === 'completed';
                    const isActive = stage.status === 'active';
                    const isRejected = stage.status === 'rejected';

                    return (
                        <div key={i} className="flex items-start flex-shrink-0 min-w-[180px]">
                            <div className="flex flex-col items-center relative">
                                {/* الدائرة */}
                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-500 ${
                                    isCompleted ? 'bg-emerald-500 border-emerald-400 text-white' :
                                    isActive ? 'bg-indigo-600 border-indigo-400 text-white ring-4 ring-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                                    isRejected ? 'bg-rose-500 border-rose-400 text-white' :
                                    'bg-slate-800 border-slate-700 text-slate-500'
                                }`}>
                                    {isCompleted ? <CheckCircleIcon className="w-6 h-6" /> : <span className="font-bold">{i + 1}</span>}
                                </div>

                                {/* المحتوى النصي */}
                                <div className="mt-3 text-center px-2">
                                    <p className={`text-sm font-black truncate max-w-[150px] ${isActive ? 'text-indigo-400' : 'text-slate-300'}`}>
                                        {stage.dept}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1">{stage.date || '--/--'}</p>
                                    {stage.duration && (
                                        <p className={`text-[10px] font-black mt-1 px-2 py-0.5 rounded-full inline-block ${isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-400'}`}>
                                            {stage.duration}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* الخط الواصل */}
                            {i < enrichedPath.length - 1 && (
                                <div className={`h-0.5 mt-5 flex-grow min-w-[50px] ${isCompleted ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WorkflowTracker;
