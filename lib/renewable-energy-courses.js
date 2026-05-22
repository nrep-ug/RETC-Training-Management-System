import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';

/** Parent category for all training courses in this catalogue. */
export const RENEWABLE_ENERGY_PARENT_CATEGORY = 'Renewable energy courses';

/** Fixed catalogue of renewable energy courses (stable keys + display labels). */
export const RENEWABLE_ENERGY_COURSES = [
    { key: 'solar_technologies', label: 'Solar Technologies' },
    { key: 'e_mobility', label: 'E-Mobility' },
    { key: 'bioenergy_technologies', label: 'Bioenergy Technologies' },
    { key: 'energy_efficiency', label: 'Energy Efficiency' },
    { key: 'hydrogen_emerging_tech', label: 'Hydrogen & Emerging Tech' },
    { key: 'hydro_energy', label: 'Hydro-energy' },
];

export const RENEWABLE_ENERGY_COURSE_KEYS = new Set(RENEWABLE_ENERGY_COURSES.map((c) => c.key));

export const UNCATEGORIZED_COURSE_LABEL = 'Uncategorized';

const COURSE_LABEL_BY_KEY = Object.fromEntries(RENEWABLE_ENERGY_COURSES.map((c) => [c.key, c.label]));

/** Aliases from legacy or human-entered values → canonical key. */
const COURSE_KEY_ALIASES = {
    solar: 'solar_technologies',
    solar_technology: 'solar_technologies',
    solar_technologies: 'solar_technologies',
    'solar technologies': 'solar_technologies',
    e_mobility: 'e_mobility',
    emobility: 'e_mobility',
    'e-mobility': 'e_mobility',
    'e mobility': 'e_mobility',
    bioenergy: 'bioenergy_technologies',
    bioenergy_technologies: 'bioenergy_technologies',
    'bioenergy technologies': 'bioenergy_technologies',
    'bio-energy': 'bioenergy_technologies',
    energy_efficiency: 'energy_efficiency',
    'energy efficiency': 'energy_efficiency',
    hydrogen_emerging_tech: 'hydrogen_emerging_tech',
    'hydrogen & emerging tech': 'hydrogen_emerging_tech',
    'hydrogen and emerging tech': 'hydrogen_emerging_tech',
    hydro_energy: 'hydro_energy',
    'hydro-energy': 'hydro_energy',
    'hydro energy': 'hydro_energy',
};

const TITLE_INFERENCE_RULES = [
    { key: 'hydrogen_emerging_tech', test: (t) => /\bhydrogen\b/i.test(t) || /\bemerging\s+tech/i.test(t) },
    { key: 'hydro_energy', test: (t) => /\bhydro[\s-]?(energy|power|electric)?\b/i.test(t) && !/\bhydrogen\b/i.test(t) },
    { key: 'solar_technologies', test: (t) => /\bsolar\b/i.test(t) },
    { key: 'e_mobility', test: (t) => /\be[\s-]?mobility\b/i.test(t) || /\belectric\s+vehicle\b/i.test(t) || /\bev\s+training\b/i.test(t) },
    { key: 'bioenergy_technologies', test: (t) => /\bbio[\s-]?energy\b/i.test(t) || /\bbiomass\b/i.test(t) },
    { key: 'energy_efficiency', test: (t) => /\benergy\s+efficien/i.test(t) || /\befficien(cy|cies)\b/i.test(t) },
];

/**
 * Normalize a raw course value to a canonical key, or '' if unknown.
 */
export function normalizeCourseKey(raw) {
    if (raw == null || raw === '')
        return '';
    const coerced = typeof raw === 'object'
        ? (raw.key ?? raw.slug ?? raw.value ?? raw.$id ?? raw.name ?? raw.label ?? '')
        : raw;
    const normalized = String(coerced)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/&/g, 'and');
    if (RENEWABLE_ENERGY_COURSE_KEYS.has(normalized))
        return normalized;
    const alias = COURSE_KEY_ALIASES[normalized]
        ?? COURSE_KEY_ALIASES[String(coerced).trim().toLowerCase()];
    if (alias && RENEWABLE_ENERGY_COURSE_KEYS.has(alias))
        return alias;
    return '';
}

function inferCourseKeyFromTitle(title) {
    const t = String(title || '').trim();
    if (!t)
        return '';
    for (const rule of TITLE_INFERENCE_RULES) {
        if (rule.test(t))
            return rule.key;
    }
    return '';
}

/**
 * Read course key from a program document (stored field or legacy title inference).
 */
