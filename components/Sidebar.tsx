
import React from 'react';
import { View, CompanySettings } from '../types';
import { useApp } from '../App';
import { getThemeClasses } from './utils';
import { SettingsIcon, InfoIcon, LayoutTemplateIcon, BarChart3Icon, FileTextIcon, FilePlusIcon, ArchiveIcon, InboxInIcon, HomeIcon, FileCheck2Icon } from './icons';

interface SidebarProps {
  className?: string;
}

// Inline icons for toggle to ensure specific look without editing icons.tsx
const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

export default function Sidebar({ className }: SidebarProps): React.ReactNode {
  const { state, dispatch } = useApp();
  const { currentView, companySettings: settings, isSidebarCollapsed } = state;

  const setCurrentView = (view: View) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  }
  
  const toggleSidebar = () => {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
  }

  const theme = getThemeClasses(settings.primaryColor);

  const NavButton: React.FC<{
    view: View;
    currentView: View;
    text: string;
    isPrimary?: boolean;
    isSpecial?: boolean;
    compareViews?: View[]
  }> = ({ view, currentView, text, isPrimary = false, isSpecial = false, compareViews }) => {
    const isActive = currentView === view || (compareViews && compareViews.includes(currentView));
    
    // Base container class
    let containerClass = `
        group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer
        ${isSidebarCollapsed ? 'justify-center w-12 h-12 mx-auto' : 'w-full'}
    `;

    // Active State Styling
    if (isActive) {
      if (isPrimary) {
        containerClass += ` btn-3d ${theme.bg} text-white shadow-lg`;
      } else if (isSpecial) {
        containerClass += ` bg-violet-600 text-white shadow-lg btn-3d`;
      } else {
        containerClass += ` bg-white/10 text-white border border-white/10`;
      }
    } else {
        // Inactive State Styling - Brightened to text-slate-300 for better visibility
       containerClass += ' text-slate-300 hover:text-white hover:bg-white/5';
    }

    return (
      <button onClick={() => setCurrentView(view)} className={containerClass} title={isSidebarCollapsed ? text : ''}>
        {!isSidebarCollapsed && (
            <span className={`font-bold text-sm whitespace-nowrap overflow-hidden transition-opacity duration-200 ${isActive ? 'text-white' : ''}`}>
                {text}
            </span>
        )}
        {isSidebarCollapsed && (
             <span className={`font-bold text-xs whitespace-nowrap overflow-hidden transition-opacity duration-200 ${isActive ? 'text-white' : ''}`}>
                {text.charAt(0)}
            </span>
        )}
        
        {/* Tooltip for collapsed mode */}
        {isSidebarCollapsed && (
            <div className="absolute right-14 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/10 shadow-xl">
                {text}
            </div>
        )}
      </button>
    );
  };


  return (
    <aside className={`
        flex flex-col h-[calc(100vh-2rem)] m-4 rounded-3xl border border-white/5 shadow-2xl overflow-hidden glass-card transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? 'w-24' : 'w-72'} 
        ${className}
    `}>
      {/* Brand Header */}
      <div className={`p-4 border-b border-white/5 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} transition-all`}>
        <div 
            onClick={toggleSidebar}
            className="cursor-pointer relative w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_15px_rgba(99,102,241,0.5)] hover:scale-105 transition-transform"
        >
             {settings.companyLogo ? (
                 <img src={settings.companyLogo} alt="Logo" className="w-6 h-6 object-contain" />
             ) : (
                 <span className="text-white font-bold text-lg">خ</span>
             )}
        </div>
        {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
                <h1 className="text-lg font-black text-white tracking-wide truncate leading-tight">
                  {settings.companyName}
                </h1>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider truncate">نظام المراسلات</p>
            </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {!isSidebarCollapsed && <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">الرئيسية</p>}
        <NavButton view={View.DASHBOARD} currentView={currentView} text="الرئيسية" />
        <NavButton view={View.CORRESPONDENCE} currentView={currentView} text="المراسلات" />
        
        <div className={`my-4 border-t border-white/5 mx-2 ${isSidebarCollapsed ? 'border-transparent' : ''}`}></div>
        
        {!isSidebarCollapsed && <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">إجراءات</p>}
        <NavButton view={View.GENERATOR} currentView={currentView} text="إنشاء خطاب" isPrimary />
        <NavButton view={View.INBOUND_FORM} currentView={currentView} text="تسجيل وارد" isSpecial />
        
        <div className={`my-4 border-t border-white/5 mx-2 ${isSidebarCollapsed ? 'border-transparent' : ''}`}></div>

        {!isSidebarCollapsed && <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">أدوات</p>}
        <NavButton view={View.ANALYTICS} currentView={currentView} text="التحليلات" />
        <NavButton view={View.REPORTING} currentView={currentView} text="التقارير" />
        <NavButton view={View.TEMPLATES} currentView={currentView} text="القوالب" compareViews={[View.TEMPLATE_CREATOR]} />
        <NavButton view={View.CATEGORIES} currentView={currentView} text="الفئات" />
        <NavButton view={View.ARCHIVE} currentView={currentView} text="البحث" />

        <div className={`my-4 border-t border-white/5 mx-2 ${isSidebarCollapsed ? 'border-transparent' : ''}`}></div>

        {!isSidebarCollapsed && <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">النظام</p>}
        <NavButton view={View.SETTINGS} currentView={currentView} text="الإعدادات" />
        <NavButton view={View.ABOUT} currentView={currentView} text="حول" />
      </nav>

      {/* Footer - Toggle with Icon and Text */}
      <div className="p-3 border-t border-white/5 bg-white/5">
          <button 
            onClick={toggleSidebar}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group hover:bg-white/10 ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isSidebarCollapsed ? "توسيع القائمة" : "طي القائمة"}
          >
              <div className={`text-slate-400 group-hover:text-white transition-colors`}>
                  {/* Logic: If collapsed, show Left Arrow (expand). If expanded, show Right Arrow (collapse) for RTL layout */}
                  {isSidebarCollapsed ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
              </div>
              {!isSidebarCollapsed && (
                  <span className="font-bold text-sm text-slate-300 group-hover:text-white transition-colors">
                      طي القائمة
                  </span>
              )}
          </button>
      </div>
    </aside>
  );
}
