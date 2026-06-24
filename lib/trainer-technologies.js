import { getCourseLabel, normalizeCourseKey, RENEWABLE_ENERGY_COURSE_KEYS } from '@/lib/renewable-energy-courses';
import { formatSpecializationsDisplay } from '@/lib/trainer-specializations';

const TECHNOLOGY_SEPARATOR = '.';
/** Delimiter between stored technology tokens (allows commas inside a technology name). */
const TOKEN_LIST_SEPARATOR = '|';

function technologyToken(categoryKey, technologyLabel) {
    return `${categoryKey}${TECHNOLOGY_SEPARATOR}${technologyLabel}`;
}

function splitTechnologyToken(token) {
    const raw = String(token || '').trim();
    const dot = raw.indexOf(TECHNOLOGY_SEPARATOR);
    if (dot <= 0)
        return { categoryKey: '', technologyLabel: '' };
    return {
        categoryKey: raw.slice(0, dot),
        technologyLabel: raw.slice(dot + 1).trim(),
    };
}

function normalizeTechnologyLabel(raw) {
    return String(raw || '').replace(/\s+/g, ' ').trim();
}

function normalizeCategoryKeys(raw) {
    const list = Array.isArray(raw) ? raw : (raw == null || raw === '' ? [] : [raw]);
    return list.map((item) => normalizeCourseKey(item)).filter(Boolean);
}

/** Split typed technologies (comma, semicolon, or newline). */
export function parseTechnologyListInput(text) {
    const raw = String(text || '').trim();
    if (!raw)
        return [];
    const parts = raw.split(/[,;\n]+/).map((part) => normalizeTechnologyLabel(part)).filter(Boolean);
    const unique = [];
    const seen = new Set();
    parts.forEach((part) => {
        const key = part.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        unique.push(part);
    });
    return unique;
}

export function formatTechnologyListInput(technologies) {
    const list = Array.isArray(technologies) ? technologies : [];
    return list.map((item) => normalizeTechnologyLabel(item)).filter(Boolean).join(', ');
}

export function normalizeTechnologyToken(raw) {
    if (raw == null || raw === '')
        return '';
    const text = String(raw).trim();
    if (!text.includes(TECHNOLOGY_SEPARATOR))
        return '';
    const { categoryKey, technologyLabel } = splitTechnologyToken(text);
    if (!RENEWABLE_ENERGY_COURSE_KEYS.has(categoryKey) || !technologyLabel)
        return '';
    return technologyToken(categoryKey, technologyLabel);
}

/**
 * @param {Record<string, string[] | string> | undefined} selections
 * @param {string[]} categoryKeys
 */
export function normalizeTechnologySelections(selections, categoryKeys = []) {
    const allowedCategories = new Set(normalizeCategoryKeys(categoryKeys));
    const normalized = {};
    Object.entries(selections || {}).forEach(([categoryKey, technologies]) => {
        const category = normalizeCourseKey(categoryKey);
        if (!category || (allowedCategories.size > 0 && !allowedCategories.has(category)))
            return;
        const list = Array.isArray(technologies)
            ? technologies
            : parseTechnologyListInput(technologies);
        const unique = [];
        const seen = new Set();
        list.forEach((technologyLabel) => {
            const label = normalizeTechnologyLabel(technologyLabel);
            if (!label)
                return;
            const token = technologyToken(category, label);
            if (seen.has(token))
                return;
            seen.add(token);
            unique.push(label);
        });
        if (unique.length > 0)
            normalized[category] = unique;
    });
    return normalized;
}

export function flattenTechnologyTokens(selections) {
    const tokens = [];
    Object.entries(selections || {}).forEach(([categoryKey, technologies]) => {
        const category = normalizeCourseKey(categoryKey);
        (technologies || []).forEach((technologyLabel) => {
            const label = normalizeTechnologyLabel(technologyLabel);
            if (!label)
                return;
            tokens.push(technologyToken(category, label));
        });
    });
    return tokens;
}

