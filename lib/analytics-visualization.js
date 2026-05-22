import {
    RENEWABLE_ENERGY_COURSES,
    UNCATEGORIZED_COURSE_LABEL,
    getTraineeCourseLabel,
    resolveTraineeCourseCategoryKey,
} from '@/lib/renewable-energy-courses';
import { TRAINEE_LEVELS, getTraineeLevelFromDoc } from '@/lib/trainee-levels';

import { CHART_GENDER_STACK_COLORS, CHART_LEVEL_COLORS } from '@/lib/chart-brand-colors';

export const GENDER_STACK_COLORS = CHART_GENDER_STACK_COLORS;

/** Stacked level chart — RETC green / orange palette */
export const LEVEL_CHART_COLORS = CHART_LEVEL_COLORS;

const LEVEL_STACK_KEYS = ['beginner', 'technician', 'trainer'];
const GENDER_STACK_KEYS = ['male', 'female', 'other'];

const GENDER_LABEL_BY_KEY = {
    male: 'Male',
    female: 'Female',
    other: 'Other',
};

export function normalizeParticipantGenderKey(trainee) {
    const v = String(trainee?.gender || '').trim().toLowerCase();
    if (v === 'male' || v === 'm')
        return 'male';
    if (v === 'female' || v === 'f')
        return 'female';
    return 'other';
}

export function formatPercent(count, total, digits = 1) {
    if (!total || total <= 0)
        return `${(0).toFixed(digits)}%`;
    return `${(((Number(count) || 0) / total) * 100).toFixed(digits)}%`;
}

export function formatCountWithPercent(count, total, digits = 1) {
    return `${count} (${formatPercent(count, total, digits)})`;
}

/** Add percent (0–100, one decimal) relative to total of valueKey across items */
export function enrichDistributionWithPercent(items, valueKey = 'value', totalOverride) {
    const total = totalOverride ?? items.reduce((sum, item) => sum + (Number(item[valueKey]) || Number(item.count) || 0), 0);
    return items.map((item) => {
        const count = Number(item[valueKey]) ?? Number(item.count) ?? 0;
        const percent = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        return {
            ...item,
            count,
            percent,
            percentLabel: formatPercent(count, total, 1),
            displayLabel: `${item.name ?? item.district ?? item.course ?? item.partner ?? ''}: ${formatCountWithPercent(count, total, 1)}`,
        };
    });
}

/**
 * Count participants by course category × participant level (beginner / technician / trainer).
 */
