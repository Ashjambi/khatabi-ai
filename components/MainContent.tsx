
import React, { useMemo } from 'react';
// @FIX: Removed unused ReferralStatus from imports to fix module export error
import { View } from '../types';
import { useApp } from '../App';
import LetterGenerator from './LetterGenerator';
import LetterDetails from './LetterDetails';
import Archive from './Archive';
import InboundLetterForm from './InboundLetterForm';
import Dashboard from './Dashboard';
import TemplateLibrary from './TemplateLibrary';
import TemplateCreator from './TemplateCreator';
import Settings from './Settings';
import Analytics from './Analytics';
import CategoriesView from './CategoriesView';
import { getVisibleLetters } from './utils';
import About from './About';
import Reporting from './Reporting';
import Correspondence from './Correspondence';

interface MainContentProps {}

export default function MainContent(props: MainContentProps): React.ReactNode {
  const { state, dispatch } = useApp();
  const { 
    currentView: view, 
    selectedLetterId,
    letters: allLetters,
    companySettings,
  } = state;
  
  const visibleLetters = useMemo(() => getVisibleLetters(allLetters), [allLetters]);
  const selectedLetter = allLetters.find(l => l.id === selectedLetterId) || null;

  const renderView = () => {
    switch (view) {
        case View.DASHBOARD:
            return <Dashboard />;
        case View.CORRESPONDENCE:
            return <Correspondence />;
        case View.GENERATOR:
          return <LetterGenerator />;
        case View.DETAILS:
          return selectedLetter ? (
            <LetterDetails letter={selectedLetter} />
          ) : (
            <div className="text-center text-slate-400 mt-10 font-bold">الرجاء اختيار خطاب لعرض تفاصيله أو إنشاء خطاب جديد.</div>
          );
        case View.ARCHIVE:
          return <Archive />;
        case View.INBOUND_FORM:
          return <InboundLetterForm />;
        case View.TEMPLATES:
          return <TemplateLibrary />;
        case View.TEMPLATE_CREATOR:
          return <TemplateCreator />;
        case View.SETTINGS:
            return <Settings />;
        case View.ANALYTICS:
            return <Analytics allLetters={visibleLetters} settings={companySettings} />;
        case View.REPORTING:
            return <Reporting />;
        case View.CATEGORIES:
            return <CategoriesView />;
        case View.ABOUT:
            return <About />;
        default:
          return <div className="text-center text-slate-400 mt-10 font-bold">مرحباً بك في نظام إدارة المراسلات.</div>;
    }
  }

  return (
    <div className="h-full">
        {/* We removed the wrapping card here to let individual components manage their own glass cards */}
        {renderView()}
    </div>
  )
}
