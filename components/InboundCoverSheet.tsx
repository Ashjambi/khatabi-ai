
import React from 'react';
import { Letter, CompanySettings } from '../types';

interface InboundCoverSheetProps {
    letter: Letter;
    settings: CompanySettings;
}

const InboundCoverSheet: React.FC<InboundCoverSheetProps> = ({ letter, settings }) => {
    const qrCodeUrl = letter.internalRefNumber
        ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(letter.internalRefNumber)}`
        : '';
        
    return (
        <div className="p-10 bg-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <div className="border-4 border-slate-800 p-8 min-h-screen">
                {/* Header */}
                <header className="flex justify-between items-start pb-6 border-b-2 border-slate-300">
                    <div className="text-right">
                        <h1 className="text-3xl font-bold text-slate-800">{settings.companyName}</h1>
                        <p className="text-slate-600">مركز الوارد العام</p>
                    </div>
                    {settings.companyLogo && (
                        <img src={settings.companyLogo} alt="Company Logo" className="h-20 w-auto object-contain" />
                    )}
                </header>

                {/* Main Content */}
                <main className="mt-10 grid grid-cols-3 gap-10">
                    {/* Details Section */}
                    <div className="col-span-2">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b-2 border-slate-800 inline-block pb-1">بيانات المعاملة الواردة</h2>
                        <div className="space-y-6 text-lg">
                            <div className="grid grid-cols-3 items-baseline">
                                <strong className="col-span-1 text-slate-600">الموضوع:</strong>
                                <p className="col-span-2 text-slate-900 font-bold leading-relaxed">{letter.subject}</p>
                            </div>
                            <div className="grid grid-cols-3 items-baseline">
                                <strong className="col-span-1 text-slate-600">الجهة المرسلة:</strong>
                                <p className="col-span-2 text-slate-800 font-semibold">{letter.from}</p>
                            </div>
                             <div className="grid grid-cols-3 items-baseline">
                                <strong className="col-span-1 text-slate-600">تاريخ الاستلام:</strong>
                                <p className="col-span-2 text-slate-800 font-mono">{letter.date}</p>
                            </div>
                            <div className="grid grid-cols-3 items-baseline">
                                <strong className="col-span-1 text-slate-600">الإحالة (القسم):</strong>
                                <p className="col-span-2 text-slate-800 font-semibold">{letter.to}</p>
                            </div>
                            
                            {/* External Reference Display */}
                            <div className="grid grid-cols-3 items-baseline bg-slate-50 p-3 rounded border border-slate-200 mt-2">
                                <strong className="col-span-1 text-slate-700">رقم الصادر (لدى المرسل):</strong>
                                <p className="col-span-2 text-slate-900 font-mono font-bold tracking-wider">{letter.externalRefNumber || 'غير متوفر'}</p>
                            </div>
                        </div>

                         {/* Attachments Section */}
                        <div className="mt-10 pt-6 border-t border-slate-200">
                             <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>المرفقات</span>
                             </h3>
                             <p className="mb-4 text-slate-600">عدد الملفات: {letter.attachments?.length || 0}</p>
                             {letter.attachments && letter.attachments.length > 0 && (
                                <ul className="list-decimal list-inside space-y-2 pr-4">
                                    {letter.attachments.map(att => (
                                        <li key={att.id} className="text-slate-700">{att.name}</li>
                                    ))}
                                </ul>
                             )}
                        </div>
                    </div>

                    {/* Internal Ref Number Section (The New Format) */}
                    <div className="col-span-1 flex flex-col items-center justify-start text-center border-r-2 border-slate-200 pr-8">
                        <h3 className="text-lg font-bold text-slate-600 mb-2">رقم القيد (النظام)</h3>
                        <div className="w-full bg-slate-100 border-2 border-slate-800 rounded-lg p-4 mb-6 shadow-sm">
                            <p className="text-4xl font-black text-slate-900 tracking-wider font-mono">
                                {letter.internalRefNumber}
                            </p>
                            <div className="flex justify-center items-center gap-2 mt-2">
                                <p className="text-xs text-slate-500 font-bold bg-white px-2 py-1 rounded border">السنة</p>
                                <p className="text-xs text-slate-500 font-bold bg-white px-2 py-1 rounded border">تسلسل</p>
                            </div>
                        </div>
                        
                        {qrCodeUrl && (
                             <div className="border border-slate-200 p-2 bg-white rounded">
                                <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" />
                             </div>
                        )}
                        <p className="mt-4 text-sm text-slate-500 font-semibold">استخدم هذا الرقم لمتابعة المعاملة داخلياً</p>
                    </div>
                </main>
                
                 {/* Signature Section */}
                <footer className="mt-24 pt-8 border-t-2 border-slate-300">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="font-bold text-slate-800">مدير مركز الوارد:</p>
                            <div className="mt-12 border-b border-slate-400"></div>
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">الختم:</p>
                            <div className="mt-12 border-b border-slate-400"></div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default InboundCoverSheet;
