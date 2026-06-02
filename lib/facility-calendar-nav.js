/** Calendar navigation helpers (Google Calendar–style year → month → day). */

export function eventsInYear(events, year) {
    const y = Number(year);
    if (!Number.isFinite(y))
        return events || [];
    const start = new Date(y, 0, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(y, 11, 31);
    end.setHours(0, 0, 0, 0);
    return (events || []).filter((e) => e.start <= end && e.end >= start);
}

export function getYearRangeFromEvents(events, { padding = 2 } = {}) {
    const current = new Date().getFullYear();
    let min = current;
    let max = current;
    for (const e of events || []) {
        if (e.start) {
            min = Math.min(min, e.start.getFullYear());
            max = Math.max(max, e.start.getFullYear());
        }
        if (e.end) {
            min = Math.min(min, e.end.getFullYear());
            max = Math.max(max, e.end.getFullYear());
        }
    }
    min -= padding;
    max += padding;
    const years = [];
    for (let y = min; y <= max; y++)
        years.push(y);
    return years.length ? years : [current];
}

export const MONTH_OPTIONS = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' },
];

export function dateFromParts(year, month, day = 1) {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function clampDayToMonth(year, month, day) {
    const last = new Date(year, month + 1, 0).getDate();
    return Math.min(Math.max(1, day), last);
}
