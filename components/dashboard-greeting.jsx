'use client';
import { useEffect, useMemo, useState } from 'react';
function getGreeting(hours) {
    if (hours < 12)
        return 'Good morning';
    if (hours < 17)
        return 'Good afternoon';
    return 'Good evening';
}
function getFirstName(name) {
    if (!name)
        return 'User';
    const cleaned = String(name).trim();
    if (!cleaned)
        return 'User';
    // If a username/email-like value is present, take everything before "@"
    if (cleaned.includes('@')) {
        const emailPrefix = cleaned.split('@')[0]?.trim();
        if (!emailPrefix)
            return 'User';
        const withoutNumbers = emailPrefix.replace(/\d+$/g, '');
        return withoutNumbers || emailPrefix;
    }
    // Otherwise use first token of the full name.
    const firstToken = cleaned.split(/\s+/)[0] || 'User';
    const normalized = firstToken.replace(/\d+$/g, '');
    return normalized || firstToken;
}
export function DashboardGreeting({ name, subtitle }) {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    const greeting = useMemo(() => getGreeting(now.getHours()), [now]);
    const firstName = useMemo(() => getFirstName(name), [name]);
    const fullDate = useMemo(() => now.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }), [now]);
    const currentTime = useMemo(() => now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    }), [now]);
    return (<div className="mb-6 rounded-2xl border border-[#047857]/25 bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] p-4 shadow-[0_16px_40px_-24px_rgba(4,120,87,0.8)] sm:mb-8 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-2 text-white/90">{subtitle}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-left shadow-sm backdrop-blur sm:text-right">
          <p className="text-sm font-semibold text-white">{currentTime}</p>
          <p className="text-xs text-white/90">{fullDate}</p>
        </div>
      </div>
    </div>);
}
