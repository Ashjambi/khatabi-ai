
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Letter, LetterStatus, ApprovalRecord, CorrespondenceType, Attachment, User, Comment, PriorityLevel, ConfidentialityLevel, CompanySettings, View, EnhancementSuggestion, LetterType, SmartReply, Tone } from '../types';
import { toast } from 'react-hot-toast';
import { summarizeCorrespondenceThread, enhanceLetter, generateSmartReplies } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import DiffViewer from './DiffViewer';
import InboundCoverSheet from './InboundCoverSheet';
import OutboundLetterHeader from './OutboundLetterHeader';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, getConfidentialityChip, sanitizeHTML } from './utils';
import DeliveryReceipt from './DeliveryReceipt';
import ProofreadModal from './ProofreadModal';
import WorkflowTracker from './WorkflowTracker';
import { LinkIcon, InboxInIcon, ClockIcon, SendIcon, ArchiveIcon, CheckCircleIcon, XCircleIcon, ArrowRightLeftIcon, FileTextIcon, DownloadIcon, SparklesIcon, PrinterIcon, MessageSquareIcon } from './icons';
import { FileSystemService } from '../services/fileSystemService';

interface LetterDetailsProps {
  letter: Letter;
}

function dataURLtoBlob(dataurl: string): Blob | null {
    try {
        const arr = dataurl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Error converting data URL to blob", e);
        return null;
    }
}

