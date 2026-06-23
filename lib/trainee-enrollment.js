/** Shared enrollment → trainee program resolution (analytics, reports, trainees). */

import { getTraineeLevelFromDoc, getTraineeLevelLabel, normalizeTraineeLevelKey } from '@/lib/trainee-levels';

export function getEnrollmentTraineeId(doc) {
    const value = doc?.trainee_id || doc?.traineeId || doc?.trainee || '';
    if (typeof value === 'string')
        return String(value).trim();
    if (value && typeof value === 'object')
        return String(value.$id || value.documentId || value.id || '').trim();
    return '';
}

export function getEnrollmentProgramId(doc) {
    const value = doc?.program_id || doc?.programId || doc?.program || '';
    if (typeof value === 'string')
        return String(value).trim();
    if (value && typeof value === 'object')
        return String(value.$id || value.documentId || value.id || '').trim();
    return '';
}

export function getEnrollmentStatus(doc) {
    return String(doc?.status || '').trim();
}

export function getEnrollmentTraineeLevel(doc) {
    const raw = doc?.trainee_level
        ?? doc?.traineeLevel
        ?? doc?.level
        ?? doc?.participant_level
        ?? '';
    return normalizeTraineeLevelKey(raw);
}

/** Maps trainee id → list of { programId, status, traineeLevel, enrollmentId }. */
export function buildEnrollmentsByTrainee(enrollmentDocs) {
    const map = {};
    (enrollmentDocs || []).forEach((e) => {
        const traineeId = getEnrollmentTraineeId(e);
        const programId = getEnrollmentProgramId(e);
        if (!traineeId || !programId)
            return;
        if (!map[traineeId])
            map[traineeId] = [];
        const entry = {
            programId,
            status: getEnrollmentStatus(e),
            traineeLevel: getEnrollmentTraineeLevel(e),
            enrollmentId: String(e.$id || '').trim(),
        };
        const exists = map[traineeId].some((x) => x.programId === programId);
        if (!exists)
            map[traineeId].push(entry);
    });
    return map;
}

/** @deprecated Use buildEnrollmentsByTrainee — last enrollment wins. */
export function buildEnrollmentByTrainee(enrollmentDocs) {
    const map = {};
    Object.entries(buildEnrollmentsByTrainee(enrollmentDocs)).forEach(([traineeId, list]) => {
        if (list.length > 0)
            map[traineeId] = list[list.length - 1].programId;
    });
    return map;
}

const ACTIVE_STATUSES = new Set(['enrolled', 'in_progress', 'active', 'upcoming']);

export function pickPrimaryEnrollment(enrollments) {
    if (!enrollments?.length)
        return null;
    const active = enrollments.find((e) => ACTIVE_STATUSES.has(String(e.status || '').toLowerCase().replace(/[\s-]+/g, '_')));
    return active || enrollments[enrollments.length - 1];
}

/** Primary course id after merges / enrollment list changes. */
export function pickPrimaryProgramId(enrollments, fallbackProgramId = '') {
    const primary = pickPrimaryEnrollment(enrollments);
    return String(primary?.programId || fallbackProgramId || '').trim();
}

/** Program often lives on enrollments, not on the trainee document. */
export function mergeTraineeWithEnrollment(enrollmentByTrainee, trainee) {
    const keys = [trainee.$id, trainee.documentId, trainee.id]
        .map((k) => String(k || '').trim())
        .filter(Boolean);
    let enrollments = [];
    for (const k of keys) {
        if (Array.isArray(enrollmentByTrainee[k])) {
            enrollments = enrollmentByTrainee[k];
            break;
        }
        if (typeof enrollmentByTrainee[k] === 'string' && enrollmentByTrainee[k]) {
            enrollments = [{ programId: enrollmentByTrainee[k], status: '', enrollmentId: '' }];
            break;
        }
    }
    const primary = pickPrimaryEnrollment(enrollments);
    const legacyProgram = String(
        trainee.program_id
        || trainee.programId
        || (trainee.program && typeof trainee.program === 'object'
            ? (trainee.program.$id || trainee.program.documentId || trainee.program.id || '')
            : '')
        || (typeof trainee.program === 'string' ? trainee.program : ''),
    ).trim();
    const mergedProgram = legacyProgram || String(primary?.programId || '').trim();
    const enrollmentProgramIds = enrollments
        .map((e) => String(e?.programId || '').trim())
        .filter(Boolean);
    const programIds = Array.from(new Set(enrollmentProgramIds));
    // Keep a legacy-only first course until an enrollment row exists for it.
    if (legacyProgram && !programIds.includes(legacyProgram))
        programIds.push(legacyProgram);
    if (!programIds.length && legacyProgram)
        programIds.push(legacyProgram);
    const scopedStatus = enrollments.length > 0
        ? (primary?.status || trainee.status || '')
        : (trainee.status || '');
    const scopedLevel = enrollments.length > 0
        ? (primary?.traineeLevel || getTraineeLevelFromDoc(trainee))
        : getTraineeLevelFromDoc(trainee);
    return {
        ...trainee,
        enrollments,
        program_ids: programIds,
        program_id: String(mergedProgram || '').trim(),
        status: scopedStatus,
        trainee_level: scopedLevel,
        trainee_level_label: getTraineeLevelLabel(scopedLevel),
        enrollment_status: primary?.status || trainee.status || '',
    };
}