export function getCourseKeyFromProgram(program) {
    if (!program)
        return '';
    const raw = program.course
        ?? program.renewable_energy_course
        ?? program.renewableEnergyCourse
        ?? program.course_key
        ?? program.courseKey
        ?? '';
    const key = normalizeCourseKey(raw);
    if (key)
        return key;
    return inferCourseKeyFromTitle(program.title || program.name || '');
}

/** Human-readable label for a course key (or Uncategorized). */
export function getCourseLabel(courseKey) {
    const key = normalizeCourseKey(courseKey) || String(courseKey || '').trim();
    if (!key)
        return UNCATEGORIZED_COURSE_LABEL;
    return COURSE_LABEL_BY_KEY[key] || UNCATEGORIZED_COURSE_LABEL;
}

/** Whether a program matches a course filter (`all` = no filter). */
export function programMatchesCourseFilter(program, courseFilter) {
    if (courseFilter == null || courseFilter === '' || courseFilter === 'all')
        return true;
    return getCourseKeyFromProgram(program) === courseFilter;
}

export function getProgramIdFromTrainee(trainee) {
    const value = trainee?.program_id || trainee?.programId || trainee?.program || '';
    if (typeof value === 'string')
        return value.trim();
    if (value && typeof value === 'object')
        return String(value.$id || value.documentId || value.id || '').trim();
    return '';
}

/** Index programs by $id and documentId so trainee program links resolve reliably. */
export function buildProgramByAnyId(programDocs) {
    const map = {};
    (programDocs || []).forEach((p) => {
        const id = String(p.$id || '').trim();
        if (id)
            map[id] = p;
        const docId = String(p.documentId || '').trim();
        if (docId && docId !== id)
            map[docId] = p;
    });
    return map;
}

/** Canonical course category bucket for analytics/reports (catalogue key or uncategorized). */
export function resolveTraineeCourseCategoryKey(trainee, programById = {}) {
    let courseKey = getTraineeCourseKey(trainee, programById);
    const programId = getProgramIdFromTrainee(trainee);
    const program = resolveProgramFromMap(programById, programId);
    if (!courseKey && program) {
        courseKey = getCourseKeyFromProgram(program);
    }
    if (!courseKey) {
        courseKey = normalizeCourseKey(trainee?.course
            ?? trainee?.course_key
            ?? trainee?.courseKey
            ?? trainee?.course_category
            ?? '');
    }
    if (courseKey && RENEWABLE_ENERGY_COURSE_KEYS.has(courseKey))
        return courseKey;
    return '_uncategorized';
}

/** Resolve a program document from a trainee's program link (supports $id / documentId keys). */
export function resolveProgramFromMap(programById, programId) {
    const id = String(programId || '').trim();
    if (!id || !programById)
        return null;
    if (programById[id])
        return programById[id];
    return null;
}

/** Course key for a trainee derived from their enrolled program. */
export function getTraineeCourseKey(trainee, programById = {}) {
    const programId = getProgramIdFromTrainee(trainee);
    if (!programId)
        return '';
    return getCourseKeyFromProgram(resolveProgramFromMap(programById, programId));
}

/** Display label for a trainee's course (from program). */
export function getTraineeCourseLabel(trainee, programById = {}) {
    return getCourseLabel(getTraineeCourseKey(trainee, programById));
}

/** Whether a trainee matches a course filter (`all` = no filter). */
export function traineeMatchesCourseFilter(trainee, courseFilter, programById = {}) {
    if (courseFilter == null || courseFilter === '' || courseFilter === 'all')
        return true;
    return getTraineeCourseKey(trainee, programById) === courseFilter;
}

/** Options for filter dropdowns: all categories + each catalogue entry. */
export function getCourseFilterSelectOptions() {
    return [
        { value: 'all', label: COURSE_MODULE_LABELS.filterAllCategories },
        ...RENEWABLE_ENERGY_COURSES.map((c) => ({ value: c.key, label: c.label })),
    ];
}

/** Options for program create/edit dropdown (no "all"). */
export function getCourseFormSelectOptions() {
    return RENEWABLE_ENERGY_COURSES.map((c) => ({ value: c.key, label: c.label }));
}

/** Validate course key before save; throws if missing or invalid. */
export function assertValidCourseKey(courseKey) {
    const key = normalizeCourseKey(courseKey);
    if (!key) {
        throw new Error(`Please select a ${COURSE_MODULE_LABELS.categoryFieldLabel.toLowerCase()} for this ${COURSE_MODULE_LABELS.moduleSingular}.`);
    }
    if (!RENEWABLE_ENERGY_COURSE_KEYS.has(key)) {
        throw new Error('Selected course category is not in the renewable energy catalogue.');
    }
    return key;
}
