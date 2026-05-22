/** Participant skill level for trainees (separate from program course). */
export const TRAINEE_LEVELS = [
    { key: 'beginner', label: 'Beginner' },
    { key: 'technician', label: 'Technician' },
    { key: 'trainer', label: 'Trainer' },
];

export const TRAINEE_LEVEL_KEYS = new Set(TRAINEE_LEVELS.map((l) => l.key));

export const UNSPECIFIED_TRAINEE_LEVEL_LABEL = 'Unspecified';

const LEVEL_LABEL_BY_KEY = Object.fromEntries(TRAINEE_LEVELS.map((l) => [l.key, l.label]));

const LEVEL_KEY_ALIASES = {
    beginner: 'beginner',
    beginer: 'beginner',
    'entry level': 'beginner',
    entry_level: 'beginner',
    novice: 'beginner',
    technician: 'technician',
    tech: 'technician',
    technical: 'technician',
    advanced: 'technician',
    professional: 'technician',
    trainer: 'trainer',
    facilitator: 'trainer',
    instructor: 'trainer',
    mentor: 'trainer',
};

export function normalizeTraineeLevelKey(raw) {
    if (raw == null || raw === '')
        return '';
    const coerced = typeof raw === 'object'
        ? (raw.key ?? raw.slug ?? raw.value ?? raw.$id ?? raw.name ?? raw.label ?? '')
        : raw;
    const normalized = String(coerced)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (TRAINEE_LEVEL_KEYS.has(normalized))
        return normalized;
    const alias = LEVEL_KEY_ALIASES[normalized]
        ?? LEVEL_KEY_ALIASES[String(coerced).trim().toLowerCase()];
    if (alias && TRAINEE_LEVEL_KEYS.has(alias))
        return alias;
    return '';
}

export function getTraineeLevelFromDoc(trainee) {
    if (!trainee)
        return '';
    const raw = trainee.trainee_level
        ?? trainee.traineeLevel
        ?? trainee.level
        ?? trainee.participant_level
        ?? trainee.participantLevel
        ?? '';
    return normalizeTraineeLevelKey(raw);
}

/** Merge level key/label onto a trainee row (after save or fetch). */
export function enrichTraineeWithLevel(trainee, levelKeyFromForm) {
    const key = normalizeTraineeLevelKey(levelKeyFromForm) || getTraineeLevelFromDoc(trainee);
    return {
        ...trainee,
        trainee_level: key,
        trainee_level_label: getTraineeLevelLabel(key),
    };
}

export function getTraineeLevelLabel(levelKey) {
    const key = normalizeTraineeLevelKey(levelKey) || String(levelKey || '').trim();
    if (!key)
        return UNSPECIFIED_TRAINEE_LEVEL_LABEL;
    return LEVEL_LABEL_BY_KEY[key] || UNSPECIFIED_TRAINEE_LEVEL_LABEL;
}

/** Tailwind classes for level pills (table, profile, filters). */
export function getTraineeLevelBadgeClassName(levelKey) {
    switch (normalizeTraineeLevelKey(levelKey)) {
        case 'beginner':
            return 'border border-sky-200 bg-sky-100 text-sky-800';
        case 'technician':
            return 'border border-amber-200 bg-amber-100 text-amber-950';
        case 'trainer':
            return 'border border-violet-200 bg-violet-100 text-violet-900';
        default:
            return 'border border-slate-200 bg-slate-100 text-slate-600';
    }
}

export function traineeMatchesLevelFilter(trainee, levelFilter) {
    if (levelFilter == null || levelFilter === '' || levelFilter === 'all')
        return true;
    return getTraineeLevelFromDoc(trainee) === levelFilter;
}

export function getTraineeLevelFilterSelectOptions() {
    return [
        { value: 'all', label: 'All levels' },
        ...TRAINEE_LEVELS.map((l) => ({ value: l.key, label: l.label })),
    ];
}

export function getTraineeLevelFormSelectOptions() {
    return TRAINEE_LEVELS.map((l) => ({ value: l.key, label: l.label }));
}

export function assertValidTraineeLevel(levelKey) {
    const key = normalizeTraineeLevelKey(levelKey);
    if (!key) {
        throw new Error('Please select a participant level (Beginner, Technician, or Trainer).');
    }
    if (!TRAINEE_LEVEL_KEYS.has(key)) {
        throw new Error('Selected trainee level is not valid.');
    }
    return key;
}
