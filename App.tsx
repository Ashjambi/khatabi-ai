
import React, { useState, useEffect, useReducer, createContext, useContext } from 'react';
import { Letter, View, CorrespondenceType, LetterStatus, Tone, Template, LearnedPrinciple, Notification, CompanySettings, Comment, ApprovalRecord, GeneratorState, LetterType, PriorityLevel, ConfidentialityLevel, InboundLetterFormState, User, UserRole } from './types';
import { mockLetters } from './data/mockData';
import { mockTemplates } from './data/mockTemplates';
import { mockNotifications } from './data/mockNotifications';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import { Toaster, toast } from 'react-hot-toast';

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
  departments: ['الإدارة العامة', 'الموارد البشرية', 'الشؤون القانونية', 'الإدارة المالية', 'تقنية المعلومات'], 
  defaultDepartment: 'الإدارة العامة',
  externalEntities: ['وزارة التجارة', 'شركة الكهرباء', 'مجموعة الراجحي'], 
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
  | { type: 'SET_REPLY_CONTEXT'; payload: ReplyContextType }
  | { type: 'UPDATE_SETTINGS'; payload: CompanySettings }
  | { type: 'ADD_COMMENT'; payload: { letterId: string; text: string } }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'UPDATE_CATEGORY_NAME'; payload: { oldName: string; newName: string } }
  | { type: 'UPDATE_GENERATOR_STATE'; payload: Partial<GeneratorState> }
  | { type: 'RESET_GENERATOR_STATE' }
  | { type: 'UPDATE_INBOUND_FORM_STATE'; payload: Partial<InboundLetterFormState> }
  | { type: 'RESET_INBOUND_FORM_STATE' }
  | { type: 'TOGGLE_SIDEBAR' };

const initialGeneratorState: GeneratorState = {
    sender: '',
    receiver: '',
    subject: '',
    letterType: LetterType.RESPONSE,
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
    case 'UPDATE_LETTER':
        return { ...state, letters: state.letters.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'IMPORT_LETTERS_BULK':
        return { ...state, letters: [...action.payload, ...state.letters] };
    case 'SET_REPLY_CONTEXT': {
        const letter = state.letters.find(l => l.id === action.payload.letterId);
        return {
            ...state,
            replyContext: action.payload,
            currentView: View.GENERATOR,
            generatorState: {
                ...initialGeneratorState,
                referenceId: action.payload.letterId,
                subject: action.payload.subject,
                sender: action.payload.sender,
                receiver: action.payload.recipient,
                letterType: action.payload.mode === 'reply' ? LetterType.RESPONSE : LetterType.SUPPLEMENTARY,
                originalLetterContent: letter?.body || '',
                objective: action.payload.objective || '',
                tone: action.payload.tone || Tone.NEUTRAL
            }
        };
    }
    case 'CREATE_LETTER': {
        const { newLetterData } = action.payload;
        const letter: Letter = {
            ...newLetterData,
            id: new Date().toISOString(),
            internalRefNumber: generateSystemID(),
            currentDepartment: state.companySettings.defaultDepartment,
            date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
            status: LetterStatus.APPROVED,
            correspondenceType: CorrespondenceType.OUTBOUND,
            approvalHistory: [{ action: 'تم إنشاء الخطاب واعتماده', date: new Date().toLocaleDateString('ar-SA-u-nu-latn') }],
            creatorId: state.currentUser?.id,
        };
        return { ...state, letters: [letter, ...state.letters], selectedLetterId: letter.id, currentView: View.DETAILS };
    }
    case 'REGISTER_INBOUND': {
        const letter: Letter = {
            ...action.payload,
            id: new Date().toISOString(),
            internalRefNumber: generateSystemID(),
            currentDepartment: action.payload.to || state.companySettings.defaultDepartment,
            status: LetterStatus.RECEIVED,
            tone: Tone.NEUTRAL,
            body: action.payload.summary ? `<p><strong>ملخص الذكاء الاصطناعي:</strong> ${action.payload.summary}</p><hr><p>المحتوى في المرفق.</p>` : '<p>المحتوى في المرفق.</p>',
            correspondenceType: CorrespondenceType.INBOUND,
            approvalHistory: [{ action: 'تم استلام الخطاب وأرشفته', date: new Date().toLocaleDateString('ar-SA-u-nu-latn') }],
        } as Letter;
        return { ...state, letters: [letter, ...state.letters], selectedLetterId: letter.id, currentView: View.DETAILS };
    }
    case 'UPDATE_SETTINGS':
        return { ...state, companySettings: action.payload };
    case 'RESET_GENERATOR_STATE':
        return { ...state, generatorState: { ...initialGeneratorState, sender: state.companySettings.defaultDepartment } };
    case 'UPDATE_GENERATOR_STATE':
        return { ...state, generatorState: { ...state.generatorState, ...action.payload } };
    case 'UPDATE_INBOUND_FORM_STATE':
        return { ...state, inboundLetterFormState: { ...state.inboundLetterFormState, ...action.payload } };
    case 'RESET_INBOUND_FORM_STATE':
        return { ...state, inboundLetterFormState: initialInboundLetterFormState };
    case 'TOGGLE_SIDEBAR':
        return { ...state, isSidebarCollapsed: !state.isSidebarCollapsed };
    case 'ADD_COMMENT':
        const newComment: Comment = { id: Date.now().toString(), letterId: action.payload.letterId, text: action.payload.text, createdAt: new Date().toLocaleString('ar-SA') };
        return { ...state, comments: [newComment, ...state.comments] };
    case 'MARK_ALL_NOTIFICATIONS_READ':
        return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case 'UPDATE_CATEGORY_NAME':
        return { ...state, letters: state.letters.map(l => l.category === action.payload.oldName ? { ...l, category: action.payload.newName } : l) };
    default:
        return state;
  }
}

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialState);
    
    useEffect(() => {
        const stored = localStorage.getItem('khatabi_settings');
        if (stored) dispatch({ type: 'LOAD_STATE', payload: { companySettings: JSON.parse(stored) } });
    }, []);

    useEffect(() => {
        localStorage.setItem('khatabi_settings', JSON.stringify(state.companySettings));
    }, [state.companySettings]);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            <div className="h-screen w-screen flex text-slate-100 overflow-hidden relative">
                <Toaster position="top-center" />
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                    <Header onNotificationClick={(n) => {
                        dispatch({ type: 'SELECT_LETTER', payload: n.letterId || '' });
                    }} />
                    <main className="flex-1 p-6 overflow-y-auto custom-scrollbar h-full">
                        <MainContent />
                    </main>
                </div>
            </div>
        </AppContext.Provider>
    );
}
