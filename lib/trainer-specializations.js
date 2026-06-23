import {
    getCourseLabel,
    normalizeCourseKey,
    RENEWABLE_ENERGY_COURSE_KEYS,
} from '@/lib/renewable-energy-courses';

/** Normalize and dedupe specialization keys from form or Appwrite. */
export function normalizeSpecializationKeys(raw) {
    const list = Array.isArray(raw)
        ? raw
        : (raw == null || raw === '' ? [] : [raw]);
    const out = [];
    const seen = new Set();
    list.forEach((item) => {
        const key = normalizeCourseKey(item);
        if (!key || !RENEWABLE_ENERGY_COURSE_KEYS.has(key) || seen.has(key))
            return;
        seen.add(key);
        out.push(key);
    });
    return out;
}

/** Read specialization keys from Appwrite `specialization` (comma-separated labels or keys). */
export function getSpecializationsFromTrainer(trainer) {
    if (!trainer)
        return [];
    const raw = trainer.specialization ?? trainer.specialisation ?? '';
    if (Array.isArray(raw))
        return normalizeSpecializationKeys(raw);
    if (typeof raw === 'string' && raw.trim())
        return normalizeSpecializationKeys(raw.split(/[,;|]+/));
    return [];
}

export function getSpecializationLabels(keys) {
    return normalizeSpecializationKeys(keys).map((key) => getCourseLabel(key));
}

export function formatSpecializationsDisplay(trainer) {
    const labels = getSpecializationLabels(getSpecializationsFromTrainer(trainer));
    return labels.length > 0 ? labels.join(', ') : '';
}

export function trainerMatchesSpecializationQuery(trainer, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q)
        return true;
    const keys = getSpecializationsFromTrainer(trainer);
    if (keys.some((key) => key.includes(q) || getCourseLabel(key).toLowerCase().includes(q)))
        return true;
    const legacy = String(trainer?.specialization || trainer?.specialisation || '').toLowerCase();
    return legacy.includes(q);
}

/** Write multiple specializations to Appwrite attribute `specialization` (String). */
export function buildSpecializationWriteVariants(keys) {
    const specializations = normalizeSpecializationKeys(keys);
    if (!specializations.length)
        return [{}];
    const labels = specializations.map((key) => getCourseLabel(key));
    return [
        { specialization: labels.join(', ') },
        { specialization: specializations.join(',') },
    ];
}

export function formatSpecializationForAppwrite(keys) {
    const specializations = normalizeSpecializationKeys(keys);
    if (!specializations.length)
        return '';
    return specializations.map((key) => getCourseLabel(key)).join(', ');
}
