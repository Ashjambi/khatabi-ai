
import React from 'react';
import { Letter, CompanySettings } from '../types';

interface DeliveryReceiptProps {
    letter: Letter;
    settings: CompanySettings;
}

const DeliveryReceipt: React.FC<DeliveryReceiptProps> = ({ letter, settings }) => {
    return (
        <div className="p-10 bg-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <div className="border-2 border-slate-700 p-6 min-h-[50vh]">
                {/* Header */}
                <header className="flex justify-between items-start pb-4 border-b-2 border-slate-300">
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-slate-800">{settings.companyName}</h1>
                        <p className="text-slate-600">سند استلام معاملة</p>
                    </div>
                    {settings.companyLogo && (
                        <img src={settings.companyLogo} alt="Company Logo" className="h-16 w-auto object-contain" />
                    )}
                </header>

                {/* Main Content */}
                <main className="mt-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">إقرار استلام</h2>
                    <div className="space-y-5 text-md">
                        <p className="leading-relaxed">
                            أقر أنا الموقع أدناه، باستلامي أصل المعاملة الموضحة تفاصيلها أدناه من ممثل شركة/ <span className="font-bold">{settings.companyName}</span>.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3">
                            <div className="grid grid-cols-4">
                                <strong className="col-span-1 text-slate-600">الموضوع:</strong>
                                <p className="col-span-3 text-slate-800 font-semibold">{letter.subject}</p>
                            </div>
                            <div className="grid grid-cols-4">
                                <strong className="col-span-1 text-slate-600">موجهة إلى:</strong>
                                <p className="col-span-3 text-slate-800">{letter.to}</p>
                            </div>
                            <div className="grid grid-cols-4">
                                <strong className="col-span-1 text-slate-600">صادرة من:</strong>
                                <p className="col-span-3 text-slate-800">{letter.from}</p>
                            </div>
                            <div className="grid grid-cols-4">
                                <strong className="col-span-1 text-slate-600">رقم المعاملة:</strong>
                                <p className="col-span-3 text-slate-800 font-mono">{letter.internalRefNumber || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </main>
                
                {/* Signature Section */}
                <footer className="mt-16 pt-8">
                    <div className="grid grid-cols-2 gap-12">
                        <div>
                            <p className="font-bold text-slate-800">اسم المستلم:</p>
                            <div className="mt-12 border-b border-slate-400"></div>
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">التوقيع:</p>
                            <div className="mt-12 border-b border-slate-400"></div>
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">التاريخ والوقت:</p>
                            <p className="mt-12 border-b border-slate-400">
                                {new Date().toLocaleString('ar-SA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">الختم الرسمي:</p>
                            <div className="mt-4 border border-slate-400 h-20 rounded-md"></div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default DeliveryReceipt;
