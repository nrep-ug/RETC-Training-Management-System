import {
    getProgramIdFromTrainee,
    programMatchesCourseFilter,
    resolveProgramFromMap,
} from '@/lib/renewable-energy-courses';

export function getYearFromDateValue(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime()))
        return '';
    return String(date.getFullYear());
}

export function getProgramStartYear(program) {
    if (!program)
        return '';
    return getYearFromDateValue(
        program.start_date || program.startDate || program['start-date'] || program['start_date'] || '',
    );
}

/**
 * Whether a single course-enrollment row matches program/course/year scope filters.
 * Person-level filters (gender, district) should be applied on the trainee list first.
 */
export function enrollmentRowMatchesScope(row, {
    year = 'all',
    programId = 'all',
    course = 'all',
    allowedProgramIds = null,
}, programById = {}) {
    const pid = getProgramIdFromTrainee(row);
    const prog = resolveProgramFromMap(programById, pid);

    if (programId !== 'all' || (allowedProgramIds && allowedProgramIds.size > 0)) {
        if (!pid)
            return programId === 'all' && !(allowedProgramIds && allowedProgramIds.size > 0);
        if (programId !== 'all') {
            const programOk = pid === programId
                || (prog && (String(prog.$id || '') === programId || String(prog.documentId || '') === programId));
            if (!programOk)
                return false;
        }
        else if (allowedProgramIds && !allowedProgramIds.has(pid)) {
            return false;
        }
    }

    if (course !== 'all' && !programMatchesCourseFilter(prog, course))
        return false;

    if (year !== 'all') {
        const createdYear = getYearFromDateValue(row.$createdAt || row.created_at);
        const programYear = getProgramStartYear(prog);
        if (createdYear !== year && programYear !== year)
            return false;
    }

    return true;
}
