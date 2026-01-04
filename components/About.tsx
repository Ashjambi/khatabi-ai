
import React from 'react';
import { useApp } from '../App';
import { getThemeClasses } from './utils';

const FeatureCard: React.FC<{ title: string; description: string; }> = ({ title, description }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
        <div>
            <h3 className="text-lg font-black text-indigo-300 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                {title}
            </h3>
            <p className="text-slate-400 font-medium text-sm leading-relaxed">{description}</p>
        </div>
    </div>
);

const About = () => {
    const { state } = useApp();
    const { companySettings } = state;
    const theme = getThemeClasses(companySettings.primaryColor);

    const aiFeatures = [
        {
            title: 'إنشاء الخطابات الذكي',
            description: 'أنشئ مسودات احترافية لخطاباتك بثلاث نبرات مختلفة (محايدة، حازمة، دبلوماسية) بضغطة زر، مع الالتزام بالبروتوكولات الرسمية.',
        },
        {
            title: 'التدقيق والتحسين اللغوي',
            description: 'حلل مسوداتك للكشف عن أي غموض أو ضعف في الصياغة، واحصل على اقتراحات تحسين فورية مع توضيح سبب كل تعديل.',
        },
        {
            title: 'تسجيل آلي للوارد (OCR)',
            description: 'حوّل الخطابات الورقية أو ملفات PDF إلى بيانات رقمية قابلة للتحرير. يستخلص النظام الموضوع، الأطراف، التواريخ، وحتى يقترح القسم المختص للمعالجة.',
        },
        {
            title: 'مساعد المتابعة الاستباقي',
            description: 'يقوم النظام بتحليل معاملاتك المعلقة وينبهك بالخطابات التي تحتاج إلى إجراء، مثل الردود المتأخرة أو الإحالات التي لم تكتمل.',
        },
        {
            title: 'تلخيص سلاسل المراسلات',
            description: 'احصل على ملخص دقيق لسلسلة طويلة من المراسلات لفهم السياق الكامل بسرعة واتخاذ قرارات مستنيرة دون الحاجة لقراءة كل شيء.',
        },
        {
            title: 'التخصيص والتعلم المستمر',
            description: 'يتعلم النظام من تعديلاتك على الخطابات التي ينشئها، ويحولها إلى قواعد تخصيص، ليصبح أسلوبه في الصياغة أقرب لأسلوبك مع مرور الوقت.',
        },
        {
            title: 'تدقيق مسار العمل الذكي',
            description: 'حلل مسار أي معاملة مكتملة، وسيكشف الذكاء الاصطناعي عن أي تأخير غير مبرر أو ثغرات في الإجراءات، مع تقديم توصيات لتحسين الكفاءة.',
        }
    ];

    const coreFeatures = [
        {
            title: 'مكتبة قوالب ديناميكية',
            description: 'أنشئ قوالبك الخاصة للمواقف المتكررة أو استخدم القوالب الجاهزة لتسريع وتوحيد جودة المراسلات في منشأتك.',
        },
        {
            title: 'نظام إحالات وتتبع مرئي',
            description: 'أحل المعاملات بين الأقسام بسهولة، وتابع مسارها عبر خط زمني مرئي يوضح الإجراءات المتخذة في كل مرحلة والوقت المستغرق.',
        },
        {
            title: 'أرشيف مركزي وبحث متقدم',
            description: 'ابحث في آلاف الخطابات بفلاتر دقيقة تشمل الموضوع، الأرقام المرجعية، التواريخ، والمزيد، واعثر على ما تريد في ثوانٍ.',
        },
        {
            title: 'لوحة تحليلات تفاعلية',
            description: 'اكتشف رؤى قيمة حول أداء نظام المراسلات من خلال رسوم بيانية تفاعلية توضح حجم العمل، أداء الأقسام، ومتوسط وقت الإنجاز.',
        },
        {
            title: 'إدارة الصلاحيات والمستخدمين',
            description: 'أدر المستخدمين بسهولة، وحدد صلاحيات كل منهم (مدير، معتمد، منشئ، مطلع)، وقم بتعيينهم للأقسام المختلفة لضمان سير عمل آمن ومنظم.',
        },
        {
            title: 'نظام تعليقات وإشارات',
            description: 'ناقش المعاملات مع فريقك داخليًا، وأشر إلى زملائك لإعلامهم بتعليقك وتسهيل التواصل المباشر حول أي خطاب.',
        },
    ];

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="text-right mb-8">
                <h1 className="text-3xl font-black text-white tracking-tight">حول نظام خطابي</h1>
                <p className="mt-2 text-lg font-bold text-slate-400">
                    نظام ذكي لإدارة وصياغة المراسلات الرسمية، مصمم لرفع كفاءة التواصل الإداري وتوحيد الإجراءات.
                </p>
            </div>

            {/* Single Unified Frame */}
            <div className="glass-card rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl">
                {/* Decorative Top Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>

                <div className="p-8 md:p-10">
                    
                    {/* Section 1: AI Features */}
                    <div className="mb-10">
                        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                            <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
                            القدرات المدعومة بالذكاء الاصطناعي
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {aiFeatures.map((feature, index) => (
                                <FeatureCard key={index} {...feature} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-10"></div>

                    {/* Section 2: Core Features */}
                    <div className="mb-10">
                        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                            <span className="w-2 h-8 bg-cyan-500 rounded-full"></span>
                            المميزات الأساسية للنظام
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {coreFeatures.map((feature, index) => (
                                <FeatureCard key={index} {...feature} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-10"></div>

                    {/* Section 3: Support */}
                    <div>
                        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                            <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                            للتواصل والدعم الفني
                        </h2>
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                            <p className="text-slate-400 font-medium">
                                نحن هنا لمساعدتك. إذا واجهت أي مشكلة أو كان لديك أي استفسار، لا تتردد في التواصل معنا.
                            </p>
                            <div className="flex flex-col gap-2 items-end">
                                <a href="mailto:support@khatabi.app" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-500/10 px-4 py-2 rounded-lg transition-colors">
                                    <span>support@khatabi.app</span>
                                </a>
                                <span className="text-slate-500 font-mono font-bold text-sm">+966 11 123 4567</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default About;
