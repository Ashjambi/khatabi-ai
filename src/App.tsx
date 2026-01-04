
import { Letter, View, CorrespondenceType, LetterStatus, Tone, Template, LearnedPrinciple, Notification, CompanySettings, Comment, ApprovalRecord, GeneratorState, LetterType, PriorityLevel, ConfidentialityLevel, InboundLetterFormState, User, UserRole } from './types';
import React, { useState, useEffect, useReducer, createContext, useContext, useRef } from 'react';
import { mockLetters } from './data/mockData';
import { mockTemplates } from './data/mockTemplates';
import { mockNotifications } from './data/mockNotifications';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import { Toaster, toast } from 'react-hot-toast';
import { FileSystemService } from './services/fileSystemService';

export type ReplyContextType = {
  letterId: string;
  recipient: string;
  sender: string;
  subject: string;
  mode: 'reply' | 'supplementary';
  objective?: string;
  tone?: Tone;
};

const defaultSettings: CompanySettings = {
  companyName: 'خطابي',
  companyLogo: '', 
  primaryColor: 'indigo',
  departments: ['مكتب المدير العام', 'الإدارة المالية', 'الموارد البشرية', 'المشاريع'],
  defaultDepartment: 'مكتب المدير العام',
  externalEntities: ['وزارة التجارة', 'شركة الكهرباء', 'مجموعة التطوير العقاري'],
  letterFooter: '',
  globalAIInstruction: '',
  users: [],
};

const generateSystemID = () => {
    const date = new Date();
    const yearShort = date.getFullYear().toString().slice(-2);
    const sequence = Math.floor(100000 + Math.random() * 900000); 
    return `${yearShort}${sequence}`;
};

interface AppState {
    letters: Letter[];
    templates: Template[];
    selectedLetterId: string | null;
    currentView: View;
    replyContext: ReplyContextType | null;
    selectedTemplate: Template | null;
    learnedPrinciples: LearnedPrinciple[];
    notifications: Notification[];
    companySettings: CompanySettings;
    comments: Comment[];
    generatorState: GeneratorState;
    inboundLetterFormState: InboundLetterFormState;
    currentUser: User | null;
    isSidebarCollapsed: boolean;
    fileSystemHandle: FileSystemDirectoryHandle | null;
}

type AppAction =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'SET_VIEW'; payload: View }
  | { type: 'SELECT_LETTER'; payload: string }
  | { type: 'CREATE_LETTER'; payload: { newLetterData: Omit<Letter, 'id' | 'date' | 'status' | 'correspondenceType' | 'approvalHistory' | 'currentDepartment' | 'referenceId'> } }
  | { type: 'REGISTER_INBOUND'; payload: Omit<Letter, 'id' | 'status' | 'correspondenceType' | 'approvalHistory' | 'tone' | 'body' | 'currentDepartment'> }
  | { type: 'UPDATE_LETTER'; payload: Letter }
  | { type: 'IMPORT_LETTERS_BULK'; payload: Letter[] }
  | { type: 'CREATE_TEMPLATE'; payload: Omit<Template, 'id'> }
  | { type: 'SELECT_TEMPLATE'; payload: Template }
  | { type: 'CLEAR_SELECTED_TEMPLATE' }
  | { type: 'SET_REPLY_CONTEXT'; payload: ReplyContextType }
  | { type: 'CLEAR_REPLY_CONTEXT' }
  | { type: 'ADD_PRINCIPLES'; payload: string[] }
  | { type: 'DELETE_PRINCIPLE'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: CompanySettings }
  | { type: 'ADD_COMMENT'; payload: { letterId: string; text: string } }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'UPDATE_CATEGORY_NAME'; payload: { oldName: string; newName: string } }
  | { type: 'ADD_NOTIFICATION'; payload: { message: string, letterId?: string }}
  | { type: 'UPDATE_GENERATOR_STATE'; payload: Partial<GeneratorState> }
  | { type: 'RESET_GENERATOR_STATE' }
  | { type: 'UPDATE_INBOUND_FORM_STATE'; payload: Partial<InboundLetterFormState> }
  | { type: 'RESET_INBOUND_FORM_STATE' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_FILE_SYSTEM_HANDLE'; payload: FileSystemDirectoryHandle };


const initialGeneratorState: GeneratorState = {
    sender: '',
    receiver: '',
    subject: '',
    letterType: LetterType.MISCELLANEOUS,
    objective: '',
    attachments: [],
    cc: [],
    priority: PriorityLevel.NORMAL,
    confidentiality: ConfidentialityLevel.NORMAL,
    completionDays: '',
    notes: '',
    tone: Tone.NEUTRAL,
    generatedVariations: null,
    originalBodyForLearning: '',
    editedBody: '',
    selectedVariationKey: 'neutral',
    analysisResult: null,
    contextualReferences: null,
    templateFields: {},
    activeTemplateObjective: '',
    referenceId: undefined,
    originalLetterContent: '',
};

const initialInboundLetterFormState: InboundLetterFormState = {
    subject: '',
    from: '',
    to: '', 
    cc: [],
    dateReceived: new Date().toISOString().split('T')[0],
    letterType: LetterType.INQUIRY,
    category: '',
    attachments: [],
    summary: '',
    referenceId: undefined,
    externalRefNumber: '',
    priority: PriorityLevel.NORMAL,
    confidentiality: ConfidentialityLevel.NORMAL,
    completionDays: '',
    notes: '',
};

const initialState: AppState = {
  letters: mockLetters,
  templates: mockTemplates,
  selectedLetterId: null,
  currentView: View.DASHBOARD,
  replyContext: null,
  selectedTemplate: null,
  learnedPrinciples: [],
  notifications: mockNotifications,
  companySettings: defaultSettings,
  comments: [],
  generatorState: { ...initialGeneratorState },
  inboundLetterFormState: { ...initialInboundLetterFormState },
  currentUser: {
    id: 'u1',
    name: 'مدير النظام',
    role: UserRole.ADMIN,
    department: defaultSettings.defaultDepartment
  },
  isSidebarCollapsed: false,
  fileSystemHandle: null,
};

export const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> }>({
  state: initialState,
  dispatch: () => null,
});