/** Build enrollment map for mergeTraineeWithEnrollment from raw docs. */
export function buildEnrollmentListsByTrainee(enrollmentDocs) {
    return buildEnrollmentsByTrainee(enrollmentDocs);
}

/** Course pre-selected in the trainee edit dialog (filter context or primary enrollment). */
export function resolveTraineeDialogProgramId(trainee, preferredProgramId = '') {
    if (!trainee)
        return '';
    const preferred = String(preferredProgramId || trainee._dialogProgramId || '').trim();
    const ids = getProgramIdsFromTrainee(trainee);
    if (preferred && ids.includes(preferred))
        return preferred;
    const direct = String(trainee.program_id || trainee.programId || '').trim();
    if (direct)
        return direct;
    return ids[0] || '';
}

/** Status shown in lists — scoped to a course filter when provided. */
export function getTraineeStatusForProgram(trainee, programFilterId = 'all') {
    const filterId = String(programFilterId || '').trim();
    const enrollments = Array.isArray(trainee?.enrollments) ? trainee.enrollments : [];
    if (filterId && filterId !== 'all') {
        const match = enrollments.find((e) => String(e?.programId || '').trim() === filterId);
        if (match?.status)
            return match.status;
        if (String(trainee?.program_id || '').trim() === filterId)
            return trainee.enrollment_status || trainee.status || '';
    }
    if (enrollments.length > 0) {
        const primary = pickPrimaryEnrollment(enrollments);
        if (primary?.status)
            return primary.status;
    }
    return trainee?.status || '';
}

/** Level shown in lists — scoped to a course filter when provided. */
export function getTraineeLevelForProgram(trainee, programFilterId = 'all') {
    const filterId = String(programFilterId || '').trim();
    const enrollments = Array.isArray(trainee?.enrollments) ? trainee.enrollments : [];
    if (filterId && filterId !== 'all') {
        const match = enrollments.find((e) => String(e?.programId || '').trim() === filterId);
        if (match?.traineeLevel)
            return match.traineeLevel;
        if (String(trainee?.program_id || '').trim() === filterId)
            return getTraineeLevelFromDoc(trainee);
    }
    if (enrollments.length > 0) {
        const primary = pickPrimaryEnrollment(enrollments);
        if (primary?.traineeLevel)
            return primary.traineeLevel;
    }
    return getTraineeLevelFromDoc(trainee);
}

/** Enrollment status for a specific course when editing a trainee. */
export function resolveEnrollmentStatusForProgram(trainee, programId) {
    const pid = String(programId || '').trim();
    if (!trainee)
        return 'enrolled';
    if (pid) {
        const fromList = (trainee.enrollments || []).find((e) => String(e?.programId || '').trim() === pid);
        if (fromList?.status)
            return fromList.status;
        const legacy = String(trainee.program_id || '').trim();
        if (legacy === pid) {
            const scoped = String(trainee.enrollment_status || '').trim();
            if (scoped)
                return scoped;
        }
    }
    return String(trainee.status || 'enrolled').trim() || 'enrolled';
}

/** Participant level for a specific course when editing a trainee. */
export function resolveEnrollmentLevelForProgram(trainee, programId) {
    const pid = String(programId || '').trim();
    if (!trainee)
        return '';
    if (pid) {
        const fromList = (trainee.enrollments || []).find((e) => String(e?.programId || '').trim() === pid);
        if (fromList?.traineeLevel)
            return fromList.traineeLevel;
        if (String(trainee.program_id || '').trim() === pid)
            return getTraineeLevelFromDoc(trainee);
    }
    return getTraineeLevelFromDoc(trainee);
}

/** All program ids linked to a trainee (enrollments + legacy program_id). */
export function getProgramIdsFromTrainee(trainee) {
    if (Array.isArray(trainee?.program_ids) && trainee.program_ids.length > 0) {
        return trainee.program_ids.map((id) => String(id || '').trim()).filter(Boolean);
    }
    const single = String(trainee?.program_id || trainee?.programId || '').trim();
    return single ? [single] : [];
}