export function technologySelectionsFromTokens(tokens) {
    const selections = {};
    tokens.forEach((token) => {
        const normalized = normalizeTechnologyToken(token);
        if (!normalized)
            return;
        const { categoryKey, technologyLabel } = splitTechnologyToken(normalized);
        if (!selections[categoryKey])
            selections[categoryKey] = [];
        if (!selections[categoryKey].includes(technologyLabel))
            selections[categoryKey].push(technologyLabel);
    });
    return selections;
}

function splitStoredTechnologyTokens(raw) {
    const text = String(raw || '').trim();
    if (!text)
        return [];
    if (text.includes(TOKEN_LIST_SEPARATOR))
        return text.split(TOKEN_LIST_SEPARATOR).map((part) => part.trim()).filter(Boolean);
    return text.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
}

export function getTechnologySelectionsFromTrainer(trainer) {
    if (!trainer)
        return {};
    const raw = trainer.technologies
        ?? trainer.technology_specializations
        ?? trainer.technology_specialization
        ?? trainer.technologySpecializations
        ?? '';
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw))
        return normalizeTechnologySelections(raw);
    if (Array.isArray(raw))
        return technologySelectionsFromTokens(raw);
    if (typeof raw === 'string' && raw.trim())
        return technologySelectionsFromTokens(splitStoredTechnologyTokens(raw));
    return {};
}

/** Form helper: one comma-separated string per category. */
export function getTechnologyInputsFromTrainer(trainer) {
    const selections = getTechnologySelectionsFromTrainer(trainer);
    const inputs = {};
    Object.entries(selections).forEach(([categoryKey, technologies]) => {
        inputs[categoryKey] = formatTechnologyListInput(technologies);
    });
    return inputs;
}

export function technologySelectionsFromInputs(inputs, categoryKeys = []) {
    const selections = {};
    normalizeCategoryKeys(categoryKeys).forEach((categoryKey) => {
        const technologies = parseTechnologyListInput(inputs?.[categoryKey]);
        if (technologies.length > 0)
            selections[categoryKey] = technologies;
    });
    return selections;
}

export function assertTechnologySelectionsForCategories(categoryKeys, selections) {
    const categories = normalizeCategoryKeys(categoryKeys);
    const normalized = normalizeTechnologySelections(selections, categories);
    categories.forEach((categoryKey) => {
        const picked = normalized[categoryKey] || [];
        if (picked.length === 0) {
            throw new Error(`Enter at least one technology under ${getCourseLabel(categoryKey)}.`);
        }
    });
    Object.keys(normalized).forEach((categoryKey) => {
        if (!categories.includes(categoryKey)) {
            throw new Error(`Remove technologies for unselected category ${getCourseLabel(categoryKey)}.`);
        }
    });
    return normalized;
}

export function buildTechnologyWritePayload(selections) {
    const tokens = flattenTechnologyTokens(selections);
    if (!tokens.length)
        return {};
    return { technologies: tokens.join(TOKEN_LIST_SEPARATOR) };
}

export function formatTechnologySelectionsDisplay(trainer) {
    const selections = getTechnologySelectionsFromTrainer(trainer);
    const parts = Object.entries(selections).map(([categoryKey, technologies]) => {
        return `${getCourseLabel(categoryKey)}: ${technologies.join(', ')}`;
    });
    return parts.join(' | ');
}

export function trainerMatchesTechnologyQuery(trainer, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q)
        return true;
    const selections = getTechnologySelectionsFromTrainer(trainer);
    return Object.entries(selections).some(([categoryKey, technologies]) => {
        if (getCourseLabel(categoryKey).toLowerCase().includes(q))
            return true;
        return technologies.some((technologyLabel) => technologyLabel.toLowerCase().includes(q));
    });
}

export function formatTrainerExpertiseDisplay(trainer) {
    const categories = formatSpecializationsDisplay(trainer);
    const technologies = formatTechnologySelectionsDisplay(trainer);
    if (categories && technologies)
        return `${categories} — ${technologies}`;
    return categories || technologies || '';
}
