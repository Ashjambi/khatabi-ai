
import React, { useState, useRef, useEffect } from 'react';
import { CompanySettings, Letter } from '../types';
import { toast } from 'react-hot-toast';
import { useApp } from '../App';
import { FileSystemService } from '../services/fileSystemService';

interface SettingsCardProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, children }) => (
    <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/10">
        <h3 className="text-xl font-black text-white border-b border-white/10 pb-3">{title}</h3>
        <p className="text-sm font-semibold text-slate-400 mt-3 mb-6">{description}</p>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);

const InputField: React.FC<{ label: string; name: keyof CompanySettings; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string, required?: boolean }> = ({ label, name, value, onChange, placeholder, required = false }) => (
    <div>
        <label htmlFor={name as string} className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
        <input 
            type="text" 
            id={name as string}
            name={name as string}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm font-bold transition-all"
        />
    </div>
);

export default function Settings() {
    const { state, dispatch } = useApp();
    const { companySettings: settings, letters } = state;

    const [localSettings, setLocalSettings] = useState<CompanySettings>(settings);
    const [newDepartment, setNewDepartment] = useState('');
    const folderInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setLocalSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: localSettings });
        toast.success('تم حفظ الإعدادات بنجاح.');
    };

    const handleExportBackup = () => {
        if (letters.length === 0) {
            toast.error("لا توجد خطابات لتصديرها.");
            return;
        }
        FileSystemService.exportAllLetters(letters);
        toast.success("تم تجهيز ملف النسخة الاحتياطية.");
    };

    const handleImportFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const loadingToast = toast.loading("جاري قراءة الملفات من المجلد...");
            try {
                const importedLetters = await FileSystemService.processUploadedFiles(e.target.files);
                if (importedLetters.length > 0) {
                    importedLetters.forEach(l => {
                        dispatch({ type: 'UPDATE_LETTER', payload: l });
                    });
                    toast.success(`تم استيراد ${importedLetters.length} خطاب بنجاح!`, { id: loadingToast });
                } else {
                    toast.error("لم يتم العثور على ملفات خطابات مدعومة في المجلد.", { id: loadingToast });
                }
            } catch (err) {
                toast.error("حدث خطأ أثناء الاستيراد.", { id: loadingToast });
            }
            if (e.target) e.target.value = '';
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-black text-white">إعدادات النظام</h2>
                    <p className="text-slate-400 font-bold mt-2">تخصيص الهوية وإدارة بيانات الأرشيف.</p>
                </div>
                <button onClick={handleSave} className="btn-3d bg-indigo-600 px-6 py-2 text-white font-bold">حفظ التغييرات</button>
            </div>
            
            <SettingsCard title="إدارة البيانات والأرشفة" description="استخدم هذه الأدوات لنقل بياناتك من وإلى جهازك الشخصي بسهولة وبشكل آمن.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition-all group">
                        <h4 className="font-bold text-white mb-2">استيراد من مجلد محلي</h4>
                        <p className="text-xs text-slate-500 mb-4 leading-relaxed">اختر مجلداً يحتوي على ملفات JSON (الأرشيف السابق) لرفعها للنظام مرة واحدة.</p>
                        <input 
                            type="file" 
                            ref={folderInputRef} 
                            onChange={handleImportFolder} 
                            className="hidden" 
                            /* @ts-ignore - webkitdirectory is a non-standard attribute but widely supported */
                            webkitdirectory="true" 
                            directory="true"
                            multiple
                        />
                        <button 
                            onClick={() => folderInputRef.current?.click()}
                            className="w-full py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl font-bold text-sm hover:bg-indigo-600 hover:text-white transition-all"
                        >
                            فتح المجلد للاستيراد
                        </button>
                    </div>

                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:border-emerald-500/30 transition-all group">
                        <h4 className="font-bold text-white mb-2">تصدير الأرشيف بالكامل</h4>
                        <p className="text-xs text-slate-500 mb-4 leading-relaxed">حمل كافة الخطابات المسجلة في النظام في ملف واحد للنسخ الاحتياطي.</p>
                        <button 
                            onClick={handleExportBackup}
                            className="w-full py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-sm hover:bg-emerald-600 hover:text-white transition-all"
                        >
                            تحميل نسخة احتياطية
                        </button>
                    </div>
                </div>
                <div className="p-4 bg-amber-900/10 border-r-4 border-amber-500 rounded-lg">
                    <p className="text-xs text-amber-200 font-medium leading-relaxed">
                        <strong>ملاحظة:</strong> النظام يحفظ بياناتك تلقائياً في ذاكرة المتصفح. استخدم "التصدير" دورياً لضمان بقاء نسخة من خطاباتك على قرصك الصلب بشكل دائم.
                    </p>
                </div>
            </SettingsCard>

            <SettingsCard title="الهوية المرئية" description="تعديل اسم وشعار المنشأة.">
                <InputField label="اسم المكتب / الشركة" name="companyName" value={localSettings.companyName} onChange={handleChange} placeholder="مثال: مكتب المدير العام" />
                
                <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">شعار المنشأة</label>
                    <div className="flex items-center gap-6">
                        {localSettings.companyLogo ? (
                            <img src={localSettings.companyLogo} alt="Logo" className="h-20 w-20 object-contain bg-white/5 p-2 rounded-xl border border-white/10" />
                        ) : (
                            <div className="h-20 w-20 bg-slate-800 rounded-xl border border-dashed border-slate-600 flex items-center justify-center text-slate-500 font-bold text-xs">لا يوجد شعار</div>
                        )}
                        <input type="file" accept="image/*" ref={logoInputRef} onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                                 const reader = new FileReader();
                                 reader.onloadend = () => setLocalSettings(prev => ({ ...prev, companyLogo: reader.result as string }));
                                 reader.readAsDataURL(file);
                             }
                        }} className="hidden" />
                        <button onClick={() => logoInputRef.current?.click()} className="text-indigo-400 hover:text-white font-bold text-sm underline decoration-indigo-500/30 underline-offset-4">تحديث الشعار</button>
                    </div>
                </div>
            </SettingsCard>
        </div>
    );
}
