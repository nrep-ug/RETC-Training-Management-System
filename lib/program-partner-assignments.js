/**
 * Resolve training partners vs other (co-delivery) partners on courses.
 * Matches program save logic in programs page and program_partners join rows.
 */

function getRelationshipId(value) {
    if (!value)
        return '';
    if (typeof value === 'string')
        return String(value).trim();
    if (typeof value === 'object')
        return String(value.$id || value.documentId || value.id || '').trim();
    return '';
}

export function getProgramIdFromPartnerJoin(row) {
    return getRelationshipId(row?.program_id || row?.programId || row?.program);
}

export function getPartnerIdFromPartnerJoin(row) {
    return getRelationshipId(row?.partner_id || row?.partnerId || row?.partner);
}

export function getPartnerTypeFromPartnerJoin(row) {
    let s = String(row?.partner_type || row?.partnerType || row?.type || row?.role || 'partner')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (s === 'trainingpartner')
        s = 'training_partner';
    if (s === 'primary' || s === 'main')
        s = 'training_partner';
    return s === 'training_partner' ? 'training_partner' : 'partner';
}

/** programId → { trainingPartnerIds: string[], otherPartnerIds: string[] } */
export function buildProgramPartnerAssignmentIndex(programPartnerDocs) {
    const index = {};
    (programPartnerDocs || []).forEach((row) => {
        const programId = getProgramIdFromPartnerJoin(row);
        const partnerId = getPartnerIdFromPartnerJoin(row);
        if (!programId || !partnerId)
            return;
        if (!index[programId]) {
            index[programId] = { trainingPartnerIds: [], otherPartnerIds: [] };
        }
        const bucket = getPartnerTypeFromPartnerJoin(row) === 'training_partner'
            ? 'trainingPartnerIds'
            : 'otherPartnerIds';
        if (!index[programId][bucket].includes(partnerId)) {
            index[programId][bucket].push(partnerId);
        }
    });
    return index;
}

/** Lookup partner display names by $id and documentId. */
export function buildPartnerLabelById(partnersRaw) {
    const byId = {};
    (partnersRaw || []).forEach((p) => {
        const label = String(p.name || p.email || '').trim() || 'Unnamed Partner';
        const id = String(p.$id || '').trim();
        const docId = String(p.documentId || '').trim();
        if (id)
            byId[id] = label;
        if (docId)
            byId[docId] = label;
    });
    return byId;
}

export function resolvePartnerLabel(partnerId, labelById, partnersRaw) {
    const id = String(partnerId || '').trim();
    if (!id)
        return '';
    if (labelById[id])
        return labelById[id];
    const found = (partnersRaw || []).find((p) => String(p.$id || '') === id || String(p.documentId || '') === id);
    if (found)
        return String(found.name || found.email || '').trim() || 'Unnamed Partner';
    return '';
}

function getAssignmentForProgram(program, assignmentIndex) {
    const pid = String(program?.$id || '').trim();
    const docId = String(program?.documentId || '').trim();
    return assignmentIndex[pid]
        || (docId ? assignmentIndex[docId] : null)
        || { trainingPartnerIds: [], otherPartnerIds: [] };
}

function getTrainingPartnerNameOnProgram(program) {
    const tp = program?.['training-partners']
        ?? program?.training_partners
        ?? program?.training_partner
        ?? program?.trainingPartner;
    if (typeof tp === 'string')
        return tp.trim();
    if (typeof program?.training_partner === 'string')
        return program.training_partner.trim();
    return '';
}

/** Ids that identify the primary training partner for a course. */
export function getTrainingPartnerIdsForProgram(program, partnersRaw, assignmentIndex = {}) {
    const ids = new Set();
    const idRel = getRelationshipId(program?.training_partner_id || program?.trainingPartnerId);
    if (idRel)
        ids.add(idRel);
    const assignment = getAssignmentForProgram(program, assignmentIndex);
    assignment.trainingPartnerIds.forEach((id) => ids.add(id));
    const tp = program?.['training-partners'] ?? program?.training_partners ?? program?.training_partner;
    const tpRel = getRelationshipId(tp);
    if (tpRel)
        ids.add(tpRel);
    const nameStr = getTrainingPartnerNameOnProgram(program);
    if (nameStr && partnersRaw?.length) {
        const lower = nameStr.toLowerCase();
        partnersRaw.forEach((par) => {
            if (String(par.name || '').trim().toLowerCase() === lower)
                ids.add(String(par.$id || '').trim());
        });
    }
    return [...ids].filter(Boolean);
}

/** One label per course for the training partner (never "Unknown" if name exists on course). */
export function resolveTrainingPartnerLabel(program, assignmentIndex, labelById, partnersRaw) {
    const nameOnCourse = getTrainingPartnerNameOnProgram(program);
    const candidateIds = getTrainingPartnerIdsForProgram(program, partnersRaw, assignmentIndex);
    for (const id of candidateIds) {
        const label = resolvePartnerLabel(id, labelById, partnersRaw);
        if (label)
            return label;
    }
    if (nameOnCourse)
        return nameOnCourse;
    return '';
}

/** Other / co-delivery partners only (excludes primary training partner id). */
export function resolveOtherPartnerLabels(program, assignmentIndex, labelById, partnersRaw) {
    const assignment = getAssignmentForProgram(program, assignmentIndex);
    const trainingIds = new Set(getTrainingPartnerIdsForProgram(program, partnersRaw, assignmentIndex));
    const labels = [];
    const seen = new Set();
    assignment.otherPartnerIds.forEach((partnerId) => {
        if (!partnerId || trainingIds.has(partnerId))
            return;
        const label = resolvePartnerLabel(partnerId, labelById, partnersRaw);
        if (!label || seen.has(label))
            return;
        seen.add(label);
        labels.push(label);
    });
    return labels;
}

/**
 * Count courses per partner label, split by role.
 * Training: one count per course. Other: one count per co-delivery partner on that course.
 */
export function buildPartnerCourseContributions(filteredPrograms, assignmentIndex, partnersRaw) {
    const labelById = buildPartnerLabelById(partnersRaw);
    const trainingMap = {};
    const otherMap = {};
    let noTrainingPartnerCourses = 0;

    (filteredPrograms || []).forEach((program) => {
        const trainingLabel = resolveTrainingPartnerLabel(program, assignmentIndex, labelById, partnersRaw);
        if (trainingLabel) {
            trainingMap[trainingLabel] = (trainingMap[trainingLabel] || 0) + 1;
        }
        else {
            noTrainingPartnerCourses += 1;
        }
        resolveOtherPartnerLabels(program, assignmentIndex, labelById, partnersRaw).forEach((label) => {
            otherMap[label] = (otherMap[label] || 0) + 1;
        });
    });

    if (noTrainingPartnerCourses > 0) {
        trainingMap['(No training partner on course)'] = noTrainingPartnerCourses;
    }

    const toSortedList = (map, key) => Object.entries(map)
        .map(([partner, programs]) => ({ partner, [key]: programs }))
        .sort((a, b) => b[key] - a[key])
        .slice(0, 10);

    return {
        trainingPartnerPrograms: toSortedList(trainingMap, 'programs'),
        otherPartnerPrograms: toSortedList(otherMap, 'programs'),
    };
}
