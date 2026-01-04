
import React, { useState, useMemo, useEffect } from 'react';
import { Letter, CorrespondenceType, LetterStatus, CompanySettings, UserRole, PriorityLevel, ConfidentialityLevel, SmartSearchResult } from '../types';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, getConfidentialityChip, getVisibleLetters } from './utils';
import { LayoutTemplateIcon, ListIcon, EyeIcon, SearchIcon, FilterIcon, XCircleIcon, SparklesIcon, BotIcon, ClockIcon, SendIcon, InboxInIcon } from './icons';
import { searchLettersSmartly } from '../services/geminiService';
import { toast } from 'react-hot-toast';

export default function Archive(): React.ReactNode {
  const { state, dispatch } = useApp();
  const { letters: allLetters, companySettings: settings, currentUser } = state;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [previewId, setPreviewId] = useState<string | null>(null);
  
  const [searchQuery, setSearchTerm] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<SmartSearchResult[] | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
      startDate: '',
      endDate: '',
      type: 'all',
      status: 'all',
      priority: 'all',
      confidentiality: 'all',
  });

  const theme = getThemeClasses(settings.primaryColor);
  const visibleLetters = useMemo(() => getVisibleLetters(allLetters, currentUser), [allLetters, currentUser]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setAiResults(null);
    setFilters({
        startDate: '',
        endDate: '',
        type: 'all',
        status: 'all',
        priority: 'all',
        confidentiality: 'all',
    });
    toast.success("تم إعادة تعيين الفلاتر");
  };

  const handleAiSearch = async () => {
      if (!searchQuery.trim()) {
          toast.error("الرجاء إدخال نص للبحث الذكي.");
          return;
      }
      setIsAiSearching(true);
      setAiResults(null);
      try {
          // الذكاء الاصطناعي يبحث في الموضوع، الرقم، والمتن
          const results = await searchLettersSmartly(searchQuery, visibleLetters);
          setAiResults(results);
          if (results.length === 0) {
              toast("لم يتم العثور على نتائج سياقية مطابقة.", { icon: '🤖' });
          } else {
              toast.success(`تم العثور على ${results.length} نتائج مرتبطة.`);
          }
      } catch (e: any) {
          toast.error(`خطأ في البحث الذكي: ${e.message}`);
      } finally {
          setIsAiSearching(false);
      }
  };

  const filteredLetters = useMemo(() => {
    // إذا كانت هناك نتائج AI، فهي التي تحدد القائمة الأساسية
    let baseSet = visibleLetters;
    if (aiResults) {
        const matchingIds = new Set(aiResults.map(r => r.letterId));
        baseSet = visibleLetters.filter(l => matchingIds.has(l.id));
    }

    return baseSet.filter(letter => {
      // البحث النصي المحلي (كخلفية إذا لم يتم استخدام AI Search)
      if (!aiResults && searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const inSubject = letter.subject.toLowerCase().includes(q);
          const inRef = (letter.internalRefNumber || '').toLowerCase().includes(q) || (letter.externalRefNumber || '').toLowerCase().includes(q);
          const inBody = letter.body.replace(/<[^>]*>?/gm, ' ').toLowerCase().includes(q);
          const inParties = letter.from.toLowerCase().includes(q) || letter.to.toLowerCase().includes(q);
          if (!inSubject && !inRef && !inBody && !inParties) return false;
      }

      if (filters.type !== 'all') {
          if (filters.type === 'inbound' && letter.correspondenceType !== CorrespondenceType.INBOUND) return false;
          if (filters.type === 'outbound' && letter.correspondenceType !== CorrespondenceType.OUTBOUND) return false;
      }

      if (filters.status !== 'all' && letter.status !== filters.status) return false;
      if (filters.priority !== 'all' && letter.priority !== filters.priority) return false;
      if (filters.confidentiality !== 'all' && letter.confidentiality !== filters.confidentiality) return false;

      if (filters.startDate || filters.endDate) {
          try {
              const letterTime = new Date(letter.date.replace(/\//g, '-')).getTime();
              if (filters.startDate && letterTime < new Date(filters.startDate).getTime()) return false;
              if (filters.endDate && letterTime > new Date(filters.endDate).getTime()) return false;
          } catch(e) {}
      }

      return true;
    }).sort((a, b) => {
        const dateA = new Date(a.date.replace(/\//g, '-')).getTime();
        const dateB = new Date(b.date.replace(/\//g, '-')).getTime();
        return dateB - dateA;
    });
  }, [visibleLetters, searchQuery, filters, aiResults]);

  const previewLetter = allLetters.find(l => l.id === previewId);

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden gap-6">
      <div className={`flex-1 flex flex-col h-full space-y-4 transition-all duration-500 ${previewId ? 'w-2/3' : 'w-full'}`}>
          
          <div className="glass-card p-5 flex flex-col gap-4 rounded-3xl shrink-0 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/20 via-indigo-500/50 to-indigo-500/20"></div>
              
              <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full group">
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-500 group-focus-within:text-indigo-400">
                          <SearchIcon className="w-5 h-5" />
                      </div>
                      <input
                          type="text"
                          className="block w-full py-4 pr-12 pl-4 text-base text-white bg-slate-950/40 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold placeholder-slate-500 transition-all shadow-inner"
                          placeholder="ابحث بموضوع، رقم، أو سياق معنوي (مثال: معاملات الميزانية)..."
                          value={searchQuery}
                          onChange={(e) => {
                              setSearchTerm(e.target.value);
                              if (aiResults) setAiResults(null);
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                      />
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleAiSearch}
                          disabled={isAiSearching || !searchQuery.trim()}
                          className={`group relative flex items-center gap-2 px-6 py-4 rounded-2xl transition-all border font-black text-sm shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 ${isAiSearching ? 'bg-slate-700 border-white/10' : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white'}`}
                        >
                            {isAiSearching ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                <SparklesIcon className="w-5 h-5" />
                            )}
                            <span>{isAiSearching ? 'جاري التحليل...' : 'بحث ذكي (AI)'}</span>
                        </button>

                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          className={`p-4 rounded-2xl transition-all border ${showFilters ? 'bg-indigo-900/40 text-indigo-400 border-indigo-500/50' : 'bg-slate-900/60 text-slate-400 border-white/5 hover:text-white'}`}
                          title="فلاتر عميقة"
                        >
                          <FilterIcon className="w-5 h-5" />
                        </button>

                        <div className="flex bg-slate-950/50 rounded-2xl p-1 border border-white/5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <LayoutTemplateIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <ListIcon className="w-5 h-5" />
                            </button>
                        </div>
                  </div>
              </div>

              {showFilters && (
                  <div className="bg-slate-950/60 p-6 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">النوع</label>
                          <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-sm text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                              <option value="all">الكل</option>
                              <option value="inbound">وارد</option>
                              <option value="outbound">صادر</option>
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">الأهمية</label>
                          <select value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-sm text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                              <option value="all">الكل</option>
                              {Object.values(PriorityLevel).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">السرية</label>
                          <select value={filters.confidentiality} onChange={e => setFilters({...filters, confidentiality: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-sm text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                              <option value="all">الكل</option>
                              {Object.values(ConfidentialityLevel).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      <div className="space-y-2 lg:col-span-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">من تاريخ</label>
                          <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-sm text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="flex items-end">
                          <button onClick={handleResetFilters} className="w-full py-3.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-black transition-all">
                              إعادة تعيين البحث
                          </button>
                      </div>
                  </div>
              )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
              <div className="flex items-center justify-between px-2 mb-4">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-slate-400">
                        {aiResults ? 'نتائج البحث السياقي:' : 'نتائج البحث:'} <span className="text-white font-black">{filteredLetters.length}</span>
                    </p>
                    {aiResults && (
                        <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-3 py-1 rounded-full border border-indigo-500/30 flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                            <BotIcon className="w-4 h-4" />
                            تطابق ذكي
                        </span>
                    )}
                  </div>
              </div>

              {filteredLetters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-80 text-slate-500 bg-slate-900/20 rounded-[3rem] border border-dashed border-white/5 animate-in fade-in duration-700">
                      <SearchIcon className="w-16 h-16 opacity-10 mb-6" />
                      <p className="font-black text-xl">لا توجد معاملات مطابقة</p>
                      <p className="text-sm mt-2 text-slate-600">جرب استخدام "البحث الذكي" للعثور على المحتوى بالمعنى</p>
                  </div>
              ) : viewMode === 'list' ? (
                  <div className="space-y-3">
                      {filteredLetters.map(letter => {
                          const isSelected = previewId === letter.id;
                          const aiResult = aiResults?.find(r => r.letterId === letter.id);
                          return (
                            <div 
                                key={letter.id}
                                className={`group flex flex-col gap-3 p-5 rounded-3xl border transition-all duration-300 cursor-pointer ${isSelected ? 'bg-indigo-900/30 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' : 'bg-slate-900/40 border-white/5 hover:border-white/20 hover:bg-slate-800/60'}`}
                                onClick={() => setPreviewId(isSelected ? null : letter.id)}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${letter.correspondenceType === CorrespondenceType.OUTBOUND ? 'bg-indigo-500/10 text-indigo-400' : 'bg-fuchsia-500/10 text-fuchsia-400'}`}>
                                        {letter.correspondenceType === CorrespondenceType.OUTBOUND ? <SendIcon className="w-6 h-6" /> : <InboxInIcon className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-slate-500 font-mono tracking-widest">#{letter.internalRefNumber || '---'}</span>
                                            <span className="text-slate-700">•</span>
                                            <span className="text-[10px] font-black text-slate-500 flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3" />
                                                {letter.date}
                                            </span>
                                        </div>
                                        <p className="text-base font-black text-white truncate leading-tight">{letter.subject}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-xs text-slate-400 font-bold truncate">من: {letter.from}</span>
                                            <span className="text-slate-700">→</span>
                                            <span className="text-xs text-slate-400 font-bold truncate">إلى: {letter.to}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {getStatusChip(letter.status)}
                                        <div className="flex gap-1.5 scale-90 origin-right">
                                            {getPriorityChip(letter.priority)}
                                            {getConfidentialityChip(letter.confidentiality)}
                                        </div>
                                    </div>
                                </div>

                                {aiResult && (
                                    <div className="mt-2 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex gap-4 animate-in fade-in zoom-in-95 duration-500 group-hover:bg-indigo-500/15">
                                        <BotIcon className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-xs text-indigo-100 font-bold leading-relaxed">
                                                <span className="text-indigo-400 font-black ml-1">تطابق ذكي:</span>
                                                "{aiResult.relevanceReason}"
                                            </p>
                                            <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                                                <div className="bg-indigo-500 h-full shadow-[0_0_8px_rgba(99,102,241,1)] transition-all duration-1000" style={{ width: `${aiResult.confidenceScore * 100}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                          );
                      })}
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredLetters.map(letter => {
                          const isSelected = previewId === letter.id;
                          const aiResult = aiResults?.find(r => r.letterId === letter.id);
                          return (
                            <div 
                                key={letter.id} 
                                onClick={() => setPreviewId(isSelected ? null : letter.id)}
                                className={`relative p-6 rounded-[2.5rem] border transition-all cursor-pointer group overflow-hidden ${isSelected ? 'bg-indigo-900/30 border-indigo-500/50 shadow-2xl scale-[1.02]' : 'bg-slate-900/40 border-white/5 hover:border-indigo-500/30'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${letter.correspondenceType === CorrespondenceType.OUTBOUND ? 'bg-indigo-500/10 text-indigo-400' : 'bg-fuchsia-500/10 text-fuchsia-400'}`}>
                                        {letter.correspondenceType === CorrespondenceType.OUTBOUND ? 'صادر' : 'وارد'}
                                    </span>
                                    {getStatusChip(letter.status)}
                                </div>
                                <h3 className="text-lg font-black text-white mb-3 line-clamp-2 leading-relaxed h-14">{letter.subject}</h3>
                                
                                {aiResult ? (
                                    <div className="mb-4 bg-indigo-500/20 p-3 rounded-2xl text-[10px] text-indigo-100 font-bold border border-indigo-500/30 leading-relaxed">
                                        🤖 {aiResult.relevanceReason.substring(0, 80)}...
                                    </div>
                                ) : (
                                    <div className="h-10 mb-4 flex items-center gap-2 overflow-hidden">
                                        {getPriorityChip(letter.priority)}
                                        {getConfidentialityChip(letter.confidentiality)}
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5 text-[11px] font-bold">
                                    <span className="text-slate-500 font-mono tracking-tighter">{letter.date}</span>
                                    <span className="text-slate-400 truncate max-w-[100px]">{letter.from}</span>
                                </div>
                            </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>

      {previewId && previewLetter && (
          <div className="w-1/3 bg-[#020617] border-r border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col h-full animate-in slide-in-from-left-20 duration-500 z-20 rounded-l-[3rem] overflow-hidden shrink-0 border-l border-indigo-500/20">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/40">
                  <h3 className="font-black text-xl text-white">معاينة فورية</h3>
                  <button onClick={() => setPreviewId(null)} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all">
                      <XCircleIcon className="w-8 h-8" />
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-900/30">
                  <div className="flex flex-col gap-8">
                      <div className="space-y-5">
                          <div className="flex gap-2 flex-wrap">
                              {getStatusChip(previewLetter.status)}
                              {getPriorityChip(previewLetter.priority)}
                              {getConfidentialityChip(previewLetter.confidentiality)}
                          </div>
                          <h2 className="text-2xl font-black text-white leading-tight">{previewLetter.subject}</h2>
                          
                          <div className="grid grid-cols-2 gap-4 text-[11px] bg-indigo-500/5 p-5 rounded-[2rem] border border-indigo-500/10 shadow-inner">
                              <div>
                                  <span className="block text-indigo-400/60 font-black mb-1 uppercase tracking-widest">الرقم المرجعي</span>
                                  <span className="font-mono text-white text-base font-black tracking-widest">{previewLetter.internalRefNumber || '---'}</span>
                              </div>
                              <div>
                                  <span className="block text-indigo-400/60 font-black mb-1 uppercase tracking-widest">التاريخ</span>
                                  <span className="font-mono text-white text-base font-black">{previewLetter.date}</span>
                              </div>
                              <div className="col-span-2 mt-2 pt-3 border-t border-indigo-500/10">
                                  <span className="block text-indigo-400/60 font-black mb-2 uppercase tracking-widest">أطراف المراسلة</span>
                                  <div className="flex items-center gap-3">
                                      <span className="text-slate-300 font-bold truncate">{previewLetter.from}</span>
                                      <span className="text-indigo-500">→</span>
                                      <span className="text-slate-300 font-bold truncate">{previewLetter.to}</span>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="prose prose-invert prose-sm max-w-none bg-white/[0.02] p-8 rounded-[2rem] border border-white/5 text-slate-300 font-medium leading-loose shadow-xl relative min-h-[300px]">
                          <div className="absolute top-4 right-4 text-[8px] text-slate-700 font-black uppercase tracking-widest pointer-events-none">محتوى الخطاب الرقمي</div>
                          <div dangerouslySetInnerHTML={{ __html: previewLetter.body }} />
                      </div>

                      <div className="sticky bottom-0 pt-6 pb-2 mt-auto bg-gradient-to-t from-slate-900 to-transparent">
                          <button 
                              onClick={() => dispatch({ type: 'SELECT_LETTER', payload: previewLetter.id })}
                              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-lg shadow-[0_10px_30px_rgba(99,102,241,0.4)] transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0"
                          >
                              <EyeIcon className="w-6 h-6" />
                              فتح المعاملة لإتخاذ إجراء
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
