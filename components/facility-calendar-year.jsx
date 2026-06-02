'use client';

import { eachMonthOfInterval, endOfYear, isSameMonth, startOfYear } from 'date-fns';
import { eventsInMonth } from '@/lib/facility-calendar';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function FacilityCalendarYear({ selectedYear, events = [], onSelectMonth, hideNavigation = false }) {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const months = eachMonthOfInterval({ start: yearStart, end: endOfYear(yearStart) });

    return (
        <div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-white shadow-lg">
            {!hideNavigation && (
                <div className="bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] px-4 py-3">
                    <h2 className="text-xl font-bold text-white">{selectedYear}</h2>
                </div>
            )}
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                {months.map((month, idx) => {
                    const count = eventsInMonth(events, month).length;
                    const current = isSameMonth(month, new Date());
                    return (
                        <button
                            key={month.toISOString()}
                            type="button"
                            onClick={() => onSelectMonth?.(month)}
                            className={`rounded-xl border p-4 text-left transition hover:border-[#047857]/40 hover:bg-[#047857]/5 ${current ? 'border-[#ff8829]/50 bg-[#fff4eb]/50' : 'border-slate-200 bg-white'}`}
                        >
                            <p className="text-sm font-semibold text-slate-800">{MONTH_NAMES[idx]}</p>
                            <p className="mt-2 text-2xl font-bold text-[#047857]">{count}</p>
                            <p className="text-xs text-slate-500">booking{count === 1 ? '' : 's'}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
