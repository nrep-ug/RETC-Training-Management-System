import {
    getPartnerIdFromPartnerJoin,
    getPartnerTypeFromPartnerJoin,
    getProgramIdFromPartnerJoin,
} from '@/lib/program-partner-assignments';

export function partnerDocumentId(partner) {
    if (!partner)
        return '';
    return String(partner.$id ?? partner.documentId ?? partner.id ?? '').trim();
}

function collectTrainingPartnerIds(data) {
    const fromArray = Array.isArray(data?.training_partner_ids) ? data.training_partner_ids : [];
    const legacy = data?.training_partner_id ? [data.training_partner_id] : [];
    return Array.from(new Set([...fromArray, ...legacy]
        .map((id) => String(id || '').trim())
        .filter(Boolean)));
}

/** Desired join rows for one course from dialog save payload. */
export function buildDesiredProgramPartnerLinks(data) {
    const trainingPartnerIds = collectTrainingPartnerIds(data);
    const trainingSet = new Set(trainingPartnerIds);
    const additionalPartnerIds = Array.from(new Set((Array.isArray(data?.partner_ids) ? data.partner_ids : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
        .filter((id) => !trainingSet.has(id))));
    const desired = [];
    trainingPartnerIds.forEach((partnerId) => {
        desired.push({ partnerId, partnerType: 'training_partner' });
    });
    additionalPartnerIds.forEach((partnerId) => {
        desired.push({ partnerId, partnerType: 'partner' });
    });
    return desired;
}

export function buildProgramPartnerPayloadCandidates(programId, partnerId, partnerType) {
    return [
        { program_id: programId, partner_id: partnerId, partner_type: partnerType },
        { programId: programId, partnerId: partnerId, partnerType: partnerType },
        { program_id: programId, partner_id: partnerId, type: partnerType },
        { program: programId, partner: partnerId, partner_type: partnerType },
        { program: programId, partner: partnerId, role: partnerType },
    ];
}

function linkRowKey(partnerId, partnerType) {
    return `${String(partnerId || '').trim()}::${partnerType === 'training_partner' ? 'training_partner' : 'partner'}`;
}

function desiredMatchesRow(row, desired) {
    const partnerId = getPartnerIdFromPartnerJoin(row);
    const partnerType = getPartnerTypeFromPartnerJoin(row);
    return desired.some((d) => d.partnerId === partnerId && d.partnerType === partnerType);
}

async function createProgramPartnerJoin(databases, dbId, collectionId, programId, partnerId, partnerType) {
    const payloads = buildProgramPartnerPayloadCandidates(programId, partnerId, partnerType);
    for (let i = 0; i < payloads.length; i++) {
        try {
            await databases.createDocument(dbId, collectionId, 'unique()', payloads[i]);
            return;
        }
        catch (error) {
            if (i === payloads.length - 1) {
                throw error;
            }
        }
    }
    throw new Error('Failed to create course partner assignment.');
}

/**
 * Add/remove join rows without wiping the whole program first (avoids data loss on partial failure).
 */
export async function syncProgramPartnerLinks(databases, dbId, collectionId, programId, data, existingRows) {
    if (!collectionId || !programId)
        return;
    const pid = String(programId).trim();
    const desired = buildDesiredProgramPartnerLinks(data);
    const existing = (existingRows || []).filter((row) => getProgramIdFromPartnerJoin(row) === pid);

    const desiredKeys = new Set(desired.map((d) => linkRowKey(d.partnerId, d.partnerType)));

    for (const row of existing) {
        const partnerId = getPartnerIdFromPartnerJoin(row);
        const partnerType = getPartnerTypeFromPartnerJoin(row);
        if (!desiredKeys.has(linkRowKey(partnerId, partnerType))) {
            await databases.deleteDocument(dbId, collectionId, row.$id);
        }
    }

    const remainingKeys = new Set(
        existing
            .filter((row) => desiredMatchesRow(row, desired))
            .map((row) => linkRowKey(getPartnerIdFromPartnerJoin(row), getPartnerTypeFromPartnerJoin(row))),
    );

    for (const d of desired) {
        const key = linkRowKey(d.partnerId, d.partnerType);
        if (remainingKeys.has(key))
            continue;
        await createProgramPartnerJoin(databases, dbId, collectionId, pid, d.partnerId, d.partnerType);
        remainingKeys.add(key);
    }
}

/** UI map entry for one program (training partner + other partner ids). */
export function buildProgramPartnerMapEntry(assignment, partners, fallbackProgram) {
    const partnerById = {};
    (partners || []).forEach((p) => {
        const label = String(p.name || p.email || p.$id || '').trim();
        const id = partnerDocumentId(p);
        if (id)
            partnerById[id] = label;
    });
    const trainingPartnerIds = Array.isArray(assignment?.trainingPartnerIds)
        ? assignment.trainingPartnerIds
        : (assignment?.trainingPartnerId ? [assignment.trainingPartnerId] : []);
    const partnerIds = Array.isArray(assignment?.partnerIds) ? assignment.partnerIds : [];
    const trainingPartnerNames = trainingPartnerIds.map((id) => partnerById[id]).filter(Boolean);
    const fallbackTrainingPartner = fallbackProgram
        ? (fallbackProgram.training_partner
            || fallbackProgram.trainingPartner
            || fallbackProgram['training-partners']
            || fallbackProgram.training_partners
            || '')
        : '';
    const trainingPartnerLabel = trainingPartnerNames.length > 0
        ? trainingPartnerNames.join(', ')
        : fallbackTrainingPartner;
    return {
        training_partner_ids: trainingPartnerIds,
        training_partner_id: trainingPartnerIds[0] || '',
        training_partner_names: trainingPartnerNames,
        training_partner: trainingPartnerLabel,
        partner_ids: partnerIds,
        partner_names: partnerIds.map((id) => partnerById[id]).filter(Boolean),
    };
}

/** Resolve join row program id to the course document $id when possible. */
export function resolveProgramIdAlias(joinProgramId, programsSnapshot) {
    const raw = String(joinProgramId || '').trim();
    if (!raw)
        return '';
    const list = programsSnapshot || [];
    const direct = list.find((p) => String(p.$id || '').trim() === raw);
    if (direct)
        return String(direct.$id).trim();
    const byDocId = list.find((p) => String(p.documentId || '').trim() === raw);
    if (byDocId)
        return String(byDocId.$id || raw).trim();
    return raw;
}

export function buildAssignmentsByProgramFromRows(allRows, programsSnapshot) {
    const byProgram = {};
    (allRows || []).forEach((row) => {
        const joinProgramId = getProgramIdFromPartnerJoin(row);
        const partnerId = getPartnerIdFromPartnerJoin(row);
        if (!joinProgramId || !partnerId)
            return;
        const programId = resolveProgramIdAlias(joinProgramId, programsSnapshot);
        if (!programId)
            return;
        if (!byProgram[programId]) {
            byProgram[programId] = { trainingPartnerIds: [], partnerIds: [] };
        }
        const type = getPartnerTypeFromPartnerJoin(row);
        if (type === 'training_partner') {
            if (!byProgram[programId].trainingPartnerIds.includes(partnerId)) {
                byProgram[programId].trainingPartnerIds.push(partnerId);
            }
        }
        else if (!byProgram[programId].partnerIds.includes(partnerId)) {
            byProgram[programId].partnerIds.push(partnerId);
        }
    });
    return byProgram;
}

export function buildProgramPartnerMapFromRows(allRows, programIds, programsSnapshot, partners) {
    const byProgram = buildAssignmentsByProgramFromRows(allRows, programsSnapshot);
    const nextMap = {};
    (programIds || []).forEach((programId) => {
        const assignment = byProgram[programId] || { trainingPartnerIds: [], partnerIds: [] };
        const fallbackProgram = (programsSnapshot || []).find((p) => p.$id === programId);
        nextMap[programId] = buildProgramPartnerMapEntry(assignment, partners, fallbackProgram);
    });
    return nextMap;
}

export function buildOptimisticProgramPartnerMapEntry(programId, data, partners, programsSnapshot) {
    const desired = buildDesiredProgramPartnerLinks(data);
    const assignment = {
        trainingPartnerIds: desired.filter((d) => d.partnerType === 'training_partner').map((d) => d.partnerId),
        partnerIds: desired.filter((d) => d.partnerType === 'partner').map((d) => d.partnerId),
    };
    const fallbackProgram = (programsSnapshot || []).find((p) => p.$id === programId);
    return buildProgramPartnerMapEntry(assignment, partners, fallbackProgram);
}
