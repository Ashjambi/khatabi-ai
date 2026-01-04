
import React, { useState, useRef, useEffect } from 'react';
import { Letter, CompanySettings } from '../types';

interface OutboundLetterHeaderProps {
    letter: Letter;
    settings: CompanySettings;
}

const OutboundLetterHeader: React.FC<OutboundLetterHeaderProps> = ({ letter, settings }) => {
    // Generate QR Code URL
    const qrCodeUrl = letter.internalRefNumber
        ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(letter.internalRefNumber)}`
        : '';

    // Drag Logic State
    const [position, setPosition] = useState({ x: 20, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const elementRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        e.preventDefault(); // Prevent text selection
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragStartRef.current) return;
            
            const newX = e.clientX - dragStartRef.current.x;
            const newY = e.clientY - dragStartRef.current.y;
            
            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragStartRef.current = null;
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div className="printable-header relative" style={{ height: '220px' }}>
            {/* Base Header with Logo (Fixed Center) */}
            <div className="flex justify-center items-start pb-4 border-b-2 border-slate-800 absolute top-0 w-full">
                {settings.companyLogo ? (
                    <img src={settings.companyLogo} alt={`${settings.companyName} Logo`} style={{ maxHeight: '100px', maxWidth: '300px', objectFit: 'contain' }} />
                ) : (
                    <div className="text-center pt-2">
                        <h1 className="text-3xl font-bold text-slate-800">{settings.companyName}</h1>
                        <p className="text-sm text-slate-600 font-bold mt-1">نظام المراسلات الإدارية</p>
                    </div>
                )}
            </div>

            {/* Draggable Sticker (Movable) */}
            <div 
                ref={elementRef}
                onMouseDown={handleMouseDown}
                style={{ 
                    position: 'absolute', 
                    top: `${position.y}px`, 
                    left: `${position.x}px`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    zIndex: 1000
                }}
                className={`
                    bg-white border-2 border-slate-800 rounded-lg p-2 shadow-xl flex items-center gap-3 select-none
                    print:shadow-none print:border-2 print:absolute hover:border-indigo-500 transition-colors
                `}
                title="اضغط واسحب لتحريك الملصق"
            >
                {/* QR Code */}
                {qrCodeUrl && (
                    <div className="flex-shrink-0 border-r border-slate-300 pr-2">
                        <img src={qrCodeUrl} alt="QR" className="w-20 h-20" />
                    </div>
                )}

                {/* Details */}
                <div className="flex-grow text-xs text-slate-800 space-y-1.5 font-bold min-w-[180px]">
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>رقم الصادر:</span>
                        <span className="font-mono text-lg tracking-widest">{letter.internalRefNumber || '---'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>التاريخ:</span>
                        <span className="font-mono text-sm">{letter.date}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>المشفوعات:</span>
                        <span>{letter.attachments?.length || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OutboundLetterHeader;
