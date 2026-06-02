import { getCourseKeyFromProgram, getCourseLabel } from '@/lib/renewable-energy-courses';

export const RETC_FACILITY_NAME = 'RETC Training Facility';

function parseDateOnly(value) {
    if (!value)
        return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function getProgramStartEnd(program) {
    const start = parseDateOnly(
        program.start_date
        || program.startDate
        || program['start-date'],
    );
    const end = parseDateOnly(
        program.end_date
        || program.endDate
        || program['end-date']
        || program['end-time'],
    );
    if (!start)
        return { start: null, end: null };
    const endDate = end && end >= start ? end : start;
    return { start, end: endDate };
}

function getTrainingPartnerDisplay(program, partnerMap = {}) {
    const id = String(program.training_partner_id || program.trainingPartnerId || '').trim();
    if (id && partnerMap[id])
        return partnerMap[id];
    const raw = program.training_partner
        || program.trainingPartner
        || program['training-partners']
        || program.training_partners;
    if (typeof raw === 'string' && raw.trim())
        return raw.trim();
    if (raw && typeof raw === 'object')
        return String(raw.name || raw.title || '').trim();
    return 'Unnamed partner';
}

function getOtherPartnerNames(program, partnerMap = {}) {
    const names = Array.isArray(program.partner_names) ? program.partner_names.filter(Boolean) : [];
    if (names.length > 0)
        return names;
    const mainId = String(program.training_partner_id || program.trainingPartnerId || '').trim();
    const ids = Array.isArray(program.partner_ids) ? program.partner_ids : [];
    return ids
        .filter((id) => id && id !== mainId)
        .map((id) => partnerMap[id] || '')
        .filter(Boolean);
}

function matchesStatusFilter(status, statusFilter) {
    const f = String(statusFilter || 'all').toLowerCase();
    if (f === 'all')
        return true;
    return String(status || '').toLowerCase() === f;
}

/**
 * Build full-day calendar events from course documents.
 * @param {{ statusFilter?: 'all'|'upcoming'|'ongoing'|'completed', hidePast?: boolean }} options
 */
export function buildFacilityCalendarEvents(programs, partnerMap = {}, { statusFilter = 'all', hidePast = false } = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = (programs || [])
        .map((program) => {
            const { start, end } = getProgramStartEnd(program);
            if (!start || !end)
                return null;
            if (hidePast && end < today)
                return null;
            const status = String(program.status || 'upcoming').toLowerCase();
            if (!matchesStatusFilter(status, statusFilter))
                return null;
            const courseKey = getCourseKeyFromProgram(program);
            return {
                id: program.$id,
                title: String(program.title || '').trim() || 'Untitled course',
                courseLabel: program.course_label || getCourseLabel(courseKey),
                courseKey,
                start,
                end,
                startIso: start.toISOString(),
                endIso: end.toISOString(),
                status,
                trainingPartner: getTrainingPartnerDisplay(program, partnerMap),
                otherPartners: getOtherPartnerNames(program, partnerMap),
                location: String(
                    program.training_location
                    || program.trainingLocation
                    || program.location
                    || program.venue
                    || RETC_FACILITY_NAME,
                ).trim() || RETC_FACILITY_NAME,
                program,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

    return markOverlappingEvents(events);
}

function rangesOverlap(a, b) {
    return a.start <= b.end && b.start <= a.end;
}

function markOverlappingEvents(events) {
    const list = events.map((e) => ({ ...e, hasOverlap: false }));
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            if (rangesOverlap(list[i], list[j])) {
                list[i].hasOverlap = true;
                list[j].hasOverlap = true;
            }
        }
    }
    return list;
}

/** Events active on a given calendar day (full-day, inclusive). */
export function eventsOnDay(events, day) {
    const d = parseDateOnly(day);
    if (!d)
        return [];
    return (events || []).filter((e) => e.start <= d && e.end >= d);
}

export function formatEventDateRange(start, end) {
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    const a = start.toLocaleDateString(undefined, opts);
    const b = end.toLocaleDateString(undefined, opts);
    if (a === b)
        return a;
    return `${a} – ${b}`;
}

export function eventsInMonth(events, monthDate) {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    end.setHours(0, 0, 0, 0);
    return (events || []).filter((e) => e.start <= end && e.end >= start);
}

/** Distinct calendar colors per course status (bar, legend dot, badge). */
export const FACILITY_STATUS_COLORS = {
    upcoming: {
        bar: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm',
        dot: 'bg-blue-600',
        badge: 'bg-blue-100 text-blue-800',
        label: 'Upcoming',
    },
    ongoing: {
        bar: 'bg-gradient-to-r from-[#ff8829] to-[#f59e0b] text-white shadow-sm',
        dot: 'bg-[#ff8829]',
        badge: 'bg-[#ff8829]/15 text-[#9a3f05]',
        label: 'Ongoing',
    },
    completed: {
        bar: 'bg-gradient-to-r from-violet-700 to-violet-600 text-white shadow-sm',
        dot: 'bg-violet-700',
        badge: 'bg-violet-100 text-violet-900',
        label: 'Completed',
    },
};

function normalizeCalendarStatus(status) {
    const s = String(status || 'upcoming').toLowerCase();
    if (s === 'ongoing' || s === 'completed')
        return s;
    return 'upcoming';
}

export function getStatusBarClass(status) {
    return FACILITY_STATUS_COLORS[normalizeCalendarStatus(status)].bar;
}

export function getStatusLegendDotClass(status) {
    return FACILITY_STATUS_COLORS[normalizeCalendarStatus(status)].dot;
}

export function getStatusBadgeClass(status) {
    return FACILITY_STATUS_COLORS[normalizeCalendarStatus(status)].badge;
}

export function getStatusCalendarStyles(status) {
    const key = normalizeCalendarStatus(status);
    const c = FACILITY_STATUS_COLORS[key];
    return {
        bar: c.bar.replace(' shadow-sm', '').replace(' text-white', ''),
        dot: c.dot,
    };
}
