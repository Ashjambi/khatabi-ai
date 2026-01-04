
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

  // Filter letters for linking
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

    const isTiff = file.type.startsWith('image/tif') || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');
    const isSupportedImage = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'].includes(file.type);
    const isPdf = file.type === 'application/pdf';

    if (!isTiff && !isSupportedImage && !isPdf) {
        toast.error("يرجى اختيار ملف صورة مدعوم (PNG, JPG, TIF) أو ملف PDF للتحليل.");
        if (e.target) e.target.value = '';
        return;
    }

    if (!attachments.some(existingFile => existingFile.name === file.name && existingFile.size === file.size && existingFile.lastModified === file.lastModified)) {
        updateState({ attachments: [file, ...attachments] });
        toast(`تم إرفاق "${file.name}" للمعاملة.`);
    }

    setIsScanning(true);
    
    try {
        let base64Data: string;
        let mimeType: string;
        
        if (isTiff) {
            const arrayBuffer = await file.arrayBuffer();
            const tiff = new Tiff({ buffer: arrayBuffer });
            const canvas = tiff.toCanvas();
            if (!canvas) throw new Error("Could not convert TIFF file.");
            const dataUrl = canvas.toDataURL('image/png');
            [, base64Data] = dataUrl.split(',');
            mimeType = 'image/png';
        } else {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
            const [header, data] = dataUrl.split(',');
            const matchedMime = header.match(/:(.*?);/)?.[1];
            if (!matchedMime || !data) throw new Error("Invalid file format.");
            base64Data = data;
            mimeType = matchedMime;
        }

        const letterTypes = Object.values(LetterType) as string[];
        const priorityLevels = Object.values(PriorityLevel) as string[];
        const confidentialityLevels = Object.values(ConfidentialityLevel) as string[];
        const allCategories = [...new Set(letters.map(l => l.category).filter((c): c is string => !!c))] as string[];
        
        // Prepare context for AI
        const existingLettersForScan = letters.map(l => ({
            id: l.id,
            subject: l.subject,
            internalRefNumber: l.internalRefNumber,
            externalRefNumber: l.externalRefNumber,
            date: l.date
        }));

        const extractedData = await extractDetailsFromLetterImage(base64Data, mimeType, settings.departments, letterTypes, priorityLevels, confidentialityLevels, allCategories, existingLettersForScan);
        
        const updates: Partial<InboundLetterFormState> = {};
        if (extractedData.subject) updates.subject = extractedData.subject;
        if (extractedData.from) updates.from = extractedData.from;
        if (extractedData.to) updates.to = extractedData.to; 
        if (extractedData.externalRefNumber) updates.externalRefNumber = extractedData.externalRefNumber;
        if(extractedData.letterType && Object.values(LetterType).includes(extractedData.letterType as any)) {
            updates.letterType = extractedData.letterType as LetterType;
        }
        if (extractedData.category) updates.category = extractedData.category;
        if (extractedData.summary) updates.summary = extractedData.summary;
        if (extractedData.priority) updates.priority = extractedData.priority as PriorityLevel;
        if (extractedData.confidentiality) updates.confidentiality = extractedData.confidentiality as ConfidentialityLevel;
        
        // --- Enhanced Linking Logic ---
        let linked = false;

        // 1. Direct ID Match from AI (Strongest)
        if (extractedData.referenceId) {
             const parent = letters.find(l => l.id === extractedData.referenceId);
             if (parent) {
                 updates.referenceId = extractedData.referenceId;
                 updates.letterType = LetterType.SUPPLEMENTARY;
                 toast.success(`تم الربط آلياً بالمعاملة المرجعية: ${parent.subject}`, { icon: '🔗' });
                 linked = true;
             }
        }

        // 2. Fallback: Fuzzy matching using extracted text number (If AI failed to map ID)
        if (!linked && extractedData.referencedNumber) {
             // Clean the number: remove spaces, 'No', 'Ref', special chars
             const cleanRef = extractedData.referencedNumber.replace(/[^0-9a-zA-Z\u0660-\u0669]/g, ''); 
             
             if (cleanRef.length > 2) {
                 const parent = letters.find(l => {
                     const lExt = (l.externalRefNumber || '').replace(/[^0-9a-zA-Z\u0660-\u0669]/g, '');
                     const lInt = (l.internalRefNumber || '').replace(/[^0-9a-zA-Z\u0660-\u0669]/g, '');
                     return lExt.includes(cleanRef) || lInt.includes(cleanRef);
                 });
                 if (parent) {
                     updates.referenceId = parent.id;
                     updates.letterType = LetterType.SUPPLEMENTARY;
                     toast.success(`تم العثور على معاملة مطابقة للرقم ${extractedData.referencedNumber}`, { icon: '🔗' });
                     linked = true;
                 }
             }
        }
        
        if (extractedData.date) {
            try {
                const parsedDate = new Date(extractedData.date);
                if (!isNaN(parsedDate.getTime())) {
                  updates.dateReceived = extractedData.date;
                }
            } catch (error) {
                console.warn("Could not parse extracted date:", extractedData.date);
            }
        }
        
        updateState(updates);
        toast.success("تم استخلاص البيانات بنجاح! يرجى مراجعتها.");

    } catch(error) {
        console.error(error);
        toast.error("حدث خطأ أثناء معالجة الصورة.");
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
        const type: Attachment['type'] = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.includes('word') ? 'word' : 'other';
        return {
            id: `in_att_${Date.now()}_${index}`,
            name: file.name,
            type,
            url: url,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
        };
    });

    const newAttachments: Attachment[] = await Promise.all(attachmentPromises);

    const newLetterData = {
      subject, from, to, type: letterType, cc,
      date: dateReceived, attachments: newAttachments, externalRefNumber, priority, confidentiality,
      completionDays: completionDays ? Number(completionDays) : undefined,
      notes, category, summary, referenceId,
    };
    
    dispatch({ type: 'REGISTER_INBOUND', payload: newLetterData });
  };
  

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-2xl font-bold text-white">تسجيل خطاب وارد جديد</h2>
        <button
            onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })}
            className="btn-3d-secondary inline-flex items-center gap-2 px-3 py-1.5 text-sm text-rose-300 font-bold border border-rose-500/30 hover:bg-rose-500/20"
            title="مسح جميع الحقول والبدء من جديد"
        >
            مسح النموذج
        </button>
      </div>
      <p className="text-slate-400 font-bold mb-6">أدخل بيانات الخطاب الوارد يدويًا أو استخدم المسح الضوئي الذكي لتعبئة الحقول تلقائيًا.</p>
      
      <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/10">
        <div className="flex justify-center mb-6">
            <button
                onClick={() => aiScanInputRef.current?.click()}
                disabled={isScanning}
                className={`w-full md:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-wait shadow-lg ${isScanning ? 'bg-slate-500' : `${theme.bg} ${theme.hoverBg} ${theme.ring}`} `}
            >
                 {isScanning ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span className="font-bold">جاري المسح الضوئي...</span>
                    </>
                 ) : (
                    <>
                        <span className="text-lg font-bold">المسح الضوئي الذكي (OCR)</span>
                    </>
                 )}
            </button>
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/tiff,image/webp,image/heic,image/heif" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" />
        </div>
        
        {summary && (
             <div className="my-6 p-4 bg-amber-900/20 border-r-4 border-amber-500 rounded-md">
                <div className="flex">
                    <div className="mr-3 flex-1">
                        <h3 className="text-sm font-bold text-amber-400 mb-1">ملخص الإجراء المقترح</h3>
                        <p className="text-sm font-semibold text-amber-200">{summary}</p>
                    </div>
                </div>
            </div>
        )}
        
        <div className="text-center mb-6">
            <p className="text-sm font-bold text-slate-500">أو قم بتعبئة البيانات يدويًا:</p>
            <hr className="mt-2 border-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Linking Section - Professional Layout */}
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        ربط بمعاملة سابقة (للمعاملات الإلحاقية)
                    </h3>
                    {selectedParentLetter && (
                        <button 
                            type="button" 
                            onClick={() => updateState({ referenceId: undefined })}
                            className="text-xs text-rose-400 hover:text-rose-300 font-bold underline"
                        >
                            إلغاء الربط
                        </button>
                    )}
                </div>
                
                {selectedParentLetter ? (
                    <div className="flex items-center gap-3 bg-indigo-500/20 p-3 rounded border border-indigo-500/30">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-white">مرتبط بـ: {selectedParentLetter.subject}</p>
                            <p className="text-xs text-indigo-200 mt-0.5">
                                {selectedParentLetter.internalRefNumber ? `رقم المعاملة: ${selectedParentLetter.internalRefNumber}` : `التاريخ: ${selectedParentLetter.date}`}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }}
                            onFocus={() => setIsSearchOpen(true)}
                            onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                            placeholder="ابحث عن الخطاب الأصلي برقم المعاملة أو الموضوع..."
                            className="w-full px-4 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        
                        {isSearchOpen && searchTerm && filteredLetters.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-white/10 rounded-md shadow-xl max-h-48 overflow-y-auto">
                                {filteredLetters.map(l => (
                                    <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => {
                                            updateState({ referenceId: l.id });
                                            setSearchTerm('');
                                        }}
                                        className="w-full text-right px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-start gap-3"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-slate-200 truncate">{l.subject}</p>
                                            <p className="text-xs text-slate-500">
                                                {l.correspondenceType === CorrespondenceType.INBOUND ? 'وارد' : 'صادر'} | {l.date} | {l.internalRefNumber || 'بدون رقم'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <p className="text-xs text-slate-500 mt-2 font-medium">سيتم عرض هذا الخطاب الإلحاقي ضمن سلسلة المراسلات الخاصة بالمعاملة الأصلية.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="الموضوع" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} placeholder="موضوع الخطاب الوارد" disabled={isScanning} required />
                <InputField label="الجهة الوارد منها (من)" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} placeholder="اسم الجهة أو الشخص" disabled={isScanning} required/>
                
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">موجه إلى (القسم)</label>
                  <input
                    list="departments-list"
                    value={to}
                    onChange={(e) => updateState({ to: e.target.value })}
                    className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${theme.ring} sm:text-sm font-medium transition-all`}
                    placeholder="اكتب اسم القسم أو اختر من القائمة..."
                    disabled={isScanning}
                    required
                  />
                  <datalist id="departments-list">
                    {settings.departments.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">نسخة إلى (CC)</label>
                    <MultiSelectCombobox
                        options={allRecipients}
                        selectedItems={cc}
                        onChange={(newCc) => updateState({ cc: newCc })}
                        placeholder="اختر الأقسام أو الجهات..."
                        ringColor={theme.ring}
                        disabled={isScanning}
                    />
                </div>
                
                <InputField label="تاريخ الاستلام" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} disabled={isScanning} />
                <InputField label="رقم الخطاب المرجعي" value={externalRefNumber} onChange={(e) => updateState({ externalRefNumber: e.target.value })} placeholder="الرقم المرجعي على الخطاب الوارد" ringColor={theme.ring} disabled={isScanning} />

                <SelectField label="نوع المعاملة" value={letterType} onChange={(e) => updateState({ letterType: e.target.value as LetterType })} options={LetterType} ringColor={theme.ring} disabled={isScanning} />
                <InputField label="الفئة المقترحة" value={category} onChange={(e) => updateState({ category: e.target.value })} placeholder="الفئة التي حددها الذكاء الاصطناعي" ringColor={theme.ring} disabled={isScanning} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SelectField label="مستوى الأهمية" value={priority} onChange={(e) => updateState({ priority: e.target.value as PriorityLevel })} options={PriorityLevel} ringColor={theme.ring} disabled={isScanning} />
                <SelectField label="مستوى السرية" value={confidentiality} onChange={(e) => updateState({ confidentiality: e.target.value as ConfidentialityLevel })} options={ConfidentialityLevel} ringColor={theme.ring} disabled={isScanning} />
                <InputField label="أيام الإنجاز" value={completionDays} onChange={(e) => updateState({ completionDays: e.target.value === '' ? '' : parseInt(e.target.value) })} type="number" placeholder="عدد أيام الإنجاز المتوقعة" ringColor={theme.ring} disabled={isScanning} />
            </div>

            <TextAreaField 
                label="ملاحظات" value={notes} onChange={e => updateState({ notes: e.target.value })}
                placeholder="أضف ملاحظات أو تعليمات بخصوص هذا الخطاب" ringColor={theme.ring} disabled={isScanning}
            />

            <div className="mt-4">
                <label className="block text-sm font-bold text-slate-300 mb-2">المرفقات</label>
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white/5 hover:bg-white/10 border-2 border-dashed border-slate-600 rounded-md p-4 text-center block w-full transition-colors">
                    <span className={`mt-2 block text-sm font-bold ${theme.text}`}>انقر هنا لإضافة مرفقات إضافية</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} />
                </label>
                {attachments.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-bold text-slate-400">الملفات المرفقة:</h4>
                        <ul className="mt-2 space-y-2">
                            {attachments.map((file, index) => (
                                <li key={index} className="flex items-center justify-between p-2 pl-3 bg-slate-800/50 rounded-md text-sm border border-white/5">
                                    <span className="text-slate-300 font-bold truncate pr-2">{file.name}</span>
                                    <button type="button" onClick={() => removeAttachment(index)} className="text-rose-400 hover:text-rose-500 flex-shrink-0 font-bold" title="إزالة المرفق">
                                        حذف
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="pt-4 text-center">
                <button
                    type="submit" disabled={isScanning}
                    className={`w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg`}
                >
                    تسجيل الخطاب الوارد
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
