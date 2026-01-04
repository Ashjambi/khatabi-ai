
import React, { useState, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Letter, Attachment, CompanySettings, PriorityLevel, ConfidentialityLevel, LetterType, InboundLetterFormState, CorrespondenceType } from '../types';
import { extractDetailsFromLetterImage } from '../services/geminiService';
import Tiff from 'tiff.js';
import { useApp } from '../App';
import { getThemeClasses } from './utils';
import MultiSelectCombobox from './MultiSelectCombobox';
import { LinkIcon } from './icons';

const InputField = ({ label, value, onChange, placeholder, type = 'text', ringColor, disabled = false, required = false }: {label: string, value: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, type?: string, ringColor: string, disabled?: boolean, required?: boolean}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
      />
    </div>
);

const TextAreaField = ({ label, value, onChange, placeholder, rows, ringColor, disabled=false }: {label: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, rows?: number, ringColor: string, disabled?: boolean}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <textarea
        rows={rows || 3}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
      ></textarea>
    </div>
);

const SelectField = <T extends string>({ label, value, onChange, options, ringColor, disabled=false }: {label: string, value: T, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: object | string[], ringColor: string, disabled?: boolean}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <select 
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
      >
        {Array.isArray(options) 
          ? options.map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)
          : Object.entries(options).filter(([key]) => isNaN(Number(key))).map(([key, val]) => <option key={key} value={val} className="bg-slate-900">{val}</option>)}
      </select>
    </div>
);

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

export default function InboundLetterForm(): React.ReactNode {
  const { state, dispatch } = useApp();
  const { companySettings: settings, letters, inboundLetterFormState } = state;

  const {
      subject, from, to, cc, dateReceived, letterType, category, attachments, summary, referenceId,
      externalRefNumber, priority, confidentiality, completionDays, notes
  } = inboundLetterFormState;

  const [isScanning, setIsScanning] = useState(false);
  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);

  const updateState = (payload: Partial<InboundLetterFormState>) => {
      dispatch({ type: 'UPDATE_INBOUND_FORM_STATE', payload });
  };

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // تحديد الحد الأقصى للملف بـ 4MB لتجنب قيود السحابة
    if (file.size > 4 * 1024 * 1024) {
        toast.error("حجم الملف كبير جداً للمسح الذكي (الحد الأقصى 4MB). يرجى ضغط الملف أو رفعه كصورة.");
        if (e.target) e.target.value = '';
        return;
    }

    setIsScanning(true);
    const loadingToast = toast.loading("جاري قراءة الخطاب وتحليل البيانات...");
    
    try {
        let base64Data: string;
        let mimeType: string;
        
        if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
            const arrayBuffer = await file.arrayBuffer();
            const tiff = new Tiff({ buffer: arrayBuffer });
            const canvas = tiff.toCanvas();
            if (!canvas) throw new Error("فشل تحويل الملف");
            base64Data = canvas.toDataURL('image/png').split(',')[1];
            mimeType = 'image/png';
        } else {
            const dataUrl = await fileToDataURL(file);
            const [header, data] = dataUrl.split(',');
            base64Data = data;
            mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
        }

        const context = letters.map(l => ({ id: l.id, subject: l.subject, internalRefNumber: l.internalRefNumber, date: l.date })).slice(0, 15);

        const extractedData = await extractDetailsFromLetterImage(
            base64Data, mimeType, settings.departments, 
            Object.values(LetterType), Object.values(PriorityLevel), 
            Object.values(ConfidentialityLevel), [], context
        );
        
        updateState({
            subject: extractedData.subject || subject,
            from: extractedData.from || from,
            to: extractedData.to || to,
            externalRefNumber: extractedData.externalRefNumber || externalRefNumber,
            summary: extractedData.summary || summary,
            referenceId: extractedData.referenceId || referenceId,
            dateReceived: extractedData.date || dateReceived,
            attachments: [file, ...attachments]
        });

        toast.success("تم استخلاص البيانات بنجاح!", { id: loadingToast });

    } catch(error: any) {
        toast.error(error.message, { id: loadingToast, duration: 6000 });
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !from.trim() || !to.trim() || attachments.length === 0) {
      toast.error('الحقول الأساسية والملف المرفق مطلوبة.');
      return;
    }

    const attachmentPromises = attachments.map(async (file, index) => {
        const url = await fileToDataURL(file);
        return {
            id: `in_att_${Date.now()}_${index}`,
            name: file.name,
            type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'other' as any,
            url,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
        };
    });

    const newAttachments = await Promise.all(attachmentPromises);
    dispatch({ 
        type: 'REGISTER_INBOUND', 
        payload: { 
            subject, from, to, type: letterType, cc, date: dateReceived, 
            attachments: newAttachments, externalRefNumber, priority, 
            confidentiality, completionDays: completionDays ? Number(completionDays) : undefined, 
            notes, category, summary, referenceId 
        } 
    });
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black text-white">تسجيل خطاب وارد جديد</h2>
        <button onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })} className="btn-3d-secondary px-4 py-2 text-xs font-bold text-rose-400">مسح النموذج</button>
      </div>
      
      <div className="glass-card p-8 space-y-8 rounded-[2rem] border-white/10 shadow-3xl">
        <div className="flex justify-center">
            <button onClick={() => aiScanInputRef.current?.click()} disabled={isScanning} className={`w-full md:w-auto px-10 py-5 rounded-2xl font-black text-white flex items-center gap-3 transition-all ${isScanning ? 'bg-slate-700' : theme.bg + ' hover:brightness-110'}`}>
                 {isScanning ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <LinkIcon className="w-6 h-6 rotate-45" />}
                 <span>{isScanning ? 'جاري التحليل...' : 'تحليل ملف الخطاب (AI)'}</span>
            </button>
            <input type="file" accept="application/pdf,image/*" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="الموضوع" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} required />
                <InputField label="جهة الورود" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} required/>
                <InputField label="توجيه إلى" value={to} onChange={(e) => updateState({ to: e.target.value })} ringColor={theme.ring} required />
                <InputField label="تاريخ المستند" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} />
            </div>
            <button type="submit" disabled={isScanning} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-3xl transition-all">إتمام التسجيل والحفظ</button>
        </form>
      </div>
    </div>
  );
}
