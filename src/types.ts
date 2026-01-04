
export enum PriorityLevel {
  URGENT = 'عاجل وهام',
  HIGH = 'هام',
  NORMAL = 'عادي',
}

export enum ConfidentialityLevel {
  TOP_SECRET = 'سري للغاية',
  CONFIDENTIAL = 'سري',
  NORMAL = 'عادي',
}

export enum LetterStatus {
  DRAFT = 'مسودة',
  PENDING_REVIEW = 'قيد المراجعة',
  PENDING_AUDIT = 'بانتظار التدقيق',
  PENDING_INTERNAL_REVIEW = 'مراجعة داخلية',
  APPROVED = 'جاهز للإرسال',
  SENT = 'تم الإرسال',
  RECEIVED = 'تم الاستلام',
  AWAITING_REPLY = 'بانتظار الرد',
  REPLIED = 'تم الرد',
  ARCHIVED = 'مؤرشف',
  REJECTED = 'مرفوض',
}

export enum CorrespondenceType {
  OUTBOUND = 'صادر',
  INBOUND = 'وارد',
}

export enum LetterType {
  INQUIRY = 'استفسار',
  RESPONSE = 'رد',
  REQUEST = 'طلب',
  APOLOGY = 'اعتذار',
  COMPLAINT = 'تظلم/شكوى',
  NOTIFICATION = 'تنبيه/إشعار',
  CONFIRMATION = 'تأكيد',
  HR = 'شؤون موظفين',
  GOVERNMENT = 'جهات حكومية',
  CIRCULAR = 'تعميم',
  MEETING_ATTENDANCE = 'حضور إجتماع',
  REPORT = 'بلاغ',
  MISCELLANEOUS = 'متنوع',
  SUPPLEMENTARY = 'إلحاقي',
}

export enum Tone {
  FORMAL_STRICT = 'رسمية صارمة',
  NEUTRAL = 'محايدة',
  DIPLOMATIC = 'دبلوماسية',
  COLLABORATIVE = 'تعاونية',
}

export enum UserRole {
  ADMIN = 'admin',
  CREATOR = 'creator',
  VIEWER = 'viewer',
}

export enum View {
  DASHBOARD,
  CORRESPONDENCE,
  GENERATOR,
  DETAILS,
  ARCHIVE,
  INBOUND_FORM,
  TEMPLATES,
  TEMPLATE_CREATOR,
  AI_PERSONALIZATION,
  SETTINGS,
  ANALYTICS,
  CATEGORIES,
  ABOUT,
  REPORTING,
}

export enum ReferralStatus {
    PENDING = 'معلق',
    COMPLETED = 'مكتمل',
    REJECTED = 'مرفوض'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department: string;
}

export interface Referral {
    id: string;
    letterId: string;
    fromUserId: string;
    toUserId: string;
    instructions: string;
    status: ReferralStatus;
    createdAt: string;
    completedAt?: string;
    response?: string;
}

export interface ApprovalRecord {
  action: string;
  date: string;
  notes?: string;
  previousBody?: string;
  userId?: string;
  userName?: string;
}

export interface Attachment {
    id: string;
    name: string;
    type: 'pdf' | 'image' | 'word' | 'other';
    url: string;
    size: string;
    lastModified?: number;
}

export interface Comment {
    id: string;
    letterId: string;
    text: string;
    createdAt: string;
}

export interface Letter {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  status: LetterStatus;
  type: LetterType;
  tone: Tone;
  body: string;
  approvalHistory: ApprovalRecord[];
  isSigned?: boolean;
  correspondenceType: CorrespondenceType;
  referenceId?: string;
  attachments?: Attachment[];
  officialCopyUrl?: string;
  currentDepartment: string;
  cc?: string[];
  priority?: PriorityLevel;
  confidentiality?: ConfidentialityLevel;
  completionDays?: number;
  externalRefNumber?: string;
  internalRefNumber?: string;
  notes?: string;
  category?: string;
  summary?: string;
  creatorId?: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  letterType: LetterType;
  tone: Tone;
  objectiveTemplate: string;
}

export interface LearnedPrinciple {
  id: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  message: string;
  letterId?: string;
  read: boolean;
  timestamp: string;
}

export interface CompanySettings {
  companyName: string;
  companyLogo: string;
  primaryColor: 'indigo' | 'teal' | 'slate' | 'rose';
  departments: string[];
  defaultDepartment: string;
  externalEntities: string[];
  letterFooter: string;
  globalAIInstruction: string;
  users: User[];
}

export interface LetterVariations {
  neutral: string;
  strict: string;
  diplomatic: string;
}

export interface ContextualReferences {
  citations: string[];
  phrasingImprovements: string[];
}

export interface EnhancementSuggestion {
  original_part: string;
  suggested_improvement: string;
  reason: string;
}

export interface FollowUpItem {
    summary: string;
    letterId: string;
}

export interface ExtractedLetterDetails {
    subject?: string;
    from?: string;
    to?: string;
    date?: string;
    externalRefNumber?: string;
    letterType?: LetterType;
    category?: string;
    summary?: string;
    priority?: PriorityLevel;
    confidentiality?: ConfidentialityLevel;
    referenceId?: string;
    isSupplementary?: boolean;
    referencedNumber?: string;
}

export interface SmartReply {
    title: string;
    objective: string;
    tone: Tone;
    type: 'positive' | 'negative' | 'neutral' | 'inquiry';
}

export interface GeneratorState {
    sender: string;
    receiver: string;
    subject: string;
    letterType: LetterType;
    objective: string;
    attachments: Attachment[];
    cc: string[];
    priority: PriorityLevel;
    confidentiality: ConfidentialityLevel;
    completionDays: number | '';
    notes: string;
    tone: Tone;
    generatedVariations: LetterVariations | null;
    originalBodyForLearning: string;
    editedBody: string;
    selectedVariationKey: 'neutral' | 'strict' | 'diplomatic';
    analysisResult: string[] | null;
    contextualReferences: ContextualReferences | null;
    templateFields: Record<string, string>;
    activeTemplateObjective: string;
    referenceId?: string;
    originalLetterContent?: string;
}

export interface InboundLetterFormState {
    subject: string;
    from: string;
    to: string;
    cc: string[];
    dateReceived: string;
    letterType: LetterType;
    category: string;
    attachments: File[];
    summary: string;
    referenceId?: string;
    externalRefNumber: string;
    priority: PriorityLevel;
    confidentiality: ConfidentialityLevel;
    completionDays: number | '';
    notes: string;
}
