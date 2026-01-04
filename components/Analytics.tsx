
import React, { useMemo, useState } from 'react';
import { Letter, CorrespondenceType, LetterStatus, CompanySettings } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid, LineChart, Line, Sector } from 'recharts';
import { getThemeClasses } from './utils';

// Props interface
interface AnalyticsProps {
    allLetters: Letter[];
    settings: CompanySettings;
}

// Custom Tooltip for Recharts - Dark Mode Optimized
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-md p-3 rounded-lg shadow-2xl border border-white/10 text-right">
                <p className="font-bold text-slate-200 mb-2 border-b border-white/10 pb-1">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.fill || pld.stroke }} className="text-sm font-bold flex items-center justify-end gap-2 mb-1 last:mb-0">
                        <span>{pld.value.toLocaleString()}</span>
                        <span>: {pld.name}</span>
                        <span className="w-2 h-2 rounded-full" style={{backgroundColor: pld.fill || pld.stroke}}></span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// A reusable card for individual stats (KPIs) - Dark Mode Optimized
const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    color: string;
    onClick?: () => void;
    isActive?: boolean;
    theme: ReturnType<typeof getThemeClasses>;
}> = ({ title, value, color, onClick, isActive = false, theme }) => {
    const commonClasses = "w-full text-right glass-card p-6 flex flex-col justify-center items-start gap-1 transition-all duration-300 focus:outline-none min-h-[120px] border border-white/5";
    const interactiveClasses = `hover:bg-slate-800/60 hover:border-white/10 ${isActive ? `ring-1 ring-white/20 bg-slate-800/80` : 'bg-slate-950/30'}`;

    const content = (
        <>
            <p className="text-slate-400 text-sm font-bold tracking-wide uppercase">{title}</p>
            <p className="text-3xl font-black text-white tracking-tight mt-1">{value}</p>
            <div className={`h-1.5 w-12 rounded-full mt-4 ${color} shadow-[0_0_10px_rgba(255,255,255,0.1)]`}></div>
        </>
    );

    if (onClick) {
        return (
            <button
                onClick={onClick}
                className={`${commonClasses} ${interactiveClasses} rounded-2xl`}
            >
                {content}
            </button>
        );
    }

    return (
        <div className={`${commonClasses} bg-slate-950/30 rounded-2xl`}>
            {content}
        </div>
    );
};

// A reusable wrapper for charts - Dark Mode Optimized
const AnalyticsCard: React.FC<{ title: string; children: React.ReactNode; height?: string }> = ({ title, children, height = 'h-96' }) => (
    <div className="glass-card p-6 bg-slate-900/40 border border-white/5 rounded-2xl">
        <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
            {title}
        </h3>
        <div className={height}>
            {children}
        </div>
    </div>
);

// Helper to parse dates
const parseDate = (dateString: string): Date | null => {
    try {
        const parts = dateString.split(/[\/\-]/);
        if (parts.length === 3) {
             if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])); // YYYY-MM-DD
             if (parts[2].length === 4) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])); // DD/MM/YYYY
        }
        const d = new Date(dateString);
        if (!isNaN(d.getTime())) return d;
    } catch (e) {}
    return null;
};


// Active shape for the Pie chart to create a "pop out" effect - Dark Mode Text
const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

    return (
        <g style={{ filter: `drop-shadow(0 0 10px ${fill}40)` }}>
            <text x={cx} y={cy - 10} textAnchor="middle" fill="#e2e8f0" className="text-base font-bold">
                {payload.name}
            </text>
             <text x={cx} y={cy + 15} textAnchor="middle" fill={fill} className="text-xl font-black">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                cornerRadius={6}
            />
        </g>
    );
};


