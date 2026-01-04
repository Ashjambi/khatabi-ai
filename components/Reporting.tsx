
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../App';
import { Letter, LetterStatus, CorrespondenceType, UserRole } from '../types';
import { getThemeClasses } from './utils';

const FINAL_STATUSES = [LetterStatus.ARCHIVED, LetterStatus.REPLIED, LetterStatus.SENT];

const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
        const parts = dateString.split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (parts[2].length === 4) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    } catch (e) { /* ignore */ }
    return null;
};

const StatCard = ({ title, value, theme }: { title: string; value: string | number; theme: ReturnType<typeof getThemeClasses> }) => (
    <div className="bg-slate-900/40 p-4 rounded-lg shadow-sm border border-white/10">
        <p className="text-sm font-bold text-slate-400">{title}</p>
        <p className={`text-2xl font-black ${theme.text}`}>{value}</p>
    </div>
);

export default function Reporting() {
    const { state, dispatch } = useApp();
    const { letters: allLetters, companySettings, currentUser } = state;
    const theme = getThemeClasses(companySettings.primaryColor);
    const printableAreaRef = useRef<HTMLDivElement>(null);

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        subject: '',
        status: 'all',
        type: 'all',
        department: 'all',
    });
    const [reportGenerated, setReportGenerated] = useState(false);

    const visibleLetters = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === UserRole.ADMIN) return allLetters;
        return allLetters.filter(letter =>
            letter.currentDepartment === currentUser.department ||
            letter.creatorId === currentUser.id ||
            (letter.cc || []).includes(currentUser.department)
        );
    }, [allLetters, currentUser]);

    const filteredLetters = useMemo(() => {
        return visibleLetters.filter(letter => {
            const letterDate = parseDate(letter.date);
            if (!letterDate) return false;

            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            const endDate = filters.endDate ? new Date(filters.endDate) : null;

            if (startDate && letterDate < startDate) return false;
            if (endDate && letterDate > endDate) return false;
            if (filters.subject && !letter.subject.toLowerCase().includes(filters.subject.toLowerCase())) return false;
            if (filters.status !== 'all' && letter.status !== filters.status) return false;
            if (filters.type !== 'all' && letter.correspondenceType.toLowerCase() !== filters.type) return false;
            if (filters.department !== 'all' && letter.currentDepartment !== filters.department) return false;
            
            return true;
        });
    }, [visibleLetters, filters]);

    const reportData = useMemo(() => {
        return filteredLetters.map(letter => {
            let completionDate = null;
            let daysToComplete: number | null = null;
            const creationDate = parseDate(letter.date);

            if (FINAL_STATUSES.includes(letter.status)) {
                const finalAction = letter.approvalHistory.find(h => FINAL_STATUSES.some(s => h.action.includes(s)));
                completionDate = finalAction ? parseDate(finalAction.date) : null;
            }

            if (creationDate && completionDate) {
                const diffTime = Math.abs(completionDate.getTime() - creationDate.getTime());
                daysToComplete = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            return {
                ...letter,
                completionDate: completionDate?.toLocaleDateString('ar-SA') || 'N/A',
                daysToComplete: daysToComplete !== null ? daysToComplete : 'N/A'
            };
        });
    }, [filteredLetters]);

    const kpis = useMemo(() => {
        const total = reportData.length;
        const inbound = reportData.filter(l => l.correspondenceType === CorrespondenceType.INBOUND).length;
        const outbound = total - inbound;
        const completed = reportData.filter(l => FINAL_STATUSES.includes(l.status)).length;
        const pending = total - completed;

        const completableLetters = reportData.filter(l => typeof l.daysToComplete === 'number');
        const avgCompletion = completableLetters.length > 0
            ? (completableLetters.reduce((sum, l) => sum + (l.daysToComplete as number), 0) / completableLetters.length).toFixed(1)
            : 'N/A';

        return { total, inbound, outbound, completed, pending, avgCompletion };
    }, [reportData]);


    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleGenerateReport = () => {
        setReportGenerated(true);
    };
    
    const handleReset = () => {
        setFilters({ startDate: '', endDate: '', subject: '', status: 'all', type: 'all', department: 'all' });
        setReportGenerated(false);
    };

    const handlePrint = () => {
        if (!printableAreaRef.current) return;
        const printableElement = printableAreaRef.current;
        
        printableElement.classList.add('printable-area');
        document.body.classList.add('is-printing');
        
        window.print();
        
        printableElement.classList.remove('printable-area');
        document.body.classList.remove('is-printing');
    };
    
    const handleExportCSV = () => {
        const headers = ['الرقم المرجعي', 'الموضوع', 'النوع', 'القسم الحالي', 'الحالة', 'تاريخ الإنشاء', 'تاريخ الإنجاز', 'أيام للإنجاز'];
        const csvRows = [headers.join(',')];

        reportData.forEach(row => {
            const values = [
                row.internalRefNumber,
                `"${row.subject.replace(/"/g, '""')}"`,
                row.correspondenceType,
                row.currentDepartment,
                row.status,
                row.date,
                row.completionDate,
                row.daysToComplete
            ];
            csvRows.push(values.join(','));
        });

        const csvString = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `report-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 no-print">
                <h1 className="text-3xl font-black text-white">نظام التقارير المتقدمة</h1>
            </div>
            <p className="text-slate-400 font-bold no-print">أنشئ تقارير مخصصة للمراسلات بناءً على فلاتر متعددة، ثم قم بطباعتها أو تصديرها.</p>

            <div className="glass-card p-6 no-print">
                <h3 className="text-lg font-bold text-white mb-4">فلاتر التقرير</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="input-inset p-2 font-bold" />
                    <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="input-inset p-2 font-bold" />
                    <input type="text" name="subject" value={filters.subject} onChange={handleFilterChange} placeholder="بحث في الموضوع..." className="input-inset p-2 font-bold" />
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="input-inset p-2 font-bold">
                        <option value="all">كل الحالات</option>
                        {Object.values(LetterStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select name="type" value={filters.type} onChange={handleFilterChange} className="input-inset p-2 font-bold">
                        <option value="all">كل الأنواع</option>
                        <option value="inbound">وارد</option>
                        <option value="outbound">صادر</option>
                    </select>
                    <select name="department" value={filters.department} onChange={handleFilterChange} className="input-inset p-2 font-bold">
                        <option value="all">كل الأقسام</option>
                        {companySettings.departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                    <button onClick={handleReset} className={`btn-3d-secondary px-4 py-2 font-bold`}>إعادة تعيين</button>
                    <button onClick={handleGenerateReport} className={`btn-3d text-white px-6 py-2 font-bold ${theme.bg}`}>إنشاء التقرير</button>
                </div>
            </div>

            {reportGenerated && (
                <>
                    <div className="flex justify-end gap-3 no-print">
                        <button onClick={handlePrint} className="inline-flex items-center gap-2 btn-3d-secondary px-4 py-2 font-bold">
                            طباعة
                        </button>
                        <button onClick={handleExportCSV} className="inline-flex items-center gap-2 btn-3d-secondary px-4 py-2 font-bold">
                            تصدير CSV
                        </button>
                    </div>

                    <div id="report-printable-area" ref={printableAreaRef} className="printable-report-container">
                        {/* We use standard colors for printability, but override for screen display */}
                        <div className="p-6 bg-slate-900/60 backdrop-blur-md rounded-lg border border-white/10 print:bg-white print:text-black">
                            <header className="flex justify-between items-start pb-4 mb-6 border-b-2 border-slate-600">
                                <div>
                                    <h2 className="text-2xl font-black text-white print:text-black">{companySettings.companyName}</h2>
                                    <p className="text-slate-400 print:text-slate-600 font-bold">تقرير المراسلات</p>
                                </div>
                                <p className="text-sm font-semibold text-slate-500">تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
                            </header>

                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-white print:text-slate-700 mb-4">ملخص التقرير</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <StatCard title="إجمالي المعاملات" value={kpis.total} theme={theme} />
                                    <StatCard title="صادر" value={kpis.outbound} theme={theme} />
                                    <StatCard title="وارد" value={kpis.inbound} theme={theme} />
                                    <StatCard title="مكتمل" value={kpis.completed} theme={theme} />
                                    <StatCard title="قيد الإجراء" value={kpis.pending} theme={theme} />
                                    <StatCard title="متوسط الإنجاز (يوم)" value={kpis.avgCompletion} theme={theme} />
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-xl font-bold text-white print:text-slate-700 mb-4">البيانات التفصيلية</h3>
                                <div className="border border-white/10 print:border-slate-200 rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-white/5 print:bg-slate-100">
                                                <tr>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">الرقم</th>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">الموضوع</th>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">النوع</th>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">القسم</th>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">الحالة</th>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">تاريخ الإنشاء</th>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">تاريخ الإنجاز</th>
                                                    <th className="p-3 text-right font-bold text-slate-300 print:text-slate-600">الأيام</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10 print:divide-slate-200">
                                                {reportData.map(letter => (
                                                    <tr key={letter.id} className="text-white print:text-black">
                                                        <td className="p-3 font-semibold">{letter.internalRefNumber}</td>
                                                        <td className="p-3 font-semibold">{letter.subject}</td>
                                                        <td className="p-3 font-semibold">{letter.correspondenceType}</td>
                                                        <td className="p-3 font-semibold">{letter.currentDepartment}</td>
                                                        <td className="p-3 font-semibold">{letter.status}</td>
                                                        <td className="p-3 font-semibold">{letter.date}</td>
                                                        <td className="p-3 font-semibold">{letter.completionDate}</td>
                                                        <td className="p-3 font-semibold">{letter.daysToComplete}</td>
                                                    </tr>
                                                ))}
                                                {reportData.length === 0 && (
                                                     <tr><td colSpan={8} className="p-4 text-center font-bold text-slate-500">لا توجد بيانات تطابق الفلاتر المحددة.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
