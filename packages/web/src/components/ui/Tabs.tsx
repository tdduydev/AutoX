import React from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;
}

interface TabsProps {
    tabs: Tab[];
    active: string;
    onChange: (id: string) => void;
    className?: string;
}

export function Tabs({ tabs, active, onChange, className = '' }: TabsProps) {
    return (
        <div className={`inline-flex gap-1.5 rounded-lg bg-background-soft/50 p-1.5 border border-border shadow-inner ${className}`}>
            {tabs.map(tab => {
                const isActive = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-200 select-none ${isActive
                                ? 'bg-background text-primary-light shadow-sm shadow-black/20 ring-1 ring-border'
                                : 'text-foreground-muted hover:text-foreground hover:bg-background-hover/50'
                            }`}
                    >
                        {tab.icon && <span className={`${isActive ? 'text-primary' : ''} transition-colors`}>{tab.icon}</span>}
                        {tab.label}
                        {tab.count != null && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-primary/20 text-primary-light' : 'bg-background-soft text-foreground-muted'
                                }`}>{tab.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
