
import React, { useState } from 'react';
import { View, UserRole } from '../types';
import { useApp } from '../App';
import { getThemeClasses } from './utils';


const TemplateLibrary = () => {
  const { state, dispatch } = useApp();
  const { templates, companySettings: settings, currentUser } = state;

  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const theme = getThemeClasses(settings.primaryColor);
  const canCreate = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.CREATOR;

  const categories = ['الكل', ...Array.from(new Set(templates.map(t => t.category)))];
  
  const filteredTemplates = selectedCategory === 'الكل' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-white">مكتبة الخطابات السياقية</h2>
        <p className="text-lg font-bold text-slate-400 mt-2 max-w-3xl mx-auto">
          انطلق من نقطة قوة. اختر قالبًا ذكيًا مصممًا لمواقف إدارية محددة، أو أنشئ قوالب خاصة بك لتناسب احتياجات عملك المتكررة.
        </p>
      </div>
      
      {canCreate && (
          <div className="mb-8 text-center">
            <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: View.TEMPLATE_CREATOR })}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 shadow-lg hover:shadow-xl font-bold`}
            >
            <span className="font-bold">إنشاء قالب جديد</span>
            </button>
        </div>
      )}


      <div className="flex justify-center mb-8">
        <div className="flex items-center p-1 bg-slate-900/50 rounded-lg border border-white/10">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${
                selectedCategory === category
                  ? `bg-white/10 text-white shadow`
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(template => (
          <div key={template.id} className="bg-slate-900/40 backdrop-blur-sm rounded-lg shadow-lg border border-white/10 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 hover:border-white/20">
            <div className="p-6 flex-grow">
              <span className={`inline-block px-3 py-1 text-xs font-bold ${theme.text} bg-white/5 rounded-full mb-3 border border-white/5`}>
                {template.category}
              </span>
              <h3 className="text-lg font-black text-white">{template.title}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-400 leading-relaxed">{template.description}</p>
            </div>
            <div className="bg-white/5 p-4 border-t border-white/5">
              <button
                onClick={() => dispatch({ type: 'SELECT_TEMPLATE', payload: template })}
                className={`w-full px-4 py-2 text-sm font-bold text-white ${theme.bg} rounded-md ${theme.hoverBg} transition-colors focus:outline-none focus:ring-2 ${theme.ring} focus:ring-offset-2 shadow-md`}
              >
                استخدام هذا القالب
              </button>
            </div>
          </div>
        ))}
         {filteredTemplates.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3 text-center py-10 text-slate-500">
                <p className="font-bold">لا توجد قوالب في هذه الفئة.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default TemplateLibrary;
