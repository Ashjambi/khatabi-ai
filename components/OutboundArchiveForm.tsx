
import React, { useState, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Letter, Attachment, PriorityLevel, ConfidentialityLevel, LetterType, CorrespondenceType, LetterStatus, Tone } from '../types';
import { extractDetailsFromLetterImage } from '../services/geminiService';
import Tiff from 'tiff.js';
import { useApp } from '../App';
import { getThemeClasses } from './utils';
import MultiSelectCombobox from './MultiSelectCombobox';
import { LinkIcon, SparklesIcon, CheckCircleIcon } from './icons';

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

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

export default function OutboundArchiveForm(): React.ReactNode {
  const { state, dispatch } = useApp();
  const { companySettings: settings, letters } = state;

  const [formState, setFormState] = useState({
      subject: '',
      from: settings.defaultDepartment,
      to: '',
      cc: [] as string[],
      dateSent: new Date().toISOString().split('T')[0],
      letterType: LetterType.MISCELLANEOUS,
      category: '',
      attachments: [] as File[],
      externalRefNumber: '',
      priority: PriorityLevel.NORMAL,
      confidentiality: ConfidentialityLevel.NORMAL,
      notes: '',
      referenceId: undefined as string | undefined,
  });

  const [isScanning, setIsScanning] = useState(false);
  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);

  const updateState = (payload: Partial<typeof formState>) => {
      setFormState(prev => ({ ...prev, ...payload }));
  };

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        toast.error("حجم الملف كبير جداً (أقصى حد 10MB).");
        return;
    }

    setIsScanning(true);
    const loadingToast = toast.loading("جاري مسح نسخة الصادر...");
    
    try {
        let base64Data: string;
        let mimeType: string;

        if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
            const arrayBuffer = await file.arrayBuffer();
            const tiff = new Tiff({ buffer: arrayBuffer });
            const canvas = tiff.toCanvas();
            if (!canvas) throw new Error("فشل تحويل TIFF");
            base64Data = canvas.toDataURL('image/png').split(',')[1];
            mimeType = 'image/png';
        } else {
            const dataUrl = await fileToDataURL(file);
            const [header, data] = dataUrl.split(',');
            base64Data = data;
            mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
        }

        const context = letters.map(l => ({ id: l.id, subject: l.subject, internalRefNumber: l.internalRefNumber })).slice(0, 15);

        const extracted = await extractDetailsFromLetterImage(
            base64Data, mimeType, settings.departments, 
            Object.values(LetterType), Object.values(PriorityLevel), 
            Object.values(ConfidentialityLevel), [], context
        );
        
        updateState({
            subject: extracted.subject || formState.subject,
            to: extracted.to || formState.to,
            externalRefNumber: extracted.externalRefNumber || formState.externalRefNumber,
            dateSent: extracted.date || formState.dateSent,
            referenceId: extracted.referenceId || formState.referenceId,
            attachments: [file, ...formState.attachments]
        });

        toast.success("تم استخلاص البيانات!", { id: loadingToast });
    } catch(error: any) {
        const errorMsg = error.message.includes("API_KEY_NOT_FOUND_IN_BROWSER") 
            ? "تنبيه: يجب إضافة API_KEY في إعدادات Build Variables في Cloudflare لكي يعمل التطبيق." 
            : `فشل المسح: ${error.message}`;
        toast.error(errorMsg, { id: loadingToast, duration: 6000 });
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.subject || !formState.to || formState.attachments.length === 0) {
      toast.error('الموضوع والجهة المستلمة والنسخة المرفقة حقول إلزامية.');
      return;
    }

    const attachmentPromises = formState.attachments.map(async (file, index) => {
        const url = await fileToDataURL(file);
        return {
            id: `arch_att_${Date.now()}_${index}`,
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
            subject: formState.subject, from: formState.from, to: formState.to, 
            cc: formState.cc, date: formState.dateSent, type: formState.letterType, 
            tone: Tone.NEUTRAL, attachments: newAttachments, externalRefNumber: formState.externalRefNumber,
            priority: formState.priority, confidentiality: formState.confidentiality, 
            category: formState.category, notes: formState.notes, referenceId: formState.referenceId,
            correspondenceType: CorrespondenceType.OUTBOUND, status: LetterStatus.SENT 
        } as any 
    });
    toast.success("تمت أرشفة الصادر بنجاح.");
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black text-white">أرشفة صادر جاهز</h2>
      </div>
      
      <div className="glass-card p-8 space-y-8 rounded-[2rem] border-white/10 shadow-3xl">
        <div className="flex justify-center">
            <button onClick={() => aiScanInputRef.current?.click()} disabled={isScanning} className={`w-full md:w-auto px-10 py-5 rounded-2xl font-black text-white flex items-center gap-3 transition-all ${isScanning ? 'bg-slate-700' : theme.bg + ' hover:brightness-110'}`}>
                {isScanning ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <SparklesIcon className="w-6 h-6" />}
                <span>{isScanning ? 'جاري التحليل...' : 'مسح نسخة الصادر (AI)'}</span>
            </button>
            <input type="file" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" accept="application/pdf,image/*" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <InputField label="الموضوع" value={formState.subject} onChange={e => updateState({ subject: e.target.value })} ringColor={theme.ring} required />
            <InputField label="المرسل إليه" value={formState.to} onChange={e => updateState({ to: e.target.value })} ringColor={theme.ring} required />
            <InputField label="تاريخ الإرسال" type="date" value={formState.dateSent} onChange={e => updateState({ dateSent: e.target.value })} ringColor={theme.ring} />
            <button type="submit" disabled={isScanning} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-3xl disabled:opacity-50 transition-all">إتمام الأرشفة والتسجيل</button>
        </form>
      </div>
    </div>
  );
}
