import React from 'react';
import { Clock, History as HistoryIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabButtonsProps {
    activeTab: 'pending' | 'history';
    onTabChange: (tab: 'pending' | 'history') => void;
    pendingCount?: number;
    historyCount?: number;
    pendingLabel?: string;
    historyLabel?: string;
    className?: string;
}

export function TabButtons({
    activeTab,
    onTabChange,
    pendingCount = 0,
    historyCount = 0,
    pendingLabel = 'Pending',
    historyLabel = 'History',
    className,
}: TabButtonsProps) {
    return (
        <div className={cn("flex items-center gap-4 shrink-0 px-1 py-0.5 bg-white mr-2", className)}>
            <button
                type="button"
                onClick={() => onTabChange('pending')}
                className={cn(
                    "relative pb-2 pt-1 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                    activeTab === 'pending'
                        ? "text-indigo-600 font-bold"
                        : "text-gray-500 hover:text-gray-700"
                )}
            >
                <Clock size={16} className={activeTab === 'pending' ? 'text-indigo-600' : 'text-gray-400'} />
                <span>{pendingLabel} ({pendingCount})</span>
                {activeTab === 'pending' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                )}
            </button>
            <button
                type="button"
                onClick={() => onTabChange('history')}
                className={cn(
                    "relative pb-2 pt-1 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                    activeTab === 'history'
                        ? "text-indigo-600 font-bold"
                        : "text-gray-500 hover:text-gray-700"
                )}
            >
                <HistoryIcon size={16} className={activeTab === 'history' ? 'text-indigo-600' : 'text-gray-400'} />
                <span>{historyLabel} ({historyCount})</span>
                {activeTab === 'history' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                )}
            </button>
        </div>
    );
}

export default TabButtons;
