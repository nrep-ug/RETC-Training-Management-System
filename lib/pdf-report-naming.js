/**
 * Safe filename segments for downloadable PDF reports (Windows-friendly).
 */
function slugifyForFilename(str, maxLen = 28) {
    const cleaned = String(str || '')
        .trim()
        .replace(/[<>:"/\\|?*]+/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const base = cleaned || 'item';
    return base.length <= maxLen ? base : base.slice(0, maxLen).replace(/-$/, '');
}

function clampFilename(name, maxTotal = 190) {
    if (name.length <= maxTotal)
        return name;
    const ext = '.pdf';
    const stem = name.slice(0, maxTotal - ext.length - 4) + '-etc';
    return stem + ext;
}

/**
 * Analytics dashboard export — reflects active filters and scope.
 */
export function buildAnalyticsReportFilename(filters, {
    programTitle = '',
    trainingPartnerName = '',
    courseLabel = '',
    reportFormat = 'tabular',
} = {}) {
    const date = new Date().toISOString().slice(0, 10);
    const parts = [
        'RETC-analytics',
        filters.year === 'all' ? 'years-all' : `year-${slugifyForFilename(String(filters.year), 8)}`,
        filters.programId === 'all' ? 'programs-all' : `program-${slugifyForFilename(programTitle, 32)}`,
        filters.course && filters.course !== 'all'
            ? `course-${slugifyForFilename(courseLabel || filters.course, 28)}`
            : 'course-all',
        filters.trainingPartnerId === 'all'
            ? 'training-partner-all'
            : `training-partner-${slugifyForFilename(trainingPartnerName, 24)}`,
    ];
    if (filters.gender && filters.gender !== 'all') {
        parts.push(`gender-${slugifyForFilename(filters.gender, 12)}`);
    }
    const district = String(filters.district || '').trim();
    if (district) {
        parts.push(`district-${slugifyForFilename(district, 20)}`);
    }
    if (reportFormat === 'charts') {
        parts.push('charts');
    }
    parts.push(date);
    return clampFilename(`${parts.join('_')}.pdf`);
}

/**
 * Reports page — trainees table export.
 */
export function buildTraineesReportFilename(filters, { programTitle = '', partnerName = '', trainerName = '', courseLabel = '' } = {}) {
    const date = new Date().toISOString().slice(0, 10);
    const parts = [
        'RETC-trainees',
        filters.year === 'all' ? 'years-all' : `year-${slugifyForFilename(String(filters.year), 8)}`,
        filters.programId === 'all' ? 'programs-all' : `program-${slugifyForFilename(programTitle, 32)}`,
        filters.course && filters.course !== 'all'
            ? `course-${slugifyForFilename(courseLabel || filters.course, 28)}`
            : 'course-all',
        filters.partnerId === 'all' ? 'partners-all' : `partner-${slugifyForFilename(partnerName, 28)}`,
    ];
    if (filters.gender && filters.gender !== 'all') {
        parts.push(`gender-${slugifyForFilename(filters.gender, 12)}`);
    }
    if (filters.district && filters.district !== 'all') {
        parts.push(`district-${slugifyForFilename(filters.district, 20)}`);
    }
    if (filters.trainerId && filters.trainerId !== 'all') {
        parts.push(`trainer-${slugifyForFilename(trainerName || filters.trainerId, 22)}`);
    }
    parts.push(date);
    return clampFilename(`${parts.join('_')}.pdf`);
}

/**
 * Reports page — programs table export.
 */
export function buildProgramsReportFilename(filters, { programTitle = '', partnerName = '', trainerName = '', courseLabel = '' } = {}) {
    const date = new Date().toISOString().slice(0, 10);
    const parts = [
        'RETC-programs',
        filters.year === 'all' ? 'years-all' : `year-${slugifyForFilename(String(filters.year), 8)}`,
        filters.programId === 'all' ? 'programs-all' : `program-${slugifyForFilename(programTitle, 32)}`,
        filters.course && filters.course !== 'all'
            ? `course-${slugifyForFilename(courseLabel || filters.course, 28)}`
            : 'course-all',
        filters.partnerId === 'all' ? 'partners-all' : `partner-${slugifyForFilename(partnerName, 28)}`,
    ];
    if (filters.trainerId && filters.trainerId !== 'all') {
        parts.push(`trainer-${slugifyForFilename(trainerName || filters.trainerId, 22)}`);
    }
    parts.push(date);
    return clampFilename(`${parts.join('_')}.pdf`);
}