// The main Analytics component
export default function Analytics({ allLetters, settings }: AnalyticsProps) {
    const theme = getThemeClasses(settings.primaryColor);
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeFilter, setActiveFilter] = useState<'outbound' | 'inbound' | 'pending' | null>(null);

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    const handleFilterChange = (filter: 'outbound' | 'inbound' | 'pending') => {
        setActiveFilter(prev => (prev === filter ? null : filter));
    };

    const filteredLetters = useMemo(() => {
        if (!activeFilter) {
            return allLetters;
        }
        const pendingStatuses: LetterStatus[] = [LetterStatus.PENDING_AUDIT, LetterStatus.PENDING_REVIEW, LetterStatus.PENDING_INTERNAL_REVIEW, LetterStatus.AWAITING_REPLY, LetterStatus.RECEIVED];
        switch (activeFilter) {
            case 'outbound':
                return allLetters.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND);
            case 'inbound':
                return allLetters.filter(l => l.correspondenceType === CorrespondenceType.INBOUND);
            case 'pending':
                return allLetters.filter(l => pendingStatuses.includes(l.status));
            default:
                return allLetters;
        }
    }, [allLetters, activeFilter]);

    const chartData = useMemo(() => {
        const sourceLetters = filteredLetters;

        const statusCounts: { [key: string]: number } = {};
        sourceLetters.forEach(l => statusCounts[l.status] = (statusCounts[l.status] || 0) + 1);
        const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

        const volumeByMonth: { [key: string]: { inbound: number; outbound: number } } = {};
        sourceLetters.forEach(letter => {
            const date = parseDate(letter.date);
            if (date) {
                const month = date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' });
                if (!volumeByMonth[month]) {
                    volumeByMonth[month] = { inbound: 0, outbound: 0 };
                }
                if (letter.correspondenceType === CorrespondenceType.INBOUND) {
                    volumeByMonth[month].inbound++;
                } else {
                    volumeByMonth[month].outbound++;
                }
            }
        });
        const volumeData = Object.entries(volumeByMonth)
            .map(([name, values]) => ({ name, 'صادر': values.outbound, 'وارد': values.inbound }))
            .sort((a, b) => (new Date(a.name).getTime() || 0) - (new Date(b.name).getTime() || 0));

        const departmentLoad: { [key: string]: number } = {};
        sourceLetters.forEach(l => {
            if (l.currentDepartment && settings.departments.includes(l.currentDepartment)) {
                departmentLoad[l.currentDepartment] = (departmentLoad[l.currentDepartment] || 0) + 1;
            }
        });
        const departmentData = Object.entries(departmentLoad)
            .map(([name, value]) => ({ name, 'المعاملات': value }))
            .sort((a,b) => b.المعاملات - a.المعاملات)
            .slice(0, 10);

        const externalEntityLoad: { [key: string]: number } = {};
        sourceLetters.forEach(l => {
            const entity = l.correspondenceType === CorrespondenceType.INBOUND ? l.from : l.to;
            if (!settings.departments.includes(entity)) {
                externalEntityLoad[entity] = (externalEntityLoad[entity] || 0) + 1;
            }
        });
        const externalEntityData = Object.entries(externalEntityLoad)
            .map(([name, value]) => ({ name, 'المعاملات': value }))
            .sort((a,b) => b.المعاملات - a.المعاملات).slice(0, 7);

        const categoryCounts: { [key: string]: number } = {};
        sourceLetters.forEach(l => {
            const cat = l.category || 'غير مصنف';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        const categoryData = Object.entries(categoryCounts)
            .map(([name, value]) => ({ name, 'المعاملات': value }))
            .sort((a,b) => b.المعاملات - a.المعاملات).slice(0, 7);

        return { 
            statusData,
            volumeData,
            departmentData,
            externalEntityData,
            categoryData
        };
    }, [filteredLetters, settings.departments]);
    
    const kpiData = useMemo(() => {
        const outboundCount = allLetters.filter(l=> l.correspondenceType === CorrespondenceType.OUTBOUND).length;
        const inboundCount = allLetters.filter(l=> l.correspondenceType === CorrespondenceType.INBOUND).length;
        const pendingStatuses: LetterStatus[] = [LetterStatus.PENDING_AUDIT, LetterStatus.PENDING_REVIEW, LetterStatus.PENDING_INTERNAL_REVIEW, LetterStatus.AWAITING_REPLY, LetterStatus.RECEIVED];
        const pendingActions = allLetters.filter(l => pendingStatuses.includes(l.status)).length;
        
        let totalCompletionDays = 0;
        let completedCount = 0;
        allLetters.forEach(l => {
            const creationDate = parseDate(l.date);
            if (!creationDate) return;

            const finalStatusAction = l.approvalHistory.find(h => 
                h.action.includes(LetterStatus.SENT) || 
                h.action.includes(LetterStatus.REPLIED) ||
                h.action.includes(LetterStatus.ARCHIVED)
            );
            
            if(finalStatusAction) {
                const finalDate = parseDate(finalStatusAction.date);
                if(finalDate) {
                    const diffTime = Math.abs(finalDate.getTime() - creationDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    totalCompletionDays += diffDays;
                    completedCount++;
                }
            }
        });
        const avgCompletionTime = completedCount > 0 ? (totalCompletionDays / completedCount).toFixed(1) : 'N/A';

        return { outboundCount, inboundCount, pendingActions, avgCompletionTime };
    }, [allLetters]);

    const GRADIENT_COLORS = [
        { id: 'grad_emerald', from: '#6ee7b7', to: '#10b981' },
        { id: 'grad_amber', from: '#fcd34d', to: '#f59e0b' },
        { id: 'grad_rose', from: '#fda4af', to: '#f43f5e' },
        { id: 'grad_blue', from: '#93c5fd', to: '#3b82f6' },
        { id: 'grad_violet', from: '#c4b5fd', to: '#8b5cf6' },
        { id: 'grad_indigo', from: '#a5b4fc', to: '#6366f1' },
        { id: 'grad_fuchsia', from: '#f0abfc', to: '#d946ef' },
    ];
    
    const barGradients = {
        emerald: GRADIENT_COLORS[0],
        blue: GRADIENT_COLORS[3],
        amber: GRADIENT_COLORS[1]
    };

    const AnyPie = Pie as any;
    
    const subtitle = useMemo(() => {
        if (!activeFilter) {
            return "نظرة شاملة ومفصلة على أداء وفعالية نظام المراسلات في منشأتك.";
        }
        switch (activeFilter) {
            case 'outbound': return "عرض تحليلات المعاملات الصادرة فقط. انقر على البطاقة مرة أخرى لإلغاء الفلتر.";
            case 'inbound': return "عرض تحليلات المعاملات الواردة فقط. انقر على البطاقة مرة أخرى لإلغاء الفلتر.";
            case 'pending': return "عرض تحليلات المعاملات التي لا تزال تحت الإجراء فقط. انقر على البطاقة مرة أخرى لإلغاء الفلتر.";
        }
    }, [activeFilter]);

    // Chart Axis Styles
    const axisStyle = {
        tick: { fill: '#94a3b8', fontSize: 11, fontWeight: 600, fontFamily: 'Cairo' },
        axisLine: { stroke: '#334155' },
        tickLine: { stroke: '#334155' }
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    لوحة التحليلات
                </h1>
                <p className="text-slate-400 font-bold max-w-2xl">{subtitle}</p>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="إجمالي المعاملات الصادرة" 
                    value={kpiData.outboundCount} 
                    color="bg-indigo-500"
                    onClick={() => handleFilterChange('outbound')}
                    isActive={activeFilter === 'outbound'}
                    theme={theme}
                />
                <StatCard 
                    title="إجمالي المعاملات الواردة" 
                    value={kpiData.inboundCount} 
                    color="bg-violet-500"
                    onClick={() => handleFilterChange('inbound')}
                    isActive={activeFilter === 'inbound'}
                    theme={theme}
                />
                <StatCard 
                    title="معاملات تحت الإجراء" 
                    value={kpiData.pendingActions} 
                    color="bg-amber-500"
                    onClick={() => handleFilterChange('pending')}
                    isActive={activeFilter === 'pending'}
                    theme={theme}
                />
                <StatCard 
                    title="متوسط أيام الإنجاز" 
                    value={`${kpiData.avgCompletionTime} يوم`} 
                    color="bg-teal-500"
                    theme={theme}
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalyticsCard title="نظرة عامة على حالة المعاملات">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                             <defs>
                                {GRADIENT_COLORS.map(color => (
                                    <linearGradient key={color.id} id={color.id} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={color.from} stopOpacity={1}/>
                                        <stop offset="100%" stopColor={color.to} stopOpacity={1}/>
                                    </linearGradient>
                                ))}
                            </defs>
                            <AnyPie
                                activeIndex={activeIndex}
                                activeShape={renderActiveShape}
                                data={chartData.statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                dataKey="value"
                                onMouseEnter={onPieEnter}
                                paddingAngle={2}
                                stroke="none"
                            >
                                {chartData.statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`url(#${GRADIENT_COLORS[index % GRADIENT_COLORS.length].id})`} stroke="none" />
                                ))}
                            </AnyPie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                iconType="circle" 
                                wrapperStyle={{paddingTop: '20px', fontSize: '12px', fontWeight: 'bold', color: '#cbd5e1'}}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </AnalyticsCard>
                
                <AnalyticsCard title="حجم المراسلات الشهري">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.volumeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                            <XAxis dataKey="name" {...axisStyle} />
                            <YAxis {...axisStyle} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{paddingTop: '10px', color: '#cbd5e1'}} />
                            <Line type="monotone" dataKey="صادر" stroke="#818cf8" strokeWidth={3} activeDot={{ r: 6, fill: '#818cf8', stroke: '#fff' }} dot={{ r: 0 }} />
                            <Line type="monotone" dataKey="وارد" stroke="#a78bfa" strokeWidth={3} activeDot={{ r: 6, fill: '#a78bfa', stroke: '#fff' }} dot={{ r: 0 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </AnalyticsCard>

                <AnalyticsCard title="أكثر الإدارات نشاطًا (أعلى 10)">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.departmentData} margin={{ top: 5, right: 20, left: -10, bottom: 80 }}>
                            <defs>
                                <linearGradient id={barGradients.emerald.id} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={barGradients.emerald.from} stopOpacity={1}/>
                                    <stop offset="100%" stopColor={barGradients.emerald.to} stopOpacity={1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={90} {...axisStyle} />
                            <YAxis allowDecimals={false} {...axisStyle} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                            <Bar dataKey="المعاملات" fill={`url(#${barGradients.emerald.id})`} barSize={30} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </AnalyticsCard>

                <AnalyticsCard title="أكثر الجهات الخارجية مراسلة (أعلى 7)">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.externalEntityData} margin={{ top: 5, right: 20, left: -10, bottom: 80 }}>
                             <defs>
                                <linearGradient id={barGradients.blue.id} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={barGradients.blue.from} stopOpacity={1}/>
                                    <stop offset="100%" stopColor={barGradients.blue.to} stopOpacity={1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={90} {...axisStyle} />
                            <YAxis allowDecimals={false} {...axisStyle} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                            <Bar dataKey="المعاملات" fill={`url(#${barGradients.blue.id})`} barSize={30} radius={[6, 6, 0, 0]}/>
                        </BarChart>
                    </ResponsiveContainer>
                </AnalyticsCard>
                
                 <AnalyticsCard title="أبرز فئات المعاملات (أعلى 7)">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.categoryData} margin={{ top: 5, right: 20, left: -10, bottom: 80 }}>
                             <defs>
                                <linearGradient id={barGradients.amber.id} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={barGradients.amber.from} stopOpacity={1}/>
                                    <stop offset="100%" stopColor={barGradients.amber.to} stopOpacity={1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={90} {...axisStyle} />
                            <YAxis allowDecimals={false} {...axisStyle} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                            <Bar dataKey="المعاملات" fill={`url(#${barGradients.amber.id})`} barSize={30} radius={[6, 6, 0, 0]}/>
                        </BarChart>
                    </ResponsiveContainer>
                </AnalyticsCard>

            </div>
        </div>
    );
}
