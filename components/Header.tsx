
import React, { useState, useRef, useEffect } from 'react';
import { Notification, View } from '../types';
import NotificationCenter from './NotificationCenter';
import { useApp } from '../App';
import { getThemeClasses } from './utils';

interface HeaderProps {
    onNotificationClick: (notification: Notification) => void;
    className?: string;
}

const Header: React.FC<HeaderProps> = ({ onNotificationClick, className }) => {
    const { state, dispatch } = useApp();
    const { notifications, companySettings: settings } = state;
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;

    const containerRef = useRef<HTMLDivElement>(null);
    const theme = getThemeClasses(settings.primaryColor);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <header className={`glass-card p-4 flex justify-end items-center gap-4 m-6 mb-0 ${className}`}>
             <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: View.SETTINGS })}
                title="الإعدادات"
                className={`px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme.ring}`}
            >
                الإعدادات
            </button>

            <div className="w-px h-6 bg-white/10"></div>

            <div ref={containerRef} className="relative">
                <button 
                    onClick={() => setIsNotificationsOpen(prev => !prev)}
                    className={`relative px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme.ring}`}
                >
                    الإشعارات
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 block px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold ring-2 ring-slate-900 transform -translate-y-1/4 translate-x-1/4">
                            {unreadCount}
                        </span>
                    )}
                </button>
                {isNotificationsOpen && (
                     <NotificationCenter 
                        onNotificationClick={(notification) => {
                            onNotificationClick(notification);
                            setIsNotificationsOpen(false);
                        }}
                        onClose={() => setIsNotificationsOpen(false)}
                    />
                )}
            </div>
        </header>
    );
};

export default Header;
