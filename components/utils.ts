
import React, { useState, useEffect } from 'react';
import { CompanySettings, LetterStatus, PriorityLevel, ConfidentialityLevel, Letter, User } from '../types';

// Simple sanitizer to strip dangerous tags (script, iframe, object, etc.)
// In a production env, use a library like DOMPurify. This is a lightweight implementation.
export const sanitizeHTML = (html: string): string => {
    if (!html) return '';
    
    // Create a temporary DOM element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove dangerous tags
    const badTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'head', 'link', 'meta'];
    badTags.forEach(tag => {
        const elements = tempDiv.querySelectorAll(tag);
        elements.forEach(el => el.remove());
    });

    // Remove event handlers (e.g., onclick, onmouseover)
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
            if (attrs[i].name.startsWith('on') || attrs[i].value.startsWith('javascript:')) {
                el.removeAttribute(attrs[i].name);
            }
        }
    });

    return tempDiv.innerHTML;
};

export const getThemeClasses = (color: CompanySettings['primaryColor']) => {
    const themes = {
        indigo: { text: 'text-indigo-600', bg: 'bg-indigo-600', hoverBg: 'hover:bg-indigo-700', ring: 'focus:ring-indigo-500', border: 'border-indigo-500', lightBg: 'bg-indigo-50', lightText: 'text-indigo-800', tabActive: 'border-indigo-500 text-indigo-600', tabInactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300', hoverLightBg: 'hover:bg-indigo-100', icon: 'text-indigo-500' },
        teal: { text: 'text-teal-600', bg: 'bg-teal-600', hoverBg: 'hover:bg-teal-700', ring: 'focus:ring-teal-500', border: 'border-teal-500', lightBg: 'bg-teal-50', lightText: 'text-teal-800', tabActive: 'border-teal-500 text-teal-600', tabInactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300', hoverLightBg: 'hover:bg-teal-100', icon: 'text-teal-500' },
        slate: { text: 'text-slate-600', bg: 'bg-slate-600', hoverBg: 'hover:bg-slate-700', ring: 'focus:ring-slate-500', border: 'border-slate-500', lightBg: 'bg-slate-100', lightText: 'text-slate-800', tabActive: 'border-slate-500 text-slate-600', tabInactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300', hoverLightBg: 'hover:bg-slate-200', icon: 'text-slate-500' },
        rose: { text: 'text-rose-600', bg: 'bg-rose-600', hoverBg: 'hover:bg-rose-700', ring: 'focus:ring-rose-500', border: 'border-rose-500', lightBg: 'bg-rose-50', lightText: 'text-rose-800', tabActive: 'border-rose-500 text-rose-600', tabInactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300', hoverLightBg: 'hover:bg-rose-100', icon: 'text-rose-500' },
    };
    return themes[color] || themes.indigo;
};


export const getStatusChip = (status: LetterStatus) => {
    const styles: {[key in LetterStatus]?: {dot: string, text: string, bg: string}} = {
      [LetterStatus.SENT]: { dot: 'bg-emerald-500', text: 'text-emerald-800', bg: 'bg-emerald-100' },
      [LetterStatus.PENDING_REVIEW]: { dot: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-100' },
      [LetterStatus.PENDING_AUDIT]: { dot: 'bg-purple-500', text: 'text-purple-800', bg: 'bg-purple-100' },
      [LetterStatus.PENDING_INTERNAL_REVIEW]: { dot: 'bg-orange-500', text: 'text-orange-800', bg: 'bg-orange-100' },
      [LetterStatus.AWAITING_REPLY]: { dot: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-100' },
      [LetterStatus.REPLIED]: { dot: `bg-indigo-500`, text: 'text-indigo-800', bg: 'bg-indigo-100' },
      [LetterStatus.ARCHIVED]: { dot: 'bg-slate-500', text: 'text-slate-800', bg: 'bg-slate-100' },
      [LetterStatus.DRAFT]: { dot: 'bg-slate-500', text: 'text-slate-800', bg: 'bg-slate-100' },
      [LetterStatus.APPROVED]: { dot: 'bg-teal-500', text: 'text-teal-800', bg: 'bg-teal-100' },
      [LetterStatus.RECEIVED]: { dot: 'bg-violet-500', text: 'text-violet-800', bg: 'bg-violet-100' },
      [LetterStatus.REJECTED]: { dot: 'bg-red-500', text: 'text-red-800', bg: 'bg-red-100' },
    };
    const style = styles[status] || { dot: 'bg-slate-500', text: 'text-slate-800', bg: 'bg-slate-100' };

    return React.createElement(
        'div',
        { className: `inline-flex items-center gap-x-2 rounded-md px-2.5 py-1 text-xs font-bold ${style.bg} ${style.text}` },
        React.createElement('span', { className: `h-2 w-2 rounded-full ${style.dot}` }),
        status
    );
};

export const getPriorityChip = (priority?: PriorityLevel) => {
    if (!priority) return null;
    const styles: {[key in PriorityLevel]: { text: string, bg: string }} = {
      [PriorityLevel.URGENT]: { text: 'text-red-800', bg: 'bg-red-100' },
      [PriorityLevel.HIGH]: { text: 'text-amber-800', bg: 'bg-amber-100' },
      [PriorityLevel.NORMAL]: { text: 'text-slate-800', bg: 'bg-slate-100' },
    };
    const style = styles[priority] || styles[PriorityLevel.NORMAL];
    return React.createElement('span', { className: `inline-block rounded-md px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}` }, priority);
}

export const getConfidentialityChip = (confidentiality?: ConfidentialityLevel) => {
    if (!confidentiality) return null;
    const styles: {[key in ConfidentialityLevel]: { text: string, bg: string }} = {
      [ConfidentialityLevel.TOP_SECRET]: { text: 'text-red-800', bg: 'bg-red-100 border border-red-200' },
      [ConfidentialityLevel.CONFIDENTIAL]: { text: 'text-blue-800', bg: 'bg-blue-100 border border-blue-200' },
      [ConfidentialityLevel.NORMAL]: { text: 'text-slate-800', bg: 'bg-slate-100 border border-slate-200' },
    };
    const style = styles[confidentiality] || styles[ConfidentialityLevel.NORMAL];
    return React.createElement('span', { className: `inline-block rounded-md px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}` }, confidentiality);
}

export const getVisibleLetters = (letters: Letter[], currentUser?: User | null): Letter[] => {
  // In single-user mode, all letters are always visible
  return letters;
};