const DetailItem = ({ label, value, children, fullWidth = false }: { label: string, value?: string | number, children?: React.ReactNode, fullWidth?: boolean }) => (
    <div className={fullWidth ? 'md:col-span-2 lg:col-span-3' : ''}>
        <p className="text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-widest">{label}</p>
        {value && <p className="font-black text-xl text-white break-words leading-tight">{value}</p>}
        {children && <div className="font-bold text-lg text-white">{children}</div>}
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

const PrintableLetter = ({ letter, settings }: { letter: Letter, settings: CompanySettings }) => {
    const watermarkText = `${letter.confidentiality === ConfidentialityLevel.TOP_SECRET ? "سري للغاية\n" : ""}${settings.companyName}\n${new Date().toLocaleString('ar-SA')}`;
    
    return (
        <>
            <div className="print-watermark">{watermarkText}</div>
            <div className="p-10 bg-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <div className="printable-header">
                    {letter.correspondenceType === CorrespondenceType.OUTBOUND && (
                        <OutboundLetterHeader letter={letter} settings={settings} />
                    )}
                </div>
                <div className="prose max-w-none prose-slate font-bold text-black text-xl" style={{fontSize: '1.25rem', lineHeight: '2'}} dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
                {letter.isSigned && (
                    <div className="mt-12 pt-6 border-t border-dashed">
                        <p className="text-lg text-emerald-700 font-black flex items-center gap-2">
                            <span>(تم التوقيع والمصادقة إلكترونياً)</span>
                        </p>
                    </div>
                )}
            </div>
        </>
    )
};

export default function LetterDetails({ letter }: LetterDetailsProps): React.ReactNode {
  const { state, dispatch } = useApp();
  const { letters: allLetters, companySettings: settings, comments } = state;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(letter.body);
  const [bodyBeforeEdit, setBodyBeforeEdit] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'comments' | 'history'>('content');
  const [newComment, setNewComment] = useState('');
  const [diffData, setDiffData] = useState<{ old: string; new: string } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editedCategory, setEditedCategory] = useState(letter.category || '');
  const [printableContent, setPrintableContent] = useState<React.ReactNode | null>(null);
  const [isPreviewingReceipt, setIsPreviewingReceipt] = useState(false);
  
  const [isProofreading, setIsProofreading] = useState(false);
  const [showProofreadModal, setShowProofreadModal] = useState(false);
  const [proofreadSuggestions, setProofreadSuggestions] = useState<EnhancementSuggestion[]>([]);

  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false);

  const printRoot = document.getElementById('print-root');

  const ActionButton: React.FC<{ text: string, onClick: () => void, colorClass: string, disabled?: boolean, isLoading?: boolean, icon?: React.ReactNode }> = ({ text, onClick, colorClass, disabled, isLoading, icon }) => (
    <button onClick={onClick} disabled={disabled || isLoading} className={`inline-flex items-center gap-3 px-6 py-3 text-sm font-black rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 ${colorClass}`}>
        {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : icon}
        <span>{text}</span>
    </button>
  );

  const handleFetchSmartReplies = useCallback(async () => {
      if (letter.correspondenceType !== CorrespondenceType.INBOUND) return;
      
      setIsLoadingSmartReplies(true);
      setSmartReplies([]);
      try {
          const replies = await generateSmartReplies(letter);
          setSmartReplies(replies);
      } catch (e) {
          console.error("Failed to load smart replies", e);
      } finally {
          setIsLoadingSmartReplies(false);
      }
  }, [letter.id]);

  useEffect(() => {
    setIsEditing(false);
    setEditedBody(letter.body);
    setActiveTab('content');
    setDiffData(null);
    setSummary(null);
    setNewComment('');
    setIsEditingCategory(false);
    setEditedCategory(letter.category || '');
    setPrintableContent(null);
    setIsPreviewingReceipt(false);
    setShowProofreadModal(false);

    const canShowSmartReplies = 
        letter.correspondenceType === CorrespondenceType.INBOUND && 
        letter.status !== LetterStatus.ARCHIVED && 
        letter.status !== LetterStatus.REPLIED;

    if (canShowSmartReplies) {
        handleFetchSmartReplies();
    } else {
        setSmartReplies([]);
    }
  }, [letter.id, handleFetchSmartReplies]);

  const handlePrint = () => {
    setPrintableContent(<PrintableLetter letter={letter} settings={settings} />);
  };

  const handleDownloadDigitalCopy = () => {
      FileSystemService.downloadLetterAsJson(letter);
      toast.success("تم تحميل النسخة الرقمية (JSON)");
  };

  const handlePrintCoverSheet = () => {
    setPrintableContent(<InboundCoverSheet letter={letter} settings={settings} />);
  };
  
  const handlePrintReceipt = () => {
    setPrintableContent(<DeliveryReceipt letter={letter} settings={settings} />);
    setIsPreviewingReceipt(false);
  }

  const handleViewAttachment = (att: Attachment) => {
    if (!att.url || att.url === '#') {
        toast('المعاينة غير متاحة للمرفقات التجريبية.', { icon: 'ℹ️' });
        return;
    }
    try {
        const blob = dataURLtoBlob(att.url);
        if (blob) {
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
        }
    } catch (e) {
        toast.error('حدث خطأ أثناء محاولة فتح المرفق.');
    }
  };

  const handleStatusChange = (newStatus: LetterStatus, actionText: string, notes?: string) => {
    const newHistoryRecord: ApprovalRecord = {
      action: actionText,
      date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
      notes,
      userId: state.currentUser?.id,
      userName: state.currentUser?.name
    };

    const updatedLetter = {
      ...letter,
      status: newStatus,
      approvalHistory: [...letter.approvalHistory, newHistoryRecord],
    };

    dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
  };
  
  const handleSign = () => {
    const newHistoryRecord: ApprovalRecord = {
        action: 'تم التوقيع إلكترونياً',
        date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
        userId: state.currentUser?.id,
        userName: state.currentUser?.name
    };
    const updatedLetter = {
        ...letter,
        isSigned: true,
        approvalHistory: [...letter.approvalHistory, newHistoryRecord],
    };
    dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
  };

  const handleEdit = () => {
    setBodyBeforeEdit(letter.body);
    setIsEditing(true);
    setActiveTab('content');
  };

  const handleSaveEdit = () => {
    const updatedLetter = {
        ...letter,
        body: sanitizeHTML(editedBody),
        approvalHistory: [...letter.approvalHistory, { 
            action: 'تم تعديل المحتوى', 
            date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
            previousBody: bodyBeforeEdit,
            userId: state.currentUser?.id,
            userName: state.currentUser?.name
         }],
    };
    dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
    setIsEditing(false);
    setBodyBeforeEdit('');
    toast.success('تم حفظ التعديلات.');
  };

  const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = await fileToDataURL(file);
      const newAttachment: Attachment = {
        id: `att_${Date.now()}`,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.includes('word') ? 'word' : 'other',
        url: url,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      };

      const updatedLetter = {
        ...letter,
        attachments: [...(letter.attachments || []), newAttachment],
        approvalHistory: [...letter.approvalHistory, { action: `تم إرفاق ملف: ${file.name}`, date: new Date().toLocaleDateString('ar-SA-u-nu-latn'), userId: state.currentUser?.id, userName: state.currentUser?.name }]
      };
      dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
      toast.success('تم إرفاق الملف بنجاح.');
    }
  };

    const handleAddComment = () => {
        if (!newComment.trim()) return;
        dispatch({ type: 'ADD_COMMENT', payload: { letterId: letter.id, text: newComment }});
        setNewComment('');
    };
  
  const handleSummarizeThread = async () => {
      if (!threadLetters || threadLetters.length === 0) return;
      setIsSummarizing(true);
      setSummary(null);
      try {
          const result = await summarizeCorrespondenceThread(threadLetters);
          setSummary(result);
          toast.success("تم تلخيص السلسلة");
      } catch (e) {
          console.error(e);
      } finally {
          setIsSummarizing(false);
      }
  };

  const onReply = (letterToReply: Letter, objective?: string, tone?: string) => {
    if (letterToReply.correspondenceType === CorrespondenceType.INBOUND && letterToReply.status !== LetterStatus.AWAITING_REPLY && letterToReply.status !== LetterStatus.REPLIED) {
        handleStatusChange(LetterStatus.AWAITING_REPLY, 'تم البدء في إجراءات الرد');
    }

    dispatch({type: 'SET_REPLY_CONTEXT', payload: {
        letterId: letterToReply.id,
        sender: letterToReply.to,
        recipient: letterToReply.from,
        subject: `ردًا على خطابكم بخصوص: ${letterToReply.subject}`,
        mode: 'reply',
        objective,
        tone: (tone as Tone) || Tone.NEUTRAL
    }});
    dispatch({type: 'SET_VIEW', payload: View.GENERATOR });
  };

  const onSupplementary = (letterToSupplement: Letter) => {
      const isOutbound = letterToSupplement.correspondenceType === CorrespondenceType.OUTBOUND;
      
      dispatch({type: 'SET_REPLY_CONTEXT', payload: {
        letterId: letterToSupplement.id,
        sender: isOutbound ? letterToSupplement.from : letterToSupplement.to,
        recipient: isOutbound ? letterToSupplement.to : letterToSupplement.from,
        subject: `إلحاقاً بخطابنا: ${letterToSupplement.subject}`,
        mode: 'supplementary'
      }});
      dispatch({type: 'SET_VIEW', payload: View.GENERATOR });
  };

  const handleProofread = async () => {
      if (!isEditing) handleEdit();
      setIsProofreading(true);
      const textToAnalyze = isEditing ? editedBody : letter.body;
      const plainText = textToAnalyze.replace(/<[^>]*>?/gm, ' ');
      try {
          const suggestions = await enhanceLetter(plainText);
          setProofreadSuggestions(suggestions);
          setShowProofreadModal(true);
      } catch (error) {
          console.error(error);
      } finally {
          setIsProofreading(false);
      }
  };

  const handleApplyOneSuggestion = (suggestion: EnhancementSuggestion) => {
      setEditedBody(prev => prev.replace(suggestion.original_part, suggestion.suggested_improvement));
      setProofreadSuggestions(prev => prev.filter(s => s !== suggestion));
      toast.success("تم تطبيق التعديل.");
  };

  const handleApplyAllSuggestions = (suggestions: EnhancementSuggestion[]) => {
      let newBody = editedBody;
      suggestions.forEach(s => { newBody = newBody.replace(s.original_part, s.suggested_improvement); });
      setEditedBody(newBody);
      setProofreadSuggestions([]);
      setShowProofreadModal(false);
      toast.success("تم تطبيق جميع التعديلات.");
  };

  const theme = getThemeClasses(settings.primaryColor);

  const letterComments = useMemo(() => comments.filter(c => c.letterId === letter.id), [comments, letter.id]);

  const threadLetters = useMemo(() => {
    let root = letter;
    let parent = allLetters.find(l => l.id === root.referenceId);
    const visitedUp = new Set<string>([root.id]);
    while(parent && !visitedUp.has(parent.id)) {
        visitedUp.add(parent.id);
        root = parent;
        parent = allLetters.find(l => l.id === root.referenceId);
    }
    const thread: Letter[] = [];
    const queue = [root];
    const visited = new Set<string>();
    while(queue.length > 0) {
        const curr = queue.shift()!;
        if(visited.has(curr.id)) continue;
        visited.add(curr.id);
        thread.push(curr);
        const children = allLetters.filter(l => l.referenceId === curr.id);
        queue.push(...children);
    }
    return thread;
  }, [letter, allLetters]);

  const renderActions = () => {
    const actions = [];
    if (letter.correspondenceType === CorrespondenceType.INBOUND) {
        if (letter.status === LetterStatus.RECEIVED) {
            actions.push(<ActionButton key="requires-reply" text="يستوجب الرد" onClick={() => handleStatusChange(LetterStatus.AWAITING_REPLY, 'تم تحديد المعاملة بأنها تستوجب الرد')} colorClass={`text-white bg-indigo-600 hover:bg-indigo-700`} icon={<SendIcon className="w-5 h-5" />} />);
            actions.push(<ActionButton key="no-reply" text="للحفظ" onClick={() => handleStatusChange(LetterStatus.ARCHIVED, 'تم الحفظ للعلم والإحاطة')} colorClass={`text-slate-200 bg-slate-600 hover:bg-slate-700`} icon={<ArchiveIcon className="w-5 h-5" />} />);
        } else if (letter.status === LetterStatus.AWAITING_REPLY) {
            actions.push(<ActionButton key="reply" text="إنشاء الرد" onClick={() => onReply(letter)} colorClass={`text-white bg-emerald-600 hover:bg-emerald-700`} icon={<SendIcon className="w-5 h-5" />} />);
             actions.push(<ActionButton key="cancel-reply" text="إلغاء الرد" onClick={() => handleStatusChange(LetterStatus.ARCHIVED, 'تم إلغاء الرد وحفظ المعاملة')} colorClass={`text-rose-300 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30`} icon={<XCircleIcon className="w-5 h-5" />} />);
        } else if (letter.status === LetterStatus.REPLIED) {
             actions.push(<ActionButton key="archive-replied" text="أرشفة وإغلاق" onClick={() => handleStatusChange(LetterStatus.ARCHIVED, 'تم إغلاق المعاملة وأرشفتها')} colorClass={`text-white bg-indigo-600 hover:bg-indigo-700`} icon={<ArchiveIcon className="w-5 h-5" />} />);
        }
    }
    if (letter.correspondenceType === CorrespondenceType.INBOUND && letter.status === LetterStatus.ARCHIVED) {
         actions.push(<ActionButton key="reply-archived" text="إعادة فتح وإنشاء رد" onClick={() => onReply(letter)} colorClass={`text-slate-300 bg-white/10 hover:bg-white/20 border border-white/10`} />);
    }
    actions.push(<ActionButton key="supplementary" text="خطاب إلحاقي" onClick={() => onSupplementary(letter)} colorClass="text-slate-800 bg-cyan-400 hover:bg-cyan-500" />);
    if (!isEditing && letter.status !== LetterStatus.ARCHIVED) {
        actions.push(<ActionButton key="edit" text="تعديل المحتوى" onClick={handleEdit} colorClass="text-slate-300 bg-white/10 hover:bg-white/20 border border-white/10" />);
    } else if (isEditing) {
        actions.push(<ActionButton key="proofread" text={isProofreading ? "جاري التدقيق..." : "تدقيق لغوي (AI)"} onClick={handleProofread} isLoading={isProofreading} colorClass="text-white bg-amber-500 hover:bg-amber-600" />);
    }
    if (!letter.isSigned) {
        actions.push(<ActionButton key="sign" text="توقيع إلكتروني" onClick={handleSign} colorClass="text-white bg-violet-600 hover:bg-violet-700" />);
    }
    if (letter.correspondenceType === CorrespondenceType.OUTBOUND && letter.status !== LetterStatus.SENT && letter.status !== LetterStatus.ARCHIVED) {
        actions.push(<ActionButton key="send" text="إرسال الخطاب" onClick={() => handleStatusChange(LetterStatus.SENT, 'تم الإرسال')} disabled={!letter.isSigned} colorClass={`text-white ${theme.bg} ${theme.hoverBg}`} />);
    }
    return <div className="flex flex-wrap items-center gap-4">{actions}</div>;
  };

  return (
    <>
    {printRoot && printableContent && createPortal(printableContent, printRoot)}
    {showProofreadModal && <ProofreadModal suggestions={proofreadSuggestions} onClose={() => setShowProofreadModal(false)} onApplyAll={handleApplyAllSuggestions} onApplyOne={handleApplyOneSuggestion} />}

    <div className="p-4 lg:p-10 bg-transparent space-y-12 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      <div className="glass-card p-8 border border-white/10 shadow-2xl rounded-[2.5rem]">
          <WorkflowTracker letter={letter} settings={settings} />
      </div>

      {/* --- SMART REPLIES SECTION --- */}
      {letter.correspondenceType === CorrespondenceType.INBOUND && letter.status !== LetterStatus.ARCHIVED && letter.status !== LetterStatus.REPLIED && (
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-[3rem] p-10 shadow-3xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 group-hover:bg-indigo-400 transition-all duration-500"></div>
              <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl">
                        <SparklesIcon className="w-8 h-8 text-indigo-400 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white">مركز الردود الذكية</h3>
                        <p className="text-sm text-indigo-300 font-bold mt-1">مسارات استراتيجية تم تحليلها عبر Gemini 3</p>
                    </div>
                  </div>
                  {isLoadingSmartReplies ? (
                      <div className="flex items-center gap-3 text-indigo-400 text-sm font-black bg-indigo-500/10 px-4 py-2 rounded-full">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                        جاري تحليل السياق...
                      </div>
                  ) : (
                      <button onClick={handleFetchSmartReplies} className="text-xs font-black text-slate-500 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full border border-white/5">تحديث المقترحات</button>
                  )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {smartReplies.length > 0 ? smartReplies.map((reply, i) => (
                      <button 
                        key={i} 
                        onClick={() => onReply(letter, reply.objective, reply.tone)}
                        className={`p-8 rounded-[2rem] border-2 text-right flex flex-col gap-4 transition-all group/btn shadow-2xl hover:-translate-y-2 ${
                            reply.type === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50' :
                            reply.type === 'negative' ? 'bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50' :
                            'bg-indigo-500/5 border-indigo-500/10 hover:border-indigo-500/50'
                        }`}
                      >
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
                               reply.type === 'positive' ? 'bg-emerald-500 text-white shadow-lg' :
                               reply.type === 'negative' ? 'bg-rose-500 text-white shadow-lg' :
                               'bg-indigo-500 text-white shadow-lg'
                            }`}>{reply.title}</span>
                             <SparklesIcon className="w-4 h-4 text-white/20 group-hover/btn:text-white/60 transition-colors" />
                          </div>
                          <p className="text-lg font-bold text-white leading-relaxed line-clamp-3 group-hover/btn:line-clamp-none transition-all">{reply.objective}</p>
                          <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                              <span className="text-[11px] text-slate-500 font-black uppercase">النبرة: {reply.tone}</span>
                              <span className="text-[11px] text-indigo-400 font-black opacity-0 group-hover/btn:opacity-100 transition-opacity">تطبيق المسار ←</span>
                          </div>
                      </button>
                  )) : !isLoadingSmartReplies && (
                      <div className="col-span-3 py-16 text-center bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                          <p className="text-slate-500 font-black text-lg">لم نتمكن من اقتراح ردود حالياً. جرب التحديث.</p>
                      </div>
                  )}
                  
                  {isLoadingSmartReplies && [1,2,3].map(i => (
                       <div key={i} className="h-48 bg-white/5 rounded-[2rem] animate-pulse border border-white/5 relative overflow-hidden shadow-inner">
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent animate-shimmer"></div>
                       </div>
                  ))}
              </div>
          </div>
      )}

      {threadLetters && threadLetters.length > 1 && (
        <div className="glass-card border border-white/10 p-8 rounded-[2.5rem] bg-slate-900/40">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <LinkIcon className="w-6 h-6 text-indigo-400" />
                    سلسلة المراسلات (التسلسل الزمني)
                </h3>
                <ActionButton text={isSummarizing ? "جاري التلخيص..." : "تلخيص السياق"} onClick={handleSummarizeThread} colorClass="text-xs px-4 py-2 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white" icon={<FileTextIcon className="w-4 h-4"/>} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {threadLetters.map((tl, idx) => (
                    <div key={tl.id} onClick={() => tl.id !== letter.id && dispatch({ type: 'SELECT_LETTER', payload: tl.id })} className={`p-5 rounded-2xl border transition-all cursor-pointer relative group ${tl.id === letter.id ? 'bg-indigo-600 text-white border-indigo-400 shadow-2xl' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-black ${tl.id === letter.id ? 'text-indigo-100' : 'text-slate-500'}`}>{tl.date}</span>
                            {getStatusChip(tl.status)}
                        </div>
                        <p className={`text-sm font-bold truncate ${tl.id === letter.id ? 'text-white' : 'text-slate-300'}`}>{tl.subject}</p>
                    </div>
                ))}
            </div>
            {summary && <div className="mt-8 p-8 bg-slate-950/80 rounded-[2rem] border border-indigo-500/30 text-slate-300 text-[13px] leading-[1.8] shadow-3xl animate-in zoom-in-95 font-bold" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>') }} />}
        </div>
      )}

      <div className="pb-6 border-b border-white/10">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-2">موضوع المعاملة</p>
        <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight px-2">{letter.subject}</h1>
      </div>

      <div className="py-8 border-b border-white/10">
          <h3 className="text-xl font-black text-slate-300 mb-8 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
              بيانات المستند الرسمية
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10 px-2">
              <DetailItem label="الجهة المرسلة" value={letter.from} />
              <DetailItem label={letter.correspondenceType === CorrespondenceType.INBOUND ? "التصنيف الإداري" : "الجهة الموجه إليها"} value={letter.to} />
              <DetailItem label="تاريخ التحرير / الاستلام" value={letter.date} />
              <DetailItem label="الرقم المرجعي للنظام" value={letter.internalRefNumber || '---'} />
              <DetailItem label="مستوى الأولوية" children={getPriorityChip(letter.priority || PriorityLevel.NORMAL)} />
              <DetailItem label="حالة الإجراء" children={getStatusChip(letter.status)} />
          </div>
      </div>

      <div className="my-10 p-8 bg-white/5 rounded-[2.5rem] border border-white/5 no-print shadow-inner">
        <h3 className="text-lg font-black text-slate-400 mb-6 uppercase tracking-widest px-2">الإجراءات المتاحة على هذه المعاملة</h3>
        {renderActions()}
      </div>
      
        <div className="border-b border-white/10 mb-8">
            <nav className="-mb-px flex space-x-10 space-x-reverse overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('content')} className={`whitespace-nowrap py-5 px-4 border-b-4 font-black text-base transition-all ${activeTab === 'content' ? theme.tabActive : theme.tabInactive}`}>محتوى المعاملة والمرفقات</button>
                <button onClick={() => setActiveTab('comments')} className={`whitespace-nowrap py-5 px-4 border-b-4 font-black text-base transition-all ${activeTab === 'comments' ? theme.tabActive : theme.tabInactive}`}>سجل الملاحظات والتوجيه</button>
                <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap py-5 px-4 border-b-4 font-black text-base transition-all ${activeTab === 'history' ? theme.tabActive : theme.tabInactive}`}>سجل المسار الزمني</button>
            </nav>
        </div>

        <div className="px-1">
            {activeTab === 'content' && (
                <div className="space-y-12">
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-black text-slate-100 flex items-center gap-3">
                                <FileTextIcon className="w-7 h-7 text-indigo-400" />
                                عرض متن الخطاب
                            </h3>
                        </div>
                        {isEditing ? (
                            <div className="animate-in fade-in duration-300">
                                <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} />
                                <div className="mt-6 flex items-center justify-end gap-4 bg-slate-800/50 p-6 rounded-2xl border border-white/5 shadow-3xl">
                                    <button onClick={() => setIsEditing(false)} className="px-8 py-3 text-sm font-black text-slate-300 hover:text-white transition-all bg-white/5 rounded-xl border border-white/10">إلغاء</button>
                                    <button onClick={handleSaveEdit} className={`px-10 py-3 text-sm font-black text-white ${theme.bg} rounded-xl shadow-2xl hover:scale-105 transition-all`}>اعتماد التعديلات</button>
                                </div>
                            </div>
                        ) : (
                            <div className={`rounded-[3rem] border border-slate-200 bg-white text-slate-900 shadow-[0_40px_100px_rgba(0,0,0,0.4)] overflow-hidden relative group transform hover:-rotate-0.5 transition-transform duration-700`}>
                                <div className="absolute top-8 left-10 text-[10px] text-slate-300 font-black uppercase tracking-[0.4em] pointer-events-none group-hover:text-indigo-600 transition-colors">Official Document Canvas</div>
                                <div className="p-12 md:p-20">
                                    <div className="prose max-w-none prose-slate font-bold text-slate-800 text-xl lg:text-2xl leading-[2] tracking-normal" 
                                         style={{fontFamily: "'Cairo', sans-serif"}}
                                         dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
                                    {letter.isSigned && (
                                        <div className="mt-20 pt-10 border-t border-dashed border-slate-300 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-lg border border-emerald-200">
                                                    <CheckCircleIcon className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <p className="text-xl text-emerald-800 font-black">مصادق وموقع إلكترونياً</p>
                                                    <p className="text-xs text-slate-400 font-bold mt-1">بواسطة نظام خطابي الذكي - بصمة رقمية معتمدة</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-400 font-mono bg-slate-50 px-4 py-2 rounded-full border border-slate-100 shadow-inner tracking-widest">CERT_ID_{letter.id.substring(0,10).toUpperCase()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-slate-100 flex items-center gap-3">
                                <LinkIcon className="w-6 h-6 text-indigo-400" />
                                المرفقات الرقمية
                            </h3>
                            <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
                                {(!letter.attachments || letter.attachments.length === 0) && (
                                    <div className="text-center py-10 opacity-50">
                                        <p className="text-sm font-bold text-slate-500">لا توجد ملفات مرفقة لهذا السجل.</p>
                                    </div>
                                )}
                                <ul className="space-y-4">
                                {letter.attachments?.map(att => (
                                    <li key={att.id}>
                                        <div className="w-full text-right flex items-center gap-5 p-5 bg-slate-800/60 rounded-[1.5rem] border border-white/5 hover:border-indigo-500/50 hover:shadow-2xl transition-all group/att">
                                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 group-hover/att:bg-indigo-500/10 transition-colors">
                                                <FileTextIcon className="w-6 h-6 text-slate-500 group-hover/att:text-indigo-400" />
                                            </div>
                                            <div className="flex-grow overflow-hidden">
                                                <button onClick={() => handleViewAttachment(att)} className={`font-black text-lg truncate block text-slate-200 group-hover/att:text-white transition-colors`}>{att.name}</button>
                                                <span className="text-[11px] text-slate-500 font-black uppercase mt-1 block">{att.size}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <a href={att.url} download={att.name} className="p-3 text-slate-400 hover:text-white font-black rounded-xl hover:bg-indigo-600 transition-all bg-white/5" title="تنزيل الملف">تنزيل</a>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                                </ul>
                                <div className="mt-8 pt-6 border-t border-white/5">
                                    <input type="file" ref={attachmentInputRef} onChange={handleAddAttachment} className="hidden" />
                                    <button onClick={() => attachmentInputRef.current?.click()} className={`w-full text-sm font-black flex items-center justify-center gap-3 px-6 py-4 text-slate-400 bg-white/5 rounded-[1.5rem] hover:bg-white/10 border-2 border-dashed border-white/10 hover:border-white/20 transition-all`}>
                                        <SparklesIcon className="w-4 h-4" />
                                        <span>إدراج مرفق إضافي</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className='no-print space-y-6'>
                             <h3 className="text-xl font-black text-slate-100 flex items-center gap-3">
                                <PrinterIcon className="w-6 h-6 text-indigo-400" />
                                المخرجات والطباعة
                             </h3>
                             <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 space-y-4 shadow-inner">
                                <ActionButton text="تحميل نسخة رقمية معتمدة (JSON)" onClick={handleDownloadDigitalCopy} colorClass="w-full justify-center text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white" icon={<DownloadIcon className="w-5 h-5"/>} />
                                <ActionButton text="طباعة سند الاستلام الفوري" onClick={() => setIsPreviewingReceipt(true)} colorClass="w-full justify-center text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10" />
                                {letter.correspondenceType === CorrespondenceType.INBOUND && (
                                    <ActionButton text="طباعة غلاف المعاملة (Cover)" onClick={handlePrintCoverSheet} colorClass="w-full justify-center text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10" />
                                )}
                                <ActionButton text="طباعة هذا الخطاب الآن" onClick={handlePrint} colorClass="w-full justify-center text-white bg-indigo-600 hover:bg-indigo-500 shadow-[0_15px_40px_rgba(99,102,241,0.3)]" icon={<PrinterIcon className="w-5 h-5" />} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'comments' && (
                <div className="max-w-4xl space-y-8">
                     {letterComments.length > 0 ? (
                         <ul className="space-y-8">
                             {letterComments.map(comment => (
                                <li key={comment.id} className="flex items-start gap-6 group animate-in slide-in-from-bottom-2">
                                    <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white bg-indigo-600 shadow-xl border border-indigo-400 group-hover:rotate-6 transition-transform`}>خ</div>
                                    <div className="flex-grow bg-slate-900/60 p-8 rounded-[2rem] border border-white/5 shadow-2xl">
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="font-black text-base text-indigo-300 tracking-tight">نظام خطابي - سجل الملاحظات</p>
                                            <p className="text-[11px] font-black text-slate-500 uppercase">{comment.createdAt}</p>
                                        </div>
                                        <p className="text-lg font-medium text-slate-200 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                                    </div>
                                </li>
                             ))}
                         </ul>
                     ) : (
                         <div className="text-center py-24 bg-slate-900/30 rounded-[3rem] border border-dashed border-white/5">
                            <div className="p-4 bg-white/5 w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"><MessageSquareIcon className="w-8 h-8 text-slate-600" /></div>
                            <p className="text-slate-500 font-black text-lg">لا توجد ملاحظات توجيهية مسجلة بعد.</p>
                         </div>
                     )}
                     <div className="relative mt-12 bg-slate-950/40 p-8 rounded-[3rem] border border-white/5 shadow-inner">
                         <label className="block text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 px-2">إضافة ملاحظة توجيهية جديدة</label>
                         <textarea rows={5} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="اكتب ملاحظاتك أو تعليقاتك الداخلية هنا لتوثيقها..." className="w-full px-8 py-6 bg-slate-900 text-white border border-white/5 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/20 text-lg font-medium placeholder-slate-700 shadow-2xl outline-none transition-all" />
                         <div className="mt-6 text-left">
                            <button onClick={handleAddComment} className={`px-12 py-4 text-base font-black text-white rounded-2xl shadow-2xl transition-all active:scale-95 hover:scale-105 ${theme.bg} ${theme.hoverBg}`} disabled={!newComment.trim()}>إرسال وتوثيق الملاحظة</button>
                         </div>
                     </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="max-w-5xl py-10">
                     <ul className="space-y-12 border-r-2 border-slate-800 pr-10 relative">
                         {letter.approvalHistory.map((record, index) => (
                             <li key={index} className="flex items-start gap-8 group">
                                <div className="absolute -right-[0.65rem] top-1 w-5 h-5 rounded-full bg-slate-950 border-4 border-indigo-500 group-hover:scale-150 group-hover:bg-indigo-500 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                                <div className="flex-grow bg-slate-900/60 p-8 rounded-[2.5rem] border border-white/5 hover:border-indigo-500/30 transition-all shadow-xl group-hover:shadow-2xl">
                                    <p className="font-black text-xl text-white group-hover:text-indigo-200 transition-colors">{record.action}</p>
                                    <div className="flex items-center gap-6 mt-3">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <ClockIcon className="w-4 h-4" />
                                            <span className="text-[11px] font-black uppercase">{record.date}</span>
                                        </div>
                                        {record.userName && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                                <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">المنفذ: {record.userName}</p>
                                            </div>
                                        )}
                                    </div>
                                    {record.notes && <div className="mt-6 text-base font-medium text-slate-300 bg-white/5 p-6 rounded-2xl border border-white/5 leading-relaxed italic">"{record.notes}"</div>}
                                    {record.previousBody && (
                                        <button onClick={() => setDiffData({ old: record.previousBody || '', new: letter.body })} className="text-xs font-black text-indigo-400 hover:text-indigo-200 mt-6 flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20 transition-all">
                                            تحليل التغييرات في المحتوى
                                            <ArrowRightLeftIcon className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                             </li>
                         ))}
                     </ul>
                </div>
            )}
        </div>
      </div>
    </>
  );
}
