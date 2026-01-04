
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);
  const allRecipients = [...settings.departments, ...(settings.externalEntities || [])];

  const updateState = (payload: Partial<InboundLetterFormState>) => {
      dispatch({ type: 'UPDATE_INBOUND_FORM_STATE', payload });
  };

  const filteredLetters = useMemo(() => {
      if (!searchTerm) return [];
      const lower = searchTerm.toLowerCase();
      return letters.filter(l => 
          l.subject.toLowerCase().includes(lower) || 
          (l.internalRefNumber || '').toLowerCase().includes(lower) ||
          (l.externalRefNumber || '').toLowerCase().includes(lower)
      ).slice(0, 5);
  }, [searchTerm, letters]);

  const selectedParentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من الحجم - Cloudflare و Gemini يفضلان الطلبات تحت 4MB للموثوقية
    if (file.size > 5 * 1024 * 1024) {
        toast.error("حجم الملف كبير جداً (أقصى حد 5MB). يرجى ضغط الملف أو رفعه كصورة.");
        if (e.target) e.target.value = '';
        return;
    }

    const isTiff = file.type.startsWith('image/tif') || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');
    const isSupported = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type);

    if (!isTiff && !isSupported) {
        toast.error("صيغة الملف غير مدعومة للمسح الضوئي.");
        return;
    }

    setIsScanning(true);
    const loadingToast = toast.loading("جاري تحليل الخطاب رقمياً...");
    
    try {
        let base64Data: string;
        let mimeType: string;
        
        if (isTiff) {
            const arrayBuffer = await file.arrayBuffer();
            const tiff = new Tiff({ buffer: arrayBuffer });
            const canvas = tiff.toCanvas();
            if (!canvas) throw new Error("فشل تحويل ملف TIFF");
            const dataUrl = canvas.toDataURL('image/png');
            [, base64Data] = dataUrl.split(',');
            mimeType = 'image/png';
        } else {
            const dataUrl = await fileToDataURL(file);
            const [header, data] = dataUrl.split(',');
            const matchedMime = header.match(/:(.*?);/)?.[1];
            if (!matchedMime || !data) throw new Error("ملف غير صالح");
            base64Data = data;
            mimeType = matchedMime;
        }

        const existingLettersContext = letters.map(l => ({
            id: l.id, subject: l.subject, internalRefNumber: l.internalRefNumber, externalRefNumber: l.externalRefNumber, date: l.date
        })).slice(0, 15);

        const extractedData = await extractDetailsFromLetterImage(
            base64Data, 
            mimeType, 
            settings.departments, 
            Object.values(LetterType), 
            Object.values(PriorityLevel), 
            Object.values(ConfidentialityLevel), 
            [], 
            existingLettersContext
        );
        
        const updates: Partial<InboundLetterFormState> = {
            attachments: [file, ...attachments]
        };

        if (extractedData.subject) updates.subject = extractedData.subject;
        if (extractedData.from) updates.from = extractedData.from;
        if (extractedData.to) updates.to = extractedData.to; 
        if (extractedData.externalRefNumber) updates.externalRefNumber = extractedData.externalRefNumber;
        if (extractedData.summary) updates.summary = extractedData.summary;
        if (extractedData.referenceId) updates.referenceId = extractedData.referenceId;
        if (extractedData.date) updates.dateReceived = extractedData.date;

        updateState(updates);
        toast.success("تم استخلاص البيانات بنجاح!", { id: loadingToast });

    } catch(error: any) {
        console.error(error);
        toast.error(`فشل المسح الضوئي: ${error.message || 'خطأ في الاتصال'}`, { id: loadingToast });
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    updateState({ attachments: attachments.filter((_, i) => i !== index) });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        updateState({ attachments: [...attachments, ...Array.from(e.target.files)] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !from.trim() || !to.trim() || attachments.length === 0) {
      toast.error('الرجاء تعبئة الحقول الإلزامية وإرفاق ملف واحد على الأقل.');
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
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-2xl font-bold text-white">تسجيل خطاب وارد جديد</h2>
        <button onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })} className="btn-3d-secondary px-3 py-1.5 text-sm text-rose-300 font-bold border border-rose-500/30 hover:bg-rose-500/20">مسح النموذج</button>
      </div>
      <p className="text-slate-400 font-bold mb-6">حوّل الخطابات الورقية إلى بيانات رقمية فوراً عبر المسح الضوئي.</p>
      
      <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/10">
        <div className="flex justify-center mb-6">
            <button
                onClick={() => aiScanInputRef.current?.click()}
                disabled={isScanning}
                className={`w-full md:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 text-white rounded-lg shadow-lg transition-all ${isScanning ? 'bg-slate-500 cursor-wait' : theme.bg + ' hover:brightness-110'}`}
            >
                 {isScanning ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span className="font-bold">جاري القراءة...</span></>
                 ) : (
                    <span className="text-lg font-bold">المسح الضوئي الذكي (OCR)</span>
                 )}
            </button>
            <input type="file" accept="application/pdf,image/*" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" />
        </div>
        
        {summary && (
             <div className="my-6 p-4 bg-indigo-900/20 border-r-4 border-indigo-500 rounded-md animate-in fade-in slide-in-from-right-2">
                <h3 className="text-sm font-bold text-indigo-400 mb-1">ملخص الذكاء الاصطناعي</h3>
                <p className="text-sm font-semibold text-slate-100 leading-relaxed">{summary}</p>
            </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> ربط بمعاملة سابقة</h3>
                    {selectedParentLetter && <button type="button" onClick={() => updateState({ referenceId: undefined })} className="text-xs text-rose-400 underline font-bold">إلغاء الربط</button>}
                </div>
                {selectedParentLetter ? (
                    <div className="bg-indigo-500/20 p-3 rounded border border-indigo-500/30 text-sm font-bold text-white">مرتبط بـ: {selectedParentLetter.subject}</div>
                ) : (
                    <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }} placeholder="ابحث برقم المعاملة أو الموضوع للربط..." className="w-full px-4 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="الموضوع" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} required />
                <InputField label="جهة الورود" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} required/>
                <InputField label="توجيه إلى" value={to} onChange={(e) => updateState({ to: e.target.value })} ringColor={theme.ring} required />
                <InputField label="تاريخ المستند" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} />
                <InputField label="رقم الصادر الخارجي" value={externalRefNumber} onChange={(e) => updateState({ externalRefNumber: e.target.value })} ringColor={theme.ring} />
                <SelectField label="نوع الخطاب" value={letterType} onChange={(e) => updateState({ letterType: e.target.value as LetterType })} options={LetterType} ringColor={theme.ring} />
            </div>

            <div className="pt-4 text-center">
                <button type="submit" disabled={isScanning} className="w-full md:w-auto px-12 py-3 text-white bg-emerald-600 rounded-md hover:bg-emerald-700 font-bold shadow-lg disabled:opacity-50">إتمام التسجيل</button>
            </div>
        </form>
      </div>
    </div>
  );
}
