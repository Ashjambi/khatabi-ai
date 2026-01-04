
import React from 'react';
import { useApp } from '../App';
import { getThemeClasses } from './utils';

const AIPersonalization = (): React.ReactNode => {
  const { state, dispatch } = useApp();
  const { learnedPrinciples, companySettings: settings } = state;
  const theme = getThemeClasses(settings.primaryColor);

  const onDeletePrinciple = (id: string) => {
    dispatch({ type: 'DELETE_PRINCIPLE', payload: id });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
            <span>تخصيص الذكاء الاصطناعي</span>
        </h2>
        <p className="text-slate-400 mt-2">
            هنا، يقوم النظام بتسجيل "قواعد التخصيص" التي يتعلمها من تعديلاتك على الخطابات. هذه القواعد تساعد الذكاء الاصطناعي على تكييف أسلوبه ليطابق تفضيلاتك في المرات القادمة.
        </p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/10">
        <h3 className="text-xl font-semibold text-white mb-4">قائمة القواعد المكتسبة</h3>
        {learnedPrinciples.length > 0 ? (
            <ul className="space-y-4">
                {learnedPrinciples.map(principle => (
                    <li key={principle.id} className="p-4 bg-slate-800/50 rounded-md border border-white/5 flex justify-between items-start gap-4">
                        <div className="flex-grow">
                            <p className="text-slate-200 font-medium">{principle.text}</p>
                            <p className="text-xs text-slate-500 mt-1">تم تعلمها بتاريخ: {principle.createdAt}</p>
                        </div>
                        <button 
                            onClick={() => onDeletePrinciple(principle.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors flex-shrink-0 font-bold"
                            title="حذف هذه القاعدة"
                        >
                            X
                        </button>
                    </li>
                ))}
            </ul>
        ) : (
            <div className="text-center py-10 text-slate-500">
                <p>لم يتم تعلم أي قواعد تخصيص بعد.</p>
                <p className="text-sm mt-1">ابدأ بتحرير الخطابات التي يتم إنشاؤها لتعليم النظام أسلوبك المفضل.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AIPersonalization;
