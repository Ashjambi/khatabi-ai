
import React from 'react';

interface DiffViewerProps {
    oldText: string;
    newText: string;
    onClose: () => void;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ oldText, newText, onClose }) => {
    const oldLines = oldText.replace(/<[^>]*>?/gm, ' ').split('\n');
    const newLines = newText.replace(/<[^>]*>?/gm, ' ').split('\n');

    const maxLines = Math.max(oldLines.length, newLines.length);
    const diffLines = [];

    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];

        let type = 'unchanged';
        if (oldLine === undefined) {
            type = 'added';
        } else if (newLine === undefined) {
            type = 'deleted';
        } else if (oldLine !== newLine) {
            type = 'modified';
        }

        diffLines.push({ oldLine, newLine, type });
    }

    const getLineClass = (type: string) => {
        switch (type) {
            case 'added': return 'bg-emerald-500/20 text-emerald-100';
            case 'deleted': return 'bg-rose-500/20 text-rose-100';
            case 'modified': return 'bg-amber-500/20 text-amber-100';
            default: return 'text-slate-300';
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-slate-900 rounded-2xl p-6 w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] border border-white/10"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                    <h3 className="text-xl font-bold text-white">مقارنة التغييرات</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white font-bold">
                        X
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                        <div>
                            <h4 className="font-bold text-center text-slate-300 bg-white/5 p-2 rounded-t-md border border-white/5 border-b-0">النسخة السابقة</h4>
                            <div className="border border-white/10 rounded-b-md p-2 bg-black/20">
                                {diffLines.map((line, i) => (
                                    <pre key={i} className={`whitespace-pre-wrap p-1 ${line.type === 'added' ? 'opacity-0' : getLineClass(line.type)}`}>
                                       {line.oldLine || ''}
                                    </pre>
                                ))}
                            </div>
                        </div>
                         <div>
                            <h4 className="font-bold text-center text-slate-300 bg-white/5 p-2 rounded-t-md border border-white/5 border-b-0">النسخة الحالية</h4>
                             <div className="border border-white/10 rounded-b-md p-2 bg-black/20">
                                {diffLines.map((line, i) => (
                                    <pre key={i} className={`whitespace-pre-wrap p-1 ${line.type === 'deleted' ? 'opacity-0' : getLineClass(line.type)}`}>
                                       {line.newLine || ''}
                                    </pre>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiffViewer;