/** All course ids for a trainee — merged UI state + raw enrollment rows. */
export function getLinkedProgramIdsForTrainee(trainee, enrollmentRows = []) {
    const traineeIds = [trainee?.$id, trainee?.documentId, trainee?.id]
        .map((id) => String(id || '').trim())
        .filter(Boolean);
    const ids = new Set(getProgramIdsFromTrainee(trainee));
    (trainee?.enrollments || []).forEach((entry) => {
        const programId = String(entry?.programId || '').trim();
        if (programId)
            ids.add(programId);
    });
    if (traineeIds.length > 0) {
        (enrollmentRows || []).forEach((row) => {
            const rowTraineeId = getEnrollmentTraineeId(row);
            if (!traineeIds.includes(rowTraineeId))
                return;
            const programId = getEnrollmentProgramId(row);
            if (programId)
                ids.add(programId);
        });
    }
    return Array.from(ids);
}

export function traineeHasMultipleCourses(trainee, enrollmentRows = []) {
    return getLinkedProgramIdsForTrainee(trainee, enrollmentRows).length > 1;
}

/** Course targeted when removing a trainee from one enrollment. */
export function resolveEnrollmentRemovalProgramId(trainee, programFilterId = 'all', enrollmentRows = []) {
    if (!trainee)
        return '';
    const programIds = getLinkedProgramIdsForTrainee(trainee, enrollmentRows);
    const filterId = String(programFilterId || '').trim();
    if (filterId && filterId !== 'all' && programIds.includes(filterId))
        return filterId;
    if (programIds.length > 1) {
        const primary = String(trainee.program_id || trainee.programId || '').trim();
        if (primary && programIds.includes(primary))
            return primary;
        return programIds[0] || '';
    }
    if (programIds.length === 1)
        return programIds[0];
    return '';
}

/** Drop one course from in-memory trainee shape before recomputing remaining links. */
export function buildTraineeAfterCourseRemoval(trainee, removedProgramId, enrollmentRows = []) {
    const removed = String(removedProgramId || '').trim();
    const legacyProgramId = String(trainee?.program_id || trainee?.programId || '').trim();
    const traineeSansRemoved = {
        ...trainee,
        program_id: legacyProgramId === removed ? '' : legacyProgramId,
        program_ids: getProgramIdsFromTrainee(trainee).filter((id) => id !== removed),
        enrollments: (trainee?.enrollments || []).filter((e) => String(e?.programId || '').trim() !== removed),
    };
    const remainingIds = getLinkedProgramIdsForTrainee(traineeSansRemoved, enrollmentRows)
        .filter((id) => id !== removed);
    return { traineeSansRemoved, remainingIds };
}

export function pickNextProgramIdAfterRemoval(remainingIds, remainingEnrollments, removedProgramId) {
    const removed = String(removedProgramId || '').trim();
    const ids = (remainingIds || []).map((id) => String(id || '').trim()).filter(Boolean);
    if (!ids.length)
        return '';
    let next = pickPrimaryProgramId(
        (remainingEnrollments || []).filter((e) => String(e?.programId || '').trim() !== removed),
        ids[0],
    );
    if (!next || next === removed)
        next = ids.find((id) => id !== removed) || ids[0];
    return String(next || '').trim();
}

/**
 * One row per course enrollment for analytics/reports (same person may appear multiple times).
 * Each row has program_id and status scoped to that enrollment.
 */
export function expandTraineesByEnrollment(trainees) {
    const out = [];
    (trainees || []).forEach((trainee) => {
        const enrollments = Array.isArray(trainee?.enrollments) ? trainee.enrollments : [];
        if (enrollments.length > 0) {
            let added = 0;
            enrollments.forEach((e) => {
                if (!e?.programId)
                    return;
                const levelKey = e.traineeLevel || getTraineeLevelFromDoc(trainee);
                out.push({
                    ...trainee,
                    program_id: e.programId,
                    status: e.status || trainee.status,
                    trainee_level: levelKey,
                    trainee_level_label: getTraineeLevelLabel(levelKey),
                    enrollment_id: e.enrollmentId || '',
                });
                added++;
            });
            if (added > 0)
                return;
        }
        const ids = getProgramIdsFromTrainee(trainee);
        if (ids.length > 1) {
            ids.forEach((programId) => {
                out.push({ ...trainee, program_id: programId });
            });
            return;
        }
        out.push(trainee);
    });
    return out;
}

/** True if any enrolled course matches the program filter. */
export function traineeMatchesProgramFilter(trainee, programIdFilter, programById = {}) {
    if (programIdFilter == null || programIdFilter === '' || programIdFilter === 'all')
        return true;
    return getProgramIdsFromTrainee(trainee).some((pid) => {
        const prog = programById[pid];
        return pid === programIdFilter
            || (prog && (String(prog.$id || '') === programIdFilter || String(prog.documentId || '') === programIdFilter));
    });
}

/** True if any enrolled course is in the allowed program id set. */
export function traineeMatchesAllowedPrograms(trainee, allowedProgramIds) {
    if (!allowedProgramIds || allowedProgramIds.size === 0)
        return true;
    return getProgramIdsFromTrainee(trainee).some((id) => allowedProgramIds.has(id));
}