export function buildLevelByCourseCategory(trainees, programById, _getProgramIdFromTrainee) {
    const matrix = {};
    RENEWABLE_ENERGY_COURSES.forEach((c) => {
        matrix[c.key] = { beginner: 0, technician: 0, trainer: 0, unspecified: 0 };
    });
    matrix._uncategorized = { beginner: 0, technician: 0, trainer: 0, unspecified: 0 };

    const levelTotals = { beginner: 0, technician: 0, trainer: 0, unspecified: 0 };

    (trainees || []).forEach((trainee) => {
        const catKey = resolveTraineeCourseCategoryKey(trainee, programById);
        const rawLevel = getTraineeLevelFromDoc(trainee);
        const levelKey = LEVEL_STACK_KEYS.includes(rawLevel) ? rawLevel : 'unspecified';
        const bucket = matrix[catKey] ?? matrix._uncategorized;
        bucket[levelKey]++;
        levelTotals[levelKey]++;
    });

    const grandTotal = Object.values(levelTotals).reduce((s, n) => s + n, 0);

    const stackedChartData = RENEWABLE_ENERGY_COURSES.map((c) => {
        const row = matrix[c.key];
        const total = row.beginner + row.technician + row.trainer + row.unspecified;
        return {
            category: c.label,
            categoryKey: c.key,
            ...row,
            total,
            beginnerPct: total > 0 ? Math.round((row.beginner / total) * 1000) / 10 : 0,
            technicianPct: total > 0 ? Math.round((row.technician / total) * 1000) / 10 : 0,
            trainerPct: total > 0 ? Math.round((row.trainer / total) * 1000) / 10 : 0,
            unspecifiedPct: total > 0 ? Math.round((row.unspecified / total) * 1000) / 10 : 0,
        };
    }).filter((row) => row.total > 0);

    const unc = matrix._uncategorized;
    const uncTotal = unc.beginner + unc.technician + unc.trainer + unc.unspecified;
    if (uncTotal > 0) {
        stackedChartData.push({
            category: UNCATEGORIZED_COURSE_LABEL,
            categoryKey: '_uncategorized',
            ...unc,
            total: uncTotal,
            beginnerPct: uncTotal > 0 ? Math.round((unc.beginner / uncTotal) * 1000) / 10 : 0,
            technicianPct: uncTotal > 0 ? Math.round((unc.technician / uncTotal) * 1000) / 10 : 0,
            trainerPct: uncTotal > 0 ? Math.round((unc.trainer / uncTotal) * 1000) / 10 : 0,
            unspecifiedPct: uncTotal > 0 ? Math.round((unc.unspecified / uncTotal) * 1000) / 10 : 0,
        });
    }

    const tableRows = stackedChartData.map((row) => ({
        category: row.category,
        beginner: row.beginner,
        technician: row.technician,
        trainer: row.trainer,
        unspecified: row.unspecified,
        total: row.total,
        beginnerShare: formatPercent(row.beginner, row.total, 1),
        technicianShare: formatPercent(row.technician, row.total, 1),
        trainerShare: formatPercent(row.trainer, row.total, 1),
        beginnerOfAll: formatPercent(row.beginner, grandTotal, 1),
        technicianOfAll: formatPercent(row.technician, grandTotal, 1),
        trainerOfAll: formatPercent(row.trainer, grandTotal, 1),
        categoryOfAll: formatPercent(row.total, grandTotal, 1),
    }));

    const levelSummary = TRAINEE_LEVELS.map((l) => ({
        key: l.key,
        label: l.label,
        count: levelTotals[l.key] || 0,
        percent: grandTotal > 0 ? Math.round(((levelTotals[l.key] || 0) / grandTotal) * 1000) / 10 : 0,
        percentLabel: formatPercent(levelTotals[l.key] || 0, grandTotal, 1),
    })).filter((l) => l.count > 0);

    if (levelTotals.unspecified > 0) {
        levelSummary.push({
            key: 'unspecified',
            label: 'Unspecified',
            count: levelTotals.unspecified,
            percent: grandTotal > 0 ? Math.round((levelTotals.unspecified / grandTotal) * 1000) / 10 : 0,
            percentLabel: formatPercent(levelTotals.unspecified, grandTotal, 1),
        });
    }

    return {
        stackedChartData,
        tableRows,
        levelSummary,
        levelTotals,
        grandTotal,
    };
}

export function levelByCategoryPdfRows(tableRows) {
    return (tableRows || []).map((row) => [
        row.category,
        formatCountWithPercent(row.beginner, row.total, 1),
        formatCountWithPercent(row.technician, row.total, 1),
        formatCountWithPercent(row.trainer, row.total, 1),
        String(row.total),
        row.categoryOfAll,
    ]);
}

export function levelSummaryPdfRows(levelSummary) {
    return (levelSummary || []).map((row) => [
        row.label,
        String(row.count),
        row.percentLabel,
    ]);
}

function genderCountsToTableRow(categoryLabel, counts, grandTotal) {
    const male = counts.male || 0;
    const female = counts.female || 0;
    const other = counts.other || 0;
    const total = male + female + other;
    return {
        category: categoryLabel,
        male,
        female,
        other,
        total,
        maleShare: formatPercent(male, total, 1),
        femaleShare: formatPercent(female, total, 1),
        otherShare: formatPercent(other, total, 1),
        maleOfAll: formatPercent(male, grandTotal, 1),
        femaleOfAll: formatPercent(female, grandTotal, 1),
        otherOfAll: formatPercent(other, grandTotal, 1),
        categoryOfAll: formatPercent(total, grandTotal, 1),
    };
}

/**
 * Count participants by course category × gender (male / female / other).
 * Uses the same course category labels as analytics "trainees by course category".
 */
