
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
      externalRefNumber: '', // الرقم اليدوي الموجود على الورقة
      priority: PriorityLevel.NORMAL,
      confidentiality: ConfidentialityLevel.NORMAL,
      notes: '',
      referenceId: undefined as string | undefined,
  });

  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);
  const allEntities = [...settings.departments, ...settings.externalEntities];

  const updateState = (payload: Partial<typeof formState>) => {
      setFormState(prev => ({ ...prev, ...payload }));
  };

  const filteredLetters = useMemo(() => {
      if (!searchTerm) return [];
      const lower = searchTerm.toLowerCase();
      return letters.filter(l => 
          l.subject.toLowerCase().includes(lower) || 
          (l.internalRefNumber || '').toLowerCase().includes(lower)
      ).slice(0, 5);
  }, [searchTerm, letters]);

  const selectedParentLetter = useMemo(() => letters.find(l => l.id === formState.referenceId), [letters, formState.referenceId]);

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // دعم TIFF
    const isTiff = file.type.startsWith('image/tif') || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');

    setIsScanning(true);
    
    try {
        let base64Data: string;
        let mimeType: string;

        if (isTiff) {
            const arrayBuffer = await file.arrayBuffer();
            const tiff = new Tiff({ buffer: arrayBuffer });
            const canvas = tiff.toCanvas();
            if (!canvas) throw new Error("Could not convert TIFF");
            const dataUrl = canvas.toDataURL('image/png');
            base64Data = dataUrl.split(',')[1];
            mimeType = 'image/png';
        } else {
            const dataUrl = await fileToDataURL(file);
            const [header, data] = dataUrl.split(',');
            base64Data = data;
            mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
        }

        // تحضير السياق (آخر 20 خطاب للمطابقة)
        const contextLetters = letters.map(l => ({ 
            id: l.id, 
            subject: l.subject, 
            internalRefNumber: l.internalRefNumber, 
            date: l.date 
        })).slice(0, 20);

        const extractedData = await extractDetailsFromLetterImage(
            base64Data, 
            mimeType, 
            settings.departments, 
            Object.values(LetterType), 
            Object.values(PriorityLevel), 
            Object.values(ConfidentialityLevel), 
            [], 
            contextLetters
        );
        
        updateState({
            subject: extractedData.subject || formState.subject,
            to: extractedData.to || formState.to,
            externalRefNumber: extractedData.externalRefNumber || formState.externalRefNumber,
            category: extractedData.category || formState.category,
            priority: (extractedData.priority as PriorityLevel) || formState.priority,
            confidentiality: (extractedData.confidentiality as ConfidentialityLevel) || formState.confidentiality,
            dateSent: extractedData.date || formState.dateSent,
            referenceId: extractedData.referenceId || formState.referenceId,
            attachments: [file, ...formState.attachments]
        });

        if (extractedData.referenceId) {
            toast.success("تم الربط آلياً بالمعاملة المرجعية.");
        } else {
            toast.success("تم استخلاص البيانات بنجاح.");
        }

    } catch(error) {
        console.error(error);
        toast.error("فشل المسح الضوئي للخطاب. يرجى التحقق من جودة الصورة.");
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.subject || !formState.to || formState.attachments.length === 0) {
      toast.error('الموضوع، المرسل إليه، والنسخة الضوئية هي حقول إلزامية.');
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

    const letterData: Omit<Letter, 'id' | 'status' | 'correspondenceType' | 'approvalHistory' | 'currentDepartment'> = {
        subject: formState.subject,
        from: formState.from,
        to: formState.to,
        cc: formState.cc,
        date: formState.dateSent,
        type: formState.letterType,
        tone: Tone.NEUTRAL,
        body: `<p><strong>أرشفة صادر خارجي:</strong> تمت أرشفة هذا الخطاب الموقَّع آلياً عبر المسح الضوئي.</p>`,
        attachments: newAttachments,
        externalRefNumber: formState.externalRefNumber,
        priority: formState.priority,
        confidentiality: formState.confidentiality,
        category: formState.category,
        notes: formState.notes,
        referenceId: formState.referenceId,
    };

    dispatch({ 
        type: 'REGISTER_INBOUND', 
        payload: { ...letterData, correspondenceType: CorrespondenceType.OUTBOUND, status: LetterStatus.SENT } as any 
    });
    toast.success("تمت أرشفة الخطاب الصادر بنجاح.");
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-3xl font-black text-white">أرشفة خطاب صادر جاهز</h2>
            <p className="text-slate-400 font-bold mt-1">قم بتوثيق الخطابات التي تم إرسالها يدوياً أو خارج النظام.</p>
        </div>
        <button onClick={() => setFormState(prev => ({...prev, subject: '', to: '', attachments: []}))} className="btn-3d-secondary px-4 py-2 text-xs font-black text-rose-400 border-rose-500/20">تفريغ الحقول</button>
      </div>
      
      <div className="glass-card p-8 space-y-8 rounded-[2.5rem] border-white/10 shadow-3xl">
        <div className="flex justify-center">
            <button
                onClick={() => aiScanInputRef.current?.click()}
                disabled={isScanning}
                className={`w-full md:w-auto px-10 py-5 rounded-2xl font-black text-white flex items-center gap-3 transition-all shadow-2xl ${isScanning ? 'bg-slate-700' : theme.bg + ' hover:brightness-110'}`}
            >
                {isScanning ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <SparklesIcon className="w-6 h-6" />}
                <span>{isScanning ? 'جاري قراءة الخطاب...' : 'مسح ضوئي للنسخة الموقعة (AI)'}</span>
            </button>
            <input type="file" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" accept="application/pdf,image/*" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
             <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" /> ربط بمعاملة سابقة
                    </h3>
                    {formState.referenceId && (
                        <button type="button" onClick={() => updateState({ referenceId: undefined })} className="text-[10px] text-rose-400 font-bold">إلغاء الربط</button>
                    )}
                </div>
                
                {selectedParentLetter ? (
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-bold text-white">{selectedParentLetter.subject}</p>
                            <p className="text-[10px] text-emerald-300">مرتبط بمرجع: {selectedParentLetter.internalRefNumber}</p>
                        </div>
                        <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                    </div>
                ) : (
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }}
                            onFocus={() => setIsSearchOpen(true)}
                            placeholder="ابحث عن المعاملة المرتبطة (اختياري)..."
                            className="w-full bg-slate-950/40 border border-white/5 p-3 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        {isSearchOpen && searchTerm && filteredLetters.length > 0 && (
                            <div className="absolute z-20 w-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                                {filteredLetters.map(l => (
                                    <button key={l.id} type="button" onClick={() => { updateState({ referenceId: l.id }); setIsSearchOpen(false); setSearchTerm(l.subject); }} className="w-full text-right p-4 hover:bg-white/5 border-b border-white/5 last:border-0">
                                        <p className="text-sm font-bold text-white">{l.subject}</p>
                                        <p className="text-[10px] text-slate-500 mt-1">{l.internalRefNumber} • {l.date}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="موضوع الخطاب الصادر" value={formState.subject} onChange={e => updateState({ subject: e.target.value })} placeholder="عنوان المعاملة..." ringColor={theme.ring} required />
                <InputField label="المرسل إليه (الجهة المستلمة)" value={formState.to} onChange={e => updateState({ to: e.target.value })} placeholder="اسم الوزارة أو الشركة أو الشخص..." ringColor={theme.ring} required />
                
                <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-300">نسخة إلى (CC)</label>
                    <MultiSelectCombobox options={allEntities} selectedItems={formState.cc} onChange={items => updateState({ cc: items })} ringColor={theme.ring} placeholder="إدارات أو جهات أخرى..." />
                </div>
                
                <InputField label="تاريخ التحرير (المكتوب في الخطاب)" type="date" value={formState.dateSent} onChange={e => updateState({ dateSent: e.target.value })} ringColor={theme.ring} />
                <InputField label="رقم الصادر اليدوي (إن وجد)" value={formState.externalRefNumber} onChange={e => updateState({ externalRefNumber: e.target.value })} placeholder="الرقم المسجل على الورقة..." ringColor={theme.ring} />
                <SelectField label="نوع الخطاب" value={formState.letterType} onChange={e => updateState({ letterType: e.target.value as LetterType })} options={LetterType} ringColor={theme.ring} />
                <InputField label="الفئة (التصنيف)" value={formState.category} onChange={e => updateState({ category: e.target.value })} placeholder="مثال: عقود، شكاوى..." ringColor={theme.ring} />
                <SelectField label="مستوى الأهمية" value={formState.priority} onChange={e => updateState({ priority: e.target.value as PriorityLevel })} options={PriorityLevel} ringColor={theme.ring} />
            </div>

            <TextAreaField label="ملاحظات الأرشفة" value={formState.notes} onChange={e => updateState({ notes: e.target.value })} placeholder="أي ملاحظات إضافية حول كيفية إرسال الخطاب أو ظروفه..." ringColor={theme.ring} />

            <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-300">المرفقات والنسخة الضوئية</label>
                <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center bg-white/5 hover:bg-white/10 transition-all cursor-pointer relative group">
                    <input type="file" multiple onChange={e => e.target.files && updateState({ attachments: [...formState.attachments, ...Array.from(e.target.files)] })} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-400 group-hover:scale-110 transition-transform"><CheckCircleIcon className="w-8 h-8" /></div>
                        <p className="text-slate-400 font-bold">اسحب المرفقات هنا أو انقر للاختيار</p>
                        <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">PDF, JPG, PNG, TIFF</p>
                    </div>
                </div>
                {formState.attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {formState.attachments.map((f, i) => (
                            <div key={i} className="bg-slate-900 border border-white/5 p-3 rounded-xl flex items-center justify-between shadow-lg">
                                <span className="text-xs text-slate-300 font-bold truncate pr-2">{f.name}</span>
                                <button type="button" onClick={() => updateState({ attachments: formState.attachments.filter((_, idx) => idx !== i) })} className="text-rose-400 hover:text-rose-500 font-black text-xs px-2">حذف</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-6">
                <button type="submit" disabled={isScanning} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-3xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
                    <CheckCircleIcon className="w-7 h-7" />
                    <span>إتمام الأرشفة والتسجيل</span>
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
