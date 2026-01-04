
import React, { useState } from 'react';
import { LetterType, Tone } from '../types';
import { toast } from 'react-hot-toast';
import { useApp } from '../App';
import { getThemeClasses } from './utils';

const InputField = ({ label, value, onChange, placeholder, ringColor }: {label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, ringColor: string}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium transition-all`}
      />
    </div>
);

const TextAreaField = ({ label, value, onChange, placeholder, rows, ringColor }: {label: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, rows?: number, ringColor: string}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <textarea
        rows={rows || 4}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium transition-all`}
      ></textarea>
    </div>
);
  
const SelectField = <T extends string>({ label, value, onChange, options, ringColor }: {label: string, value: T, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: object, ringColor: string}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <select 
        value={value}
        onChange={onChange}
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium transition-all`}
      >
        {Object.entries(options).filter(([key]) => isNaN(Number(key))).map(([key, val]) => <option key={key} value={val} className="bg-slate-900">{val}</option>)}
      </select>
    </div>
);

export default function TemplateCreator() {
  const { state, dispatch } = useApp();
  const { companySettings: settings } = state;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [letterType, setLetterType] = useState<LetterType>(LetterType.REQUEST);
  const [tone, setTone] = useState<Tone>(Tone.NEUTRAL);
  const [objectiveTemplate, setObjectiveTemplate] = useState('');
  const theme = getThemeClasses(settings.primaryColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !category.trim() || !objectiveTemplate.trim()) {
      toast.error('الرجاء تعبئة جميع الحقول لإنشاء القالب.');
      return;
    }
    
    dispatch({
        type: 'CREATE_TEMPLATE',
        payload: { title, description, category, letterType, tone, objectiveTemplate }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-black text-white mb-1">إنشاء قالب خطاب جديد</h2>
      <p className="text-slate-400 font-bold mb-6">صمم قوالب مخصصة قابلة لإعادة الاستخدام لتسريع عملك المستقبلي.</p>
      
      <form onSubmit={handleSubmit} className="bg-slate-900/60 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/10 space-y-6">
        <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 mb-4">معلومات القالب</h3>
        
        <InputField 
            label="عنوان القالب"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="مثال: طلب موافقة على إجازة طارئة"
            ringColor={theme.ring}
        />

        <TextAreaField
            label="وصف القالب"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="اشرح باختصار متى يتم استخدام هذا القالب."
            ringColor={theme.ring}
        />
        
        <InputField 
            label="فئة القالب"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="مثال: شؤون موظفين، إدارة مالية"
            ringColor={theme.ring}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectField label="نوع الخطاب الافتراضي" value={letterType} onChange={(e) => setLetterType(e.target.value as LetterType)} options={LetterType} ringColor={theme.ring} />
            <SelectField label="نغمة الخطاب الافتراضية" value={tone} onChange={(e) => setTone(e.target.value as Tone)} options={Tone} ringColor={theme.ring}/>
        </div>
        
        <TextAreaField
            label="نص الهدف من الخطاب (Template)"
            value={objectiveTemplate}
            onChange={e => setObjectiveTemplate(e.target.value)}
            placeholder="اكتب هنا المحتوى الأساسي للخطاب. استخدم أقواس مربعة [] للمتغيرات التي سيتم ملؤها لاحقًا. مثال: أطلب منكم الموافقة على إجازة طارئة لمدة [عدد الأيام] يومًا، ابتداءً من تاريخ [تاريخ البداية]."
            rows={10}
            ringColor={theme.ring}
        />
        
        <div className="pt-4 text-center">
          <button
            type="submit"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 font-bold shadow-lg"
          >
            <span>حفظ القالب الجديد</span>
          </button>
        </div>
      </form>
    </div>
  );
}
