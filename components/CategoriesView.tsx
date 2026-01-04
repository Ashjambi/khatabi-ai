
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../App';
import { Letter, CorrespondenceType, LetterStatus } from '../types';
import { getThemeClasses, getStatusChip, getVisibleLetters } from './utils';
import { toast } from 'react-hot-toast';

const CategoriesView: React.FC = () => {
    const { state, dispatch } = useApp();
    const { letters: allLetters, companySettings, currentUser } = state;
    const letters = useMemo(() => getVisibleLetters(allLetters, currentUser), [allLetters, currentUser]);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const categories = useMemo(() => {
        const categoryCounts: { [key: string]: number } = {};
        letters.forEach(letter => {
            if (letter.category) {
                categoryCounts[letter.category] = (categoryCounts[letter.category] || 0) + 1;
            }
        });
        return Object.entries(categoryCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [letters]);

    const filteredLetters = useMemo(() => {
        if (!selectedCategory) {
            return [];
        }
        return letters.filter(l => l.category === selectedCategory);
    }, [letters, selectedCategory]);

    const theme = getThemeClasses(companySettings.primaryColor);

    const onSelectLetter = (id: string) => {
        dispatch({ type: 'SELECT_LETTER', payload: id });
    };
    
    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) {
            setSelectedCategory(categories[0].name);
        }
         if (selectedCategory && !categories.some(c => c.name === selectedCategory)) {
            setSelectedCategory(categories[0]?.name || null);
        }
    }, [categories, selectedCategory]);

    const handleStartEditing = (name: string) => {
        setEditingCategoryName(name);
        setNewCategoryName(name);
    };

    const handleCancelEditing = () => {
        setEditingCategoryName(null);
        setNewCategoryName('');
    };

    const handleSaveCategoryName = () => {
        if (!newCategoryName.trim() || newCategoryName.trim() === editingCategoryName) {
            handleCancelEditing();
            return;
        }

        if (editingCategoryName) {
            dispatch({
                type: 'UPDATE_CATEGORY_NAME',
                payload: { oldName: editingCategoryName, newName: newCategoryName.trim() }
            });
            // Update selected category if it was the one being edited
            if (selectedCategory === editingCategoryName) {
                setSelectedCategory(newCategoryName.trim());
            }
        }
        handleCancelEditing();
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
                 <h1 className="text-3xl font-black text-white">عرض حسب الفئة</h1>
            </div>
            <p className="text-slate-400 font-bold mb-8">تصفح المراسلات بناءً على الفئات المحددة، وقم بتعديل أسماء الفئات لتناسب تنظيم عملك.</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Categories List */}
                <div className="md:col-span-1">
                    <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-lg shadow-lg border border-white/10">
                        <h2 className="text-lg font-bold text-white mb-3">قائمة الفئات</h2>
                        <ul className="space-y-2">
                            {categories.map(({ name, count }) => (
                                <li key={name}>
                                    {editingCategoryName === name ? (
                                        <div className="p-2 bg-slate-800 rounded-md border-2 border-indigo-500 space-y-2">
                                            <input
                                                type="text"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                className="w-full px-2 py-1 bg-slate-950 text-white border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm font-bold"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveCategoryName();
                                                    if (e.key === 'Escape') handleCancelEditing();
                                                }}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleCancelEditing} className="px-3 py-1 text-xs font-bold text-slate-300 bg-white/10 hover:bg-white/20 rounded-md">إلغاء</button>
                                                <button onClick={handleSaveCategoryName} className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">حفظ</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group relative">
                                            <button
                                                onClick={() => setSelectedCategory(name)}
                                                className={`w-full text-right p-3 rounded-md transition-colors text-sm font-bold flex justify-between items-center ${selectedCategory === name ? `${theme.lightBg} ${theme.text} border border-transparent` : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'}`}
                                            >
                                                <span>{name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${selectedCategory === name ? `bg-white ${theme.text}` : 'bg-slate-800 text-slate-400'}`}>{count}</span>
                                            </button>
                                            <button
                                                onClick={() => handleStartEditing(name)}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-indigo-400 hover:bg-slate-700 transition-all focus:opacity-100 font-bold text-xs"
                                                title={`تعديل اسم فئة "${name}"`}
                                            >
                                                تعديل
                                            </button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                         {categories.length === 0 && <p className="text-sm font-bold text-slate-500 text-center py-4">لا توجد فئات بعد.</p>}
                    </div>
                </div>

                {/* Letters List */}
                <div className="md:col-span-3">
                    <div className="bg-slate-900/60 backdrop-blur-md rounded-lg shadow-lg border border-white/10 overflow-hidden">
                        <div className="p-4 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white">
                                خطابات فئة: <span className={theme.text}>{selectedCategory || 'الرجاء اختيار فئة'}</span>
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-black text-slate-400 uppercase">النوع</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-black text-slate-400 uppercase">الموضوع</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-black text-slate-400 uppercase">التاريخ</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-black text-slate-400 uppercase">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {selectedCategory && filteredLetters.map(letter => (
                                        <tr key={letter.id} onClick={() => onSelectLetter(letter.id)} className={`hover:bg-white/5 cursor-pointer transition-colors duration-150`}>
                                            <td className="px-6 py-4">
                                                {letter.correspondenceType === CorrespondenceType.OUTBOUND ?
                                                    <span className={`text-sm font-bold ${theme.text}`}>صادر</span> :
                                                    <span className="text-sm font-bold text-violet-400">وارد</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-white">{letter.subject}</p>
                                                <p className="text-xs font-semibold text-slate-400">{letter.correspondenceType === CorrespondenceType.OUTBOUND ? `إلى: ${letter.to}` : `من: ${letter.from}`}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-400">{letter.date}</td>
                                            <td className="px-6 py-4">
                                                {getStatusChip(letter.status)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {selectedCategory && filteredLetters.length === 0 && (
                                <div className="text-center py-10 text-slate-500 font-bold">
                                    <p>لا توجد خطابات في هذه الفئة.</p>
                                </div>
                            )}
                             {!selectedCategory && (
                                <div className="text-center py-10 text-slate-500 font-bold">
                                    <p>الرجاء اختيار فئة من القائمة لعرض الخطابات.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoriesView;