export const useApp = () => useContext(AppContext);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
        return { ...state, ...action.payload };
    case 'SET_VIEW':
        return { ...state, currentView: action.payload };
    case 'SELECT_LETTER':
        return { ...state, selectedLetterId: action.payload, currentView: View.DETAILS };
    case 'UPDATE_LETTER': {
        const letterExists = state.letters.some(l => l.id === action.payload.id);
        const newLetters = letterExists 
            ? state.letters.map(l => l.id === action.payload.id ? action.payload : l)
            : [action.payload, ...state.letters];
        return { ...state, letters: newLetters };
    }
    case 'IMPORT_LETTERS_BULK': {
        const existingLetterMap = new Map(state.letters.map(l => [l.id, l]));
        action.payload.forEach(importedLetter => {
            existingLetterMap.set(importedLetter.id, importedLetter);
        });
        const updatedLetters = Array.from(existingLetterMap.values()).sort((a, b) => {
            const dateA = new Date(a.date.replace(/\//g, '-')).getTime();
            const dateB = new Date(b.date.replace(/\//g, '-')).getTime();
            return dateB - dateA;
        });
        return { ...state, letters: updatedLetters };
    }
    case 'CREATE_LETTER': {
        const { newLetterData } = action.payload;
        const { referenceId } = state.generatorState;
        const internalRef = generateSystemID();
        const letter: Letter = {
            ...newLetterData,
            id: new Date().toISOString(),
            internalRefNumber: internalRef,
            currentDepartment: state.companySettings.defaultDepartment,
            date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
            status: LetterStatus.APPROVED,
            correspondenceType: CorrespondenceType.OUTBOUND,
            approvalHistory: [{ action: 'تم إنشاء الخطاب واعتماده', date: new Date().toLocaleDateString('ar-SA-u-nu-latn'), userId: state.currentUser?.id, userName: state.currentUser?.name }],
            referenceId,
            creatorId: state.currentUser?.id,
        };
        let newLetters = [letter, ...state.letters];
        if (referenceId) {
            newLetters = newLetters.map(l => {
                if (l.id === referenceId) {
                    return {
                        ...l,
                        status: newLetterData.type === LetterType.SUPPLEMENTARY ? l.status : LetterStatus.REPLIED,
                        approvalHistory: [...l.approvalHistory, { action: `تم الرد بخطاب: ${letter.subject}`, date: new Date().toLocaleDateString('ar-SA-u-nu-latn') }]
                    };
                }
                return l;
            });
        }
        return { ...state, letters: newLetters, selectedLetterId: letter.id, currentView: View.DETAILS };
    }
    case 'REGISTER_INBOUND': {
        const internalRef = generateSystemID();
        const letter: Letter = {
            ...action.payload,
            id: new Date().toISOString(),
            internalRefNumber: internalRef,
            currentDepartment: action.payload.to || state.companySettings.defaultDepartment,
            status: LetterStatus.RECEIVED,
            tone: Tone.NEUTRAL,
            body: action.payload.summary ? `<p><strong>ملخص الذكاء الاصطناعي:</strong> ${action.payload.summary}</p><hr><p>المحتوى في المرفق الورقي أو الرقمي.</p>` : '<p>المحتوى في المرفق الورقي أو الرقمي.</p>',
            correspondenceType: CorrespondenceType.INBOUND,
            approvalHistory: [{ action: 'تم استلام الخطاب وأرشفته', date: new Date().toLocaleDateString('ar-SA-u-nu-latn') }],
        } as Letter;
        return { ...state, letters: [letter, ...state.letters], selectedLetterId: letter.id, currentView: View.DETAILS };
    }
    case 'SET_REPLY_CONTEXT': {
        const { letterId, sender, recipient, subject, mode, objective, tone } = action.payload;
        const targetLetter = state.letters.find(l => l.id === letterId);
        
        // تجهيز سياق المحتوى للذكاء الاصطناعي
        const combinedContent = targetLetter 
            ? `[تفاصيل الخطاب المرجعي]
               رقم المعاملة: ${targetLetter.internalRefNumber || '---'}
               الموضوع: ${targetLetter.subject}
               من: ${targetLetter.from}
               إلى: ${targetLetter.to}
               المحتوى: ${targetLetter.body.replace(/<[^>]*>?/gm, ' ')}`
            : '';

        return {
            ...state,
            replyContext: action.payload,
            generatorState: {
                ...initialGeneratorState,
                sender: sender, 
                receiver: recipient,
                subject: subject,
                referenceId: letterId,
                letterType: mode === 'reply' ? LetterType.RESPONSE : LetterType.SUPPLEMENTARY,
                objective: objective || '',
                tone: tone || Tone.NEUTRAL,
                originalLetterContent: combinedContent,
            },
            currentView: View.GENERATOR
        };
    }
    case 'RESET_GENERATOR_STATE':
        return { ...state, generatorState: { ...initialGeneratorState, sender: state.companySettings.defaultDepartment } };
    case 'UPDATE_GENERATOR_STATE':
        return { ...state, generatorState: { ...state.generatorState, ...action.payload } };
    case 'TOGGLE_SIDEBAR':
        return { ...state, isSidebarCollapsed: !state.isSidebarCollapsed };
    default:
        return state;
  }
}

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    useEffect(() => {
        try {
            const storedSettings = localStorage.getItem('khatabiCompanySettings');
            if (storedSettings) {
                dispatch({ type: 'LOAD_STATE', payload: { companySettings: JSON.parse(storedSettings) } });
            }
        } catch (error) {}
    }, []);
    useEffect(() => {
        localStorage.setItem('khatabiCompanySettings', JSON.stringify(state.companySettings));
    }, [state.companySettings]);
    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
};

function AppContent() {
    const { state, dispatch } = useApp();
    const handleNotificationClick = (notification: Notification) => {
      dispatch({ type: 'MARK_NOTIFICATION_READ', payload: notification.id });
      if(notification.letterId) {
          dispatch({ type: 'SELECT_LETTER', payload: notification.letterId });
      }
    };
    return (
        <div className={`h-screen w-screen flex text-slate-100 overflow-hidden relative`}>
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] opacity-50"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[100px] opacity-40"></div>
            </div>
            <Toaster position="top-center" reverseOrder={false} />
            <Sidebar className="no-print z-30" />
            <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                <Header onNotificationClick={handleNotificationClick} className="no-print z-20" />
                <main className="flex-1 p-4 lg:p-6 overflow-y-auto z-10 custom-scrollbar h-full">
                    <MainContent />
                </main>
            </div>
        </div>
    );
}

export default function App(): React.ReactNode {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
}
