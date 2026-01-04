
import React from 'react';
import { Notification } from '../types';
import { useApp } from '../App';
import { getThemeClasses } from './utils';

interface NotificationCenterProps {
    onNotificationClick: (notification: Notification) => void;
    onClose: () => void;
}


const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNotificationClick }) => {
    const { state, dispatch } = useApp();
    const { notifications, companySettings: settings } = state;
    const theme = getThemeClasses(settings.primaryColor);
    
    const onMarkAllAsRead = () => {
        dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
    };

    return (
        <div
            className="origin-top-right absolute left-0 mt-2 w-80 rounded-lg shadow-2xl bg-slate-900 border border-white/10 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 backdrop-blur-xl"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="menu-button"
        >
            <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-lg">
                <h3 className="font-semibold text-white">الإشعارات</h3>
                <button onClick={onMarkAllAsRead} className={`text-xs ${theme.text} hover:underline`}>
                    تحديد الكل كمقروء
                </button>
            </div>
            <div className="py-1 max-h-96 overflow-y-auto custom-scrollbar" role="none">
                {notifications.length === 0 && (
                    <p className="text-center text-slate-500 py-6 text-sm">لا توجد إشعارات جديدة.</p>
                )}
                {notifications.map(notification => (
                    <button
                        key={notification.id}
                        onClick={() => onNotificationClick(notification)}
                        className={`w-full text-right block px-4 py-3 text-sm transition-colors border-b border-white/5 last:border-0 ${notification.read ? 'text-slate-500 hover:bg-white/5' : `text-white bg-indigo-500/10 hover:bg-indigo-500/20`}`}
                        role="menuitem"
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-1 min-w-[30px]">
                                {notification.read ? <span className="text-[10px] font-bold text-slate-500">مقروء</span> : <span className={`text-[10px] font-bold ${theme.text}`}>جديد</span>}
                            </div>
                            <div className="flex-1">
                                <p className={`leading-snug ${!notification.read && 'font-semibold'}`}>{notification.message}</p>
                                <p className="text-xs text-slate-500 mt-1">{notification.timestamp}</p>
                            </div>
                        </div>

                    </button>
                ))}
            </div>
        </div>
    );
};

export default NotificationCenter;
