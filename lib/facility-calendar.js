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

/**
 * Build full-day calendar events from course documents.
 * @param {object[]} programs - normalized programs with partner_ids / partner_names
 * @param {Record<string, string>} partnerMap - partner id → display name
 * @param {{ hidePast?: boolean }} options - hidePast: end date before today (calendar only)
 */
export function buildFacilityCalendarEvents(programs, partnerMap = {}, { hidePast = true } = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = (programs || [])
        .map((program) => {
            const { start, end } = getProgramStartEnd(program);
            if (!start || !end)
                return null;
            if (hidePast && end < today)
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
                status: String(program.status || 'upcoming').toLowerCase(),
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

export function getStatusCalendarStyles(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'ongoing') {
        return {
            bar: 'bg-[#ff8829]/20 border-[#ff8829]/50 text-[#9a3f05]',
            dot: 'bg-[#ff8829]',
        };
    }
    if (s === 'completed') {
        return {
            bar: 'bg-emerald-100 border-emerald-300 text-emerald-900',
            dot: 'bg-emerald-600',
        };
    }
    return {
        bar: 'bg-[#047857]/15 border-[#047857]/35 text-[#047857]',
        dot: 'bg-[#047857]',
    };
}