export function buildGenderByCourseCategory(trainees, programById, _getProgramIdFromTrainee) {
    const emptyGenderRow = () => ({ male: 0, female: 0, other: 0 });
    const matrix = {};
    RENEWABLE_ENERGY_COURSES.forEach((c) => {
        matrix[c.key] = emptyGenderRow();
    });
    matrix._uncategorized = emptyGenderRow();
    const byLabel = {};

    const genderTotals = { male: 0, female: 0, other: 0 };

    (trainees || []).forEach((trainee) => {
        const catKey = resolveTraineeCourseCategoryKey(trainee, programById);
        const categoryLabel = getTraineeCourseLabel(trainee, programById);
        const genderKey = normalizeParticipantGenderKey(trainee);
        const bucket = matrix[catKey] ?? matrix._uncategorized;
        bucket[genderKey]++;
        if (!byLabel[categoryLabel]) {
            byLabel[categoryLabel] = emptyGenderRow();
        }
        byLabel[categoryLabel][genderKey]++;
        genderTotals[genderKey]++;
    });

    const grandTotal = Object.values(genderTotals).reduce((s, n) => s + n, 0);

    const toStackRow = (category, categoryKey, row) => {
        const total = row.male + row.female + row.other;
        return {
            category,
            categoryKey,
            ...row,
            total,
            malePct: total > 0 ? Math.round((row.male / total) * 1000) / 10 : 0,
            femalePct: total > 0 ? Math.round((row.female / total) * 1000) / 10 : 0,
            otherPct: total > 0 ? Math.round((row.other / total) * 1000) / 10 : 0,
        };
    };

    const stackedChartData = RENEWABLE_ENERGY_COURSES.map((c) => toStackRow(c.label, c.key, matrix[c.key]))
        .filter((row) => row.total > 0);

    const unc = matrix._uncategorized;
    const uncTotal = unc.male + unc.female + unc.other;
    if (uncTotal > 0) {
        stackedChartData.push(toStackRow(UNCATEGORIZED_COURSE_LABEL, '_uncategorized', unc));
    }

    const tableRows = stackedChartData.map((row) => genderCountsToTableRow(row.category, row, grandTotal));

    /** PDF: catalogue rows with trainees, then label-based fallback (matches course attendance logic). */
    const pdfTableRows = RENEWABLE_ENERGY_COURSES
        .map((c) => genderCountsToTableRow(c.label, matrix[c.key], grandTotal))
        .filter((row) => row.total > 0);
    if (uncTotal > 0) {
        pdfTableRows.push(genderCountsToTableRow(UNCATEGORIZED_COURSE_LABEL, unc, grandTotal));
    }
    if (pdfTableRows.length === 0 && grandTotal > 0) {
        Object.entries(byLabel)
            .sort((a, b) => {
                const totalA = a[1].male + a[1].female + a[1].other;
                const totalB = b[1].male + b[1].female + b[1].other;
                return totalB - totalA;
            })
            .forEach(([label, counts]) => {
                pdfTableRows.push(genderCountsToTableRow(label, counts, grandTotal));
            });
    }
    if (pdfTableRows.length === 0 && grandTotal > 0) {
        pdfTableRows.push(genderCountsToTableRow(UNCATEGORIZED_COURSE_LABEL, genderTotals, grandTotal));
    }

    const genderSummary = GENDER_STACK_KEYS.map((key) => ({
        key,
        label: GENDER_LABEL_BY_KEY[key],
        count: genderTotals[key] || 0,
        percent: grandTotal > 0 ? Math.round(((genderTotals[key] || 0) / grandTotal) * 1000) / 10 : 0,
        percentLabel: formatPercent(genderTotals[key] || 0, grandTotal, 1),
    })).filter((g) => g.count > 0);

    return {
        stackedChartData,
        tableRows,
        pdfTableRows,
        genderSummary,
        genderTotals,
        grandTotal,
    };
}

export function genderByCategoryPdfRows(tableRows) {
    return (tableRows || []).map((row) => [
        row.category,
        formatCountWithPercent(row.male, row.total, 1),
        formatCountWithPercent(row.female, row.total, 1),
        formatCountWithPercent(row.other, row.total, 1),
        String(row.total),
        row.categoryOfAll,
    ]);
}

/** PDF body rows for gender × category; never returns empty when trainees exist in scope. */
export function genderCategoryPdfBody(genderByCategory) {
    const breakdown = genderByCategory || {};
    const pdfRows = breakdown.pdfTableRows || breakdown.tableRows || [];
    if (pdfRows.length > 0) {
        const body = genderByCategoryPdfRows(pdfRows);
        if (body.length > 0)
            return body;
    }
    if ((breakdown.grandTotal || 0) > 0) {
        const totals = breakdown.genderTotals || {};
        const total = breakdown.grandTotal;
        const male = totals.male || 0;
        const female = totals.female || 0;
        const other = totals.other || 0;
        return genderByCategoryPdfRows([genderCountsToTableRow(UNCATEGORIZED_COURSE_LABEL, { male, female, other }, total)]);
    }
    return [['No gender breakdown in scope', '—', '—', '—', '—', '—']];
}

export function genderSummaryPdfRows(genderSummary) {
    return (genderSummary || []).map((row) => [
        row.label,
        String(row.count),
        row.percentLabel,
    ]);
}
