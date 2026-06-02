'use client';

import {
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isToday,
    isWeekend,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { formatEventDateRange, getStatusBarClass } from '@/lib/facility-calendar';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function chunkWeeks(days) {
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }
    return weeks;
}

function dayInEvent(day, event) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    return event.start <= d && event.end >= d;
}

function buildWeekSegments(weekDays, events) {
    const segments = [];
    for (const event of events) {
        let colStart = -1;
        let colEnd = -1;
        for (let i = 0; i < weekDays.length; i++) {
            if (dayInEvent(weekDays[i], event)) {
                if (colStart < 0)
                    colStart = i;
                colEnd = i;
            }
        }
        if (colStart < 0)
            continue;
        const weekStart = weekDays[0];
        const weekEnd = weekDays[6];
        segments.push({
            event,
            colStart,
            colEnd,
            span: colEnd - colStart + 1,
            continuesBefore: event.start < weekStart,
            continuesAfter: event.end > weekEnd,
        });
    }
    segments.sort((a, b) => a.colStart - b.colStart || (b.span - a.span));
    const lanes = [];
    for (const seg of segments) {
        let lane = 0;
        while (true) {
            const taken = lanes[lane] || [];
            const clash = taken.some(
                (t) => !(seg.colEnd < t.colStart || seg.colStart > t.colEnd),
            );
            if (!clash)
                break;
            lane += 1;
        }
        if (!lanes[lane])
            lanes[lane] = [];
        lanes[lane].push(seg);
        seg.lane = lane;
    }
    return segments;
}

export function FacilityCalendarMonth({
    monthDate,
    events = [],
    onSelectEvent,
    onSelectDay,
    legend,
    hideNavigation = false,
}) {
    const monthStart = startOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const weeks = chunkWeeks(days);

    return (
        <div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-white shadow-lg">
            {!hideNavigation && (
                <div className="bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] px-4 py-3 sm:px-5">
                    <h2 className="text-lg font-bold text-white sm:text-xl">
                        {format(monthDate, 'MMMM yyyy')}
                    </h2>
                </div>
            )}

            {legend && (
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
                    {legend}
                </div>
            )}

            <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
                {WEEKDAY_LABELS.map((label) => (
                    <div
                        key={label}
                        className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="divide-y divide-slate-100">
                {weeks.map((weekDays, weekIdx) => {
                    const segments = buildWeekSegments(weekDays, events);
                    const maxLane = segments.reduce((m, s) => Math.max(m, s.lane), -1);
                    const barAreaHeight = Math.max(0, maxLane + 1) * 30 + (segments.length ? 10 : 0);

                    return (
                        <div key={weekIdx} className="relative">
                            <div className="grid grid-cols-7">
                                {weekDays.map((day) => {
                                    const inMonth = isSameMonth(day, monthDate);
                                    const today = isToday(day);
                                    const weekend = isWeekend(day);
                                    return (
                                        <button
                                            key={day.toISOString()}
                                            type="button"
                                            onClick={() => inMonth && onSelectDay?.(day)}
                                            className={`min-h-[52px] border-r border-slate-100 px-2 pt-2 text-left last:border-r-0 ${
                                                !inMonth ? 'bg-slate-50/60' : weekend ? 'bg-slate-50/40 hover:bg-[#047857]/5' : 'bg-white hover:bg-[#047857]/5'
                                            }`}
                                        >
                                            <span
                                                className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-sm font-medium ${
                                                    today
                                                        ? 'bg-[#ff8829] text-white shadow-sm'
                                                        : inMonth
                                                            ? 'text-slate-800'
                                                            : 'text-slate-400'
                                                }`}
                                            >
                                                {format(day, 'd')}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {segments.length > 0 && (
                                <div
                                    className="relative grid grid-cols-7 pb-2"
                                    style={{ minHeight: barAreaHeight }}
                                >
                                    {weekDays.map((day, i) => (
                                        <div
                                            key={`bg-${day.toISOString()}`}
                                            className={`border-r border-slate-100 last:border-r-0 ${
                                                !isSameMonth(day, monthDate) ? 'bg-slate-50/40' : ''
                                            }`}
                                            style={{ gridColumn: i + 1, gridRow: 1 }}
                                        />
                                    ))}
                                    {segments.map((seg) => {
                                        const leftPct = (seg.colStart / 7) * 100;
                                        const widthPct = (seg.span / 7) * 100;
                                        return (
                                            <button
                                                key={`${seg.event.id}-${weekIdx}-${seg.colStart}`}
                                                type="button"
                                                title={`${seg.event.title}\n${formatEventDateRange(seg.event.start, seg.event.end)}\n${seg.event.trainingPartner}`}
                                                onClick={() => onSelectEvent?.(seg.event)}
                                                className={`absolute z-10 mx-[2px] flex h-7 items-center overflow-hidden rounded-md px-2 text-left text-[11px] font-medium transition hover:brightness-110 sm:text-xs ${getStatusBarClass(seg.event.status)} ${
                                                    seg.event.hasOverlap ? 'ring-2 ring-red-400 ring-offset-1' : ''
                                                } ${seg.continuesBefore ? 'rounded-l-sm' : ''} ${seg.continuesAfter ? 'rounded-r-sm' : ''}`}
                                                style={{
                                                    left: `calc(${leftPct}% + 2px)`,
                                                    width: `calc(${widthPct}% - 4px)`,
                                                    top: seg.lane * 30 + 4,
                                                }}
                                            >
                                                <span className="truncate">
                                                    {seg.event.title}
                                                </span>
                                                {!seg.continuesBefore && seg.span >= 2 && (
                                                    <span className="ml-1 hidden truncate opacity-80 sm:inline">
                                                        · {seg.event.trainingPartner}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
