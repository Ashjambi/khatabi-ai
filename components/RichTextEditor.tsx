
import React, { useRef, useEffect } from 'react';
import { BoldIcon, ItalicIcon, UnderlineIcon, ListIcon, ListOrderedIcon } from './icons';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  ringColor?: string;
  minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, ringColor = 'focus-within:ring-indigo-500', minHeight = 'min-h-[400px]' }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Set initial content
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCmd = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
    handleInput(); 
  };

  const ToolbarButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
    <button
        type="button"
        onClick={onClick}
        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-300"
        title={title}
    >
        {children}
    </button>
  )

  return (
    <div className={`flex flex-col rounded-xl overflow-hidden border border-slate-300 shadow-xl bg-white focus-within:ring-4 focus-within:ring-opacity-50 transition-shadow duration-300 ${ringColor.replace('focus-within:', 'focus-within:')}`}>
      {/* Toolbar - Light Gray to distinguish from paper */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1 flex-wrap">
        <ToolbarButton onClick={() => execCmd('bold')} title="عريض"><BoldIcon className="w-5 h-5" /></ToolbarButton>
        <ToolbarButton onClick={() => execCmd('italic')} title="مائل"><ItalicIcon className="w-5 h-5" /></ToolbarButton>
        <ToolbarButton onClick={() => execCmd('underline')} title="تسطير"><UnderlineIcon className="w-5 h-5" /></ToolbarButton>
        <div className="w-px h-6 bg-slate-300 mx-2"></div>
        <ToolbarButton onClick={() => execCmd('insertUnorderedList')} title="قائمة نقطية"><ListIcon className="w-5 h-5" /></ToolbarButton>
        <ToolbarButton onClick={() => execCmd('insertOrderedList')} title="قائمة رقمية"><ListOrderedIcon className="w-5 h-5" /></ToolbarButton>
      </div>
      
      {/* Editor Area - White Paper */}
      <div className="flex-grow bg-white cursor-text relative">
        <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            className={`w-full p-8 text-slate-900 leading-loose text-lg font-medium focus:outline-none ${minHeight} prose max-w-none prose-p:text-slate-800 prose-headings:text-slate-900 prose-strong:text-slate-900`}
            style={{ direction: 'rtl' }}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
