'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Query } from 'appwrite';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { ProgramStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { ProgramDialog } from '@/components/program-dialog';
import { ProgramTable } from '@/components/program-table';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
function sanitizeProgramPayload(data, style = 'snake', includeDates = true) {
    const rawDescription = String(data.description || '').trim();
    if (rawDescription.length > 100) {
        throw new Error('Description must be at most 100 characters.');
    }
    const base = {
        title: String(data.title || '').trim(),
        training_partner: String(data.training_partner || '').trim(),
        description: rawDescription,
        status: String(data.status || ProgramStatus.UPCOMING).toLowerCase(),
    };
    const trainerId = String(data.trainer_id || '').trim();
    if (trainerId) {
        base.trainer_id = trainerId;
    }
    const capacity = Number(data.max_capacity);
    if (style === 'snake') {
        if (includeDates) {
            base.start_date = data.start_date;
            base.end_date = data.end_date;
        }
        base.max_capacity = capacity;
    }
    else {
        if (includeDates) {
            base.startDate = data.start_date;
            base.endDate = data.end_date;
        }
        base.maxCapacity = capacity;
    }
    if (!base.title) {
        throw new Error('Program title is required.');
    }
    if (includeDates && (!(base.start_date || base.startDate) || !(base.end_date || base.endDate))) {
        throw new Error('Start date and end date are required.');
    }
    const cap = base.max_capacity ?? base.maxCapacity;
    if (!Number.isInteger(cap) || cap <= 0) {
        throw new Error('Max capacity must be a positive whole number.');
    }
    if (!['upcoming', 'ongoing', 'completed'].includes(base.status)) {
        base.status = ProgramStatus.UPCOMING;
    }
    return base;
}
function buildProgramPayloadCandidates(data) {
    const snake = sanitizeProgramPayload(data, 'snake', true);
    const camel = sanitizeProgramPayload(data, 'camel', true);
    const trainingPartnersValue = String(data['training-partners'] || data.training_partners || snake.training_partner || '').trim();
    if (!trainingPartnersValue) {
        throw new Error('Training partner is required.');
    }
    const strictRequiredPayload = {
        title: snake.title,
        status: snake.status,
        max_capacity: snake.max_capacity,
        'start-date': snake.start_date,
        'end-time': snake.end_date,
        'training-partners': trainingPartnersValue,
    };
    if (snake.description) {
        strictRequiredPayload.description = snake.description;
    }
    const exactSchemaPayload = {
        ...strictRequiredPayload,
        training_partner: snake.training_partner,
        training_partners: trainingPartnersValue,
        ...(snake.trainer_id ? { trainer_id: snake.trainer_id } : {}),
    };
    const hyphenDates = {
        ...snake,
        'start-date': snake.start_date,
        'end-date': snake.end_date,
    };
    delete hyphenDates.start_date;
    delete hyphenDates.end_date;
    const hybridDatesCamel = {
        ...snake,
        startDate: snake.start_date,
        endDate: snake.end_date,
    };
    delete hybridDatesCamel.start_date;
    delete hybridDatesCamel.end_date;
    const hybridCapacityCamel = {
        ...snake,
        maxCapacity: snake.max_capacity,
    };
    if (snake.trainer_id) {
        hybridCapacityCamel.trainerId = snake.trainer_id;
        hybridDatesCamel.trainerId = snake.trainer_id;
        hyphenDates.trainerId = snake.trainer_id;
        exactSchemaPayload.trainerId = snake.trainer_id;
        delete hybridCapacityCamel.trainer_id;
        delete hybridDatesCamel.trainer_id;
        delete hyphenDates.trainer_id;
    }
    delete hybridCapacityCamel.max_capacity;
    const shortDates = {
        ...snake,
        start: snake.start_date,
        end: snake.end_date,
    };
    delete shortDates.start_date;
    delete shortDates.end_date;
    const atDates = {
        ...snake,
        startAt: snake.start_date,
        endAt: snake.end_date,
    };
    delete atDates.start_date;
    delete atDates.end_date;
    const hyphenDatesCamelCapacity = {
        ...hyphenDates,
        maxCapacity: snake.max_capacity,
    };
    delete hyphenDatesCamelCapacity.max_capacity;
    // Try strict required-schema payload first, then broader fallbacks.
    return [strictRequiredPayload, exactSchemaPayload, snake, hyphenDates, hyphenDatesCamelCapacity, hybridDatesCamel, camel, hybridCapacityCamel, shortDates, atDates];
}
async function createProgramWithFallback(data) {
    const payloads = buildProgramPayloadCandidates(data);
    const attemptErrors = [];
    for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        try {
            return await databases.createDocument(DB_ID, COLLECTIONS.PROGRAMS, 'unique()', payload);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
        }
    }
    throw new Error(`Failed to create program. Please verify required program attributes in Appwrite (including start-date, end-time, max_capacity, and training-partners). ${attemptErrors.join(' | ')}`);
}
async function updateProgramWithFallback(programId, data) {
    const payloads = buildProgramPayloadCandidates(data);
    const attemptErrors = [];
    for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        try {
            return await databases.updateDocument(DB_ID, COLLECTIONS.PROGRAMS, programId, payload);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
        }
    }
    throw new Error(`Failed to update program. Please verify required program attributes in Appwrite (including start-date, end-time, max_capacity, and training-partners). ${attemptErrors.join(' | ')}`);
}
function normalizeProgramDoc(program) {
    const createdFallback = program.$createdAt ? new Date(program.$createdAt).toISOString() : '';
    const endFallback = createdFallback
        ? new Date(new Date(createdFallback).getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString()
        : '';
    return {
        ...program,
        training_partner: program.training_partner
            || program.trainingPartner
            || program['training-partners']
            || program.training_partners
            || '',
        training_partner_id: program.training_partner_id
            || program.trainingPartnerId
            || (typeof program['training-partners'] === 'object'
                ? (program['training-partners'].$id || program['training-partners'].documentId || program['training-partners'].id || '')
                : ''),
        partner_ids: Array.isArray(program.partner_ids) ? program.partner_ids : [],
        start_date: program.start_date || program.startDate || program['start-date'] || createdFallback,
        end_date: program.end_date || program.endDate || program['end-date'] || program['end-time'] || endFallback,
        max_capacity: program.max_capacity ?? program.maxCapacity ?? 0,
        trainer_id: program.trainer_id
            || program.trainerId
            || program.lead_trainer_id
            || program.leadTrainerId
            || (program.trainer && typeof program.trainer === 'object' ? (program.trainer.$id || program.trainer.documentId || program.trainer.id || '') : program.trainer)
            || '',
        trainer_name: (program.trainer && typeof program.trainer === 'object')
            ? (program.trainer.name || program.trainer.email || '')
            : (program.trainer_name || program.trainerName || ''),
        status: String(program.status || ProgramStatus.UPCOMING).toLowerCase(),
    };
}
function getRelationshipId(value) {
    if (!value)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'object') {
        return value.$id || value.documentId || value.id || '';
    }
    return '';
}
function getProgramIdFromPartnerJoin(row) {
    return getRelationshipId(row.program_id || row.programId || row.program);
}
function getPartnerIdFromPartnerJoin(row) {
    return getRelationshipId(row.partner_id || row.partnerId || row.partner);
}
function getPartnerTypeFromPartnerJoin(row) {
    let s = String(row.partner_type || row.partnerType || row.type || row.role || 'partner')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (s === 'trainingpartner')
        s = 'training_partner';
    if (s === 'primary' || s === 'main')
        s = 'training_partner';
    return s === 'training_partner' ? 'training_partner' : 'partner';
}
/** Paginate past Appwrite default list limits so every program–partner link is loaded. */
async function fetchAllCollectionDocuments(collectionId, { maxDocs = 50000, pageSize = 250 } = {}) {
    if (!databases || !DB_ID || !collectionId)
        return [];
    const out = [];
    let cursor = null;
    while (out.length < maxDocs) {
        const queries = [Query.limit(pageSize), Query.orderAsc('$id')];
        if (cursor)
            queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(DB_ID, collectionId, queries, undefined, true);
        const batch = res.documents || [];
        if (!batch.length)
            break;
        out.push(...batch);
        if (batch.length < pageSize)
            break;
        if (typeof res.total === 'number' && out.length >= res.total)
            break;
        cursor = batch[batch.length - 1].$id;
    }
    return out;
}
/** Load only join rows for one program — avoids scanning the whole table on every save (was freezing "Saving…"). */
async function listProgramPartnerJoinsForProgram(programId) {
    if (!databases || !DB_ID || !COLLECTIONS.PROGRAM_PARTNERS || !programId)
        return [];
    const pid = String(programId).trim();
    for (const attr of ['program_id', 'programId']) {
        try {
            const res = await databases.listDocuments(DB_ID, COLLECTIONS.PROGRAM_PARTNERS, [
                Query.equal(attr, pid),
                Query.limit(500),
            ]);
            const batch = res.documents || [];
            const filtered = batch.filter((row) => getProgramIdFromPartnerJoin(row) === pid);
            return filtered.length > 0 ? filtered : batch;
        }
        catch {
            /* collection may use a different attribute name */
        }
    }
    const all = await fetchAllCollectionDocuments(COLLECTIONS.PROGRAM_PARTNERS);
    return all.filter((row) => getProgramIdFromPartnerJoin(row) === pid);
}
function buildProgramPartnerPayloadCandidates(programId, partnerId, partnerType) {
    return [
        { program_id: programId, partner_id: partnerId, partner_type: partnerType },
        { programId: programId, partnerId: partnerId, partnerType: partnerType },
        { program_id: programId, partner_id: partnerId, type: partnerType },
        { program: programId, partner: partnerId, role: partnerType },
    ];
}
function buildBackfillProgramData(program) {
    const normalized = normalizeProgramDoc(program);
    const startBase = normalized.start_date
        ? new Date(normalized.start_date)
        : (program.$createdAt ? new Date(program.$createdAt) : new Date());
    const endBase = normalized.end_date
        ? new Date(normalized.end_date)
        : new Date(startBase.getTime() + (30 * 24 * 60 * 60 * 1000));
    return {
        title: normalized.title || 'Untitled Program',
        training_partner: normalized.training_partner || '',
        description: normalized.description || '',
        max_capacity: Number(normalized.max_capacity) || 1,
        status: normalized.status || ProgramStatus.UPCOMING,
        start_date: startBase.toISOString(),
        end_date: endBase.toISOString(),
    };
}
export default function ProgramsPage() {
    const { isAdmin } = useAuth();
    const [programs, setPrograms] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [partners, setPartners] = useState([]);
    const [programPartnerMap, setProgramPartnerMap] = useState({});
    const [isTrainersLoading, setIsTrainersLoading] = useState(false);
    const [isPartnersLoading, setIsPartnersLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [filters, setFilters] = useState({
        query: '',
        status: 'all',
        trainerId: 'all',
        partner: 'all',
        fromDate: '',
        toDate: '',
    });
    useEffect(() => {
        fetchPrograms();
        fetchTrainers();
        fetchPartners();
    }, []);
    useEffect(() => {
        const programIds = programs.map((p) => p.$id).filter(Boolean);
        if (programIds.length > 0 && COLLECTIONS.PROGRAM_PARTNERS) {
            fetchProgramPartnerAssignments(programIds);
        }
        else {
            setProgramPartnerMap({});
        }
    }, [
        programs.map((p) => `${p.$id}:${p.$updatedAt || p.$createdAt || ''}`).join('|'),
        partners.map((p) => `${p.$id}:${p.$updatedAt || p.$createdAt || ''}`).join('|'),
    ]);
    const fetchPartners = async () => {
        if (!databases || !DB_ID || !COLLECTIONS.PARTNERS) {
            setPartners([]);
            return;
        }
        try {
            setIsPartnersLoading(true);
            const response = await databases.listDocuments(DB_ID, COLLECTIONS.PARTNERS);
            setPartners(response.documents);
        }
        catch (error) {
            console.error('Error fetching partners for program assignment:', error);
            setPartners([]);
        }
        finally {
            setIsPartnersLoading(false);
        }
    };
    const fetchTrainers = async () => {
        if (!databases || !DB_ID || !COLLECTIONS.TRAINERS) {
            setTrainers([]);
            return;
        }
        try {
            setIsTrainersLoading(true);
            const response = await databases.listDocuments(DB_ID, COLLECTIONS.TRAINERS);
            setTrainers(response.documents);
        }
        catch (error) {
            console.error('Error fetching trainers for program assignment:', error);
            setTrainers([]);
        }
        finally {
            setIsTrainersLoading(false);
        }
    };
    const fetchPrograms = async () => {
        try {
            setIsLoading(true);
            if (!databases || !DB_ID || !COLLECTIONS.PROGRAMS) {
                throw new Error('Programs collection is not configured. Check your Appwrite environment variables.');
            }
            const response = await databases.listDocuments(DB_ID, COLLECTIONS.PROGRAMS);
            const withDates = await Promise.all(response.documents.map(async (program) => {
                const normalized = normalizeProgramDoc(program);
                const hasPersistedDates = Boolean(program.start_date || program.startDate || program['start-date'])
                    && Boolean(program.end_date || program.endDate || program['end-date'] || program['end-time']);
                if (hasPersistedDates) {
                    return normalized;
                }
                try {
                    const backfillData = buildBackfillProgramData(program);
                    const updated = await updateProgramWithFallback(program.$id, backfillData);
                    return normalizeProgramDoc(updated);
                }
                catch (backfillError) {
                    console.error('Failed to backfill program dates:', backfillError);
                    return normalized;
                }
            }));
            setPrograms(withDates);
        }
        catch (error) {
            console.error('Error fetching programs:', error);
            toast({
                title: 'Unable to load programs',
                description: error instanceof Error ? error.message : 'Please verify Appwrite configuration.',
                variant: 'destructive',
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const fetchProgramPartnerAssignments = async (programIds, programsSnapshot = programs) => {
        if (!COLLECTIONS.PROGRAM_PARTNERS) {
            setProgramPartnerMap({});
            return;
        }
        try {
            const allRows = await fetchAllCollectionDocuments(COLLECTIONS.PROGRAM_PARTNERS);
            const byProgram = {};
            allRows.forEach((row) => {
                const programId = getProgramIdFromPartnerJoin(row);
                const partnerId = getPartnerIdFromPartnerJoin(row);
                if (!programId || !partnerId)
                    return;
                if (!byProgram[programId]) {
                    byProgram[programId] = { trainingPartnerId: '', partnerIds: [] };
                }
                const type = getPartnerTypeFromPartnerJoin(row);
                if (type === 'training_partner') {
                    byProgram[programId].trainingPartnerId = partnerId;
                }
                else if (!byProgram[programId].partnerIds.includes(partnerId)) {
                    byProgram[programId].partnerIds.push(partnerId);
                }
            });
            const partnerById = {};
            partners.forEach((p) => {
                const label = String(p.name || p.email || p.$id || '').trim();
                const id = String(p.$id || '').trim();
                if (id)
                    partnerById[id] = label;
                const docId = String(p.documentId || '').trim();
                if (docId)
                    partnerById[docId] = label;
            });
            const nextMap = {};
            programIds.forEach((programId) => {
                const assignment = byProgram[programId] || { trainingPartnerId: '', partnerIds: [] };
                const fallbackProgram = programsSnapshot.find((p) => p.$id === programId);
                const fallbackTrainingPartner = fallbackProgram
                    ? (fallbackProgram.training_partner
                        || fallbackProgram.trainingPartner
                        || fallbackProgram['training-partners']
                        || fallbackProgram.training_partners
                        || '')
                    : '';
                const trainingPartnerName = partnerById[assignment.trainingPartnerId] || fallbackTrainingPartner;
                nextMap[programId] = {
                    training_partner_id: assignment.trainingPartnerId || '',
                    training_partner: trainingPartnerName,
                    partner_ids: assignment.partnerIds,
                    partner_names: assignment.partnerIds.map((id) => partnerById[id]).filter(Boolean),
                };
            });
            setProgramPartnerMap(nextMap);
        }
        catch (error) {
            console.error('Error fetching program-partner assignments:', error);
            setProgramPartnerMap({});
        }
    };
    const syncProgramPartners = async (programId, data) => {
        if (!COLLECTIONS.PROGRAM_PARTNERS || !programId)
            return;
        const mainPartnerId = String(data.training_partner_id || '').trim();
        const additionalPartnerIds = Array.from(new Set((Array.isArray(data.partner_ids) ? data.partner_ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
            .filter((id) => id !== mainPartnerId)));
        const desired = [];
        if (mainPartnerId) {
            desired.push({ partnerId: mainPartnerId, partnerType: 'training_partner' });
        }
        additionalPartnerIds.forEach((partnerId) => {
            desired.push({ partnerId, partnerType: 'partner' });
        });
        const existingForProgram = await listProgramPartnerJoinsForProgram(programId);
        for (const row of existingForProgram) {
            await databases.deleteDocument(DB_ID, COLLECTIONS.PROGRAM_PARTNERS, row.$id);
        }
        for (const row of desired) {
            const payloads = buildProgramPartnerPayloadCandidates(programId, row.partnerId, row.partnerType);
            let created = false;
            for (let i = 0; i < payloads.length; i++) {
                try {
                    await databases.createDocument(DB_ID, COLLECTIONS.PROGRAM_PARTNERS, 'unique()', payloads[i]);
                    created = true;
                    break;
                }
                catch (error) {
                    if (i === payloads.length - 1) {
                        throw error;
                    }
                }
            }
            if (!created) {
                throw new Error('Failed to create program partner assignment.');
            }
        }
    };
    const handleAddProgram = () => {
        setSelectedProgram(null);
        setShowDialog(true);
    };
    const handleEditProgram = (program) => {
        const mapped = programPartnerMap[program.$id] || {};
        setSelectedProgram({ ...program, ...mapped });
        setShowDialog(true);
    };
    const handleDeleteProgram = async (id) => {
        setPendingDeleteId(id);
    };
    const confirmDeleteProgram = async () => {
        if (!pendingDeleteId)
            return;
        try {
            if (COLLECTIONS.PROGRAM_PARTNERS) {
                const assignmentRows = await fetchAllCollectionDocuments(COLLECTIONS.PROGRAM_PARTNERS);
                const linkedRows = assignmentRows.filter((row) => getProgramIdFromPartnerJoin(row) === pendingDeleteId);
                for (const row of linkedRows) {
                    await databases.deleteDocument(DB_ID, COLLECTIONS.PROGRAM_PARTNERS, row.$id);
                }
            }
            await databases.deleteDocument(DB_ID, COLLECTIONS.PROGRAMS, pendingDeleteId);
            setPrograms(programs.filter(p => p.$id !== pendingDeleteId));
            toast({
                title: 'Program deleted',
                description: 'The training program was removed successfully.',
            });
        }
        catch (error) {
            console.error('Error deleting program:', error);
            toast({
                title: 'Delete failed',
                description: error instanceof Error ? error.message : 'Could not delete program.',
                variant: 'destructive',
            });
        }
        finally {
            setPendingDeleteId('');
        }
    };
    const handleSaveProgram = async (data) => {
        try {
            if (!databases || !DB_ID || !COLLECTIONS.PROGRAMS) {
                throw new Error('Programs collection is not configured. Check your Appwrite environment variables.');
            }
            const selectedPartner = partners.find((p) => p.$id === data.training_partner_id);
            const selectedPartnerName = selectedPartner?.name || String(data.training_partner || '').trim();
            const payloadData = {
                ...data,
                training_partner: selectedPartnerName,
                'training-partners': selectedPartnerName,
                training_partners: selectedPartnerName,
            };
            if (selectedProgram) {
                // Update existing
                const updated = await updateProgramWithFallback(selectedProgram.$id, payloadData);
                await syncProgramPartners(selectedProgram.$id, data);
                const nextPrograms = programs.map((p) => (p.$id === selectedProgram.$id
                    ? normalizeProgramDoc({ ...updated, ...data, training_partner: selectedPartner?.name || '' })
                    : p));
                setPrograms(nextPrograms);
                if (COLLECTIONS.PROGRAM_PARTNERS) {
                    await fetchProgramPartnerAssignments(nextPrograms.map((p) => p.$id).filter(Boolean), nextPrograms);
                }
            }
            else {
                // Create new
                const response = await createProgramWithFallback(payloadData);
                await syncProgramPartners(response.$id, data);
                const nextPrograms = [...programs, normalizeProgramDoc({ ...response, ...data, training_partner: selectedPartner?.name || '' })];
                setPrograms(nextPrograms);
                if (COLLECTIONS.PROGRAM_PARTNERS) {
                    await fetchProgramPartnerAssignments(nextPrograms.map((p) => p.$id).filter(Boolean), nextPrograms);
                }
            }
            setShowDialog(false);
            setSelectedProgram(null);
            toast({
                title: selectedProgram ? 'Program updated' : 'Program added',
                description: selectedProgram
                    ? 'Program changes were saved successfully.'
                    : 'New program created successfully.',
            });
        }
        catch (error) {
            console.error('Error saving program:', error);
            const message = error instanceof Error ? error.message : 'Failed to save program.';
            toast({
                title: 'Save failed',
                description: message,
                variant: 'destructive',
            });
            throw error;
        }
    };
    const programsWithPartnerAssignments = useMemo(() => {
        const trainerById = Object.fromEntries(trainers.map((t) => [t.$id, t.name || t.email || t.$id]));
        return programs.map((p) => {
            const n = normalizeProgramDoc(p);
            const m = programPartnerMap[p.$id] || {};
            const tid = String(n.trainer_id || '').trim();
            const trainerDisplay = String(n.trainer_name || '').trim() || (tid ? trainerById[tid] || '' : '');
            return {
                ...n,
                ...m,
                trainer_id: tid,
                trainer_name: trainerDisplay,
                partner_names: Array.isArray(m.partner_names) ? m.partner_names : [],
                partner_ids: Array.isArray(m.partner_ids) ? m.partner_ids : (Array.isArray(n.partner_ids) ? n.partner_ids : []),
            };
        });
    }, [programs, programPartnerMap, trainers]);
    const filteredPrograms = useMemo(() => {
        return programsWithPartnerAssignments.filter((p) => {
            const q = filters.query.trim().toLowerCase();
            const matchesQuery = !q
                || String(p.title || '').toLowerCase().includes(q)
                || String(p.training_partner || '').toLowerCase().includes(q)
                || String(p.description || '').toLowerCase().includes(q);
            const matchesStatus = filters.status === 'all' || String(p.status || '').toLowerCase() === filters.status;
            const matchesTrainer = filters.trainerId === 'all' || String(p.trainer_id || '') === filters.trainerId;
            const mainPartnerId = p.training_partner_id || programPartnerMap[p.$id]?.training_partner_id || '';
            const matchesPartner = filters.partner === 'all' || String(mainPartnerId) === filters.partner;
            const startDate = p.start_date ? new Date(p.start_date) : null;
            const fromDate = filters.fromDate ? new Date(filters.fromDate) : null;
            const toDate = filters.toDate ? new Date(filters.toDate) : null;
            const matchesFrom = !fromDate || !startDate || startDate >= fromDate;
            const matchesTo = !toDate || !startDate || startDate <= toDate;
            return matchesQuery && matchesStatus && matchesTrainer && matchesPartner && matchesFrom && matchesTo;
        });
    }, [programsWithPartnerAssignments, filters, programPartnerMap]);
    return (<div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">Training Programs</h1>
          <p className="mt-2 text-gray-600">Manage and organize training programs</p>
        </div>
        {isAdmin && (<Button className="w-full shrink-0 sm:w-auto" onClick={handleAddProgram}>
            <Plus className="mr-2 h-4 w-4"/>
            Add Program
          </Button>)}
      </div>
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <Label>Search</Label>
            <Input placeholder="Search title or description" value={filters.query} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}/>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lead Trainer</Label>
            <Select value={filters.trainerId} onValueChange={(value) => setFilters((prev) => ({ ...prev, trainerId: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trainers</SelectItem>
                {trainers.map((t) => (<SelectItem key={t.$id} value={t.$id}>{t.name || t.email || t.$id}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Training Partner</Label>
            <Select value={filters.partner} onValueChange={(value) => setFilters((prev) => ({ ...prev, partner: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All partners</SelectItem>
                {partners.map((p) => (<SelectItem key={p.$id} value={p.$id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start From</Label>
            <Input type="date" value={filters.fromDate} onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}/>
          </div>
          <div className="space-y-2">
            <Label>Start To</Label>
            <Input type="date" value={filters.toDate} onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}/>
          </div>
        </div>
      </Card>

      {/* Programs Table */}
      <Card>
        <ProgramTable programs={filteredPrograms} isLoading={isLoading} onEdit={isAdmin ? handleEditProgram : undefined} onDelete={isAdmin ? handleDeleteProgram : undefined} isAdmin={isAdmin} partners={partners} trainerMap={Object.fromEntries(trainers.map((t) => [t.$id, t.name || t.email || t.$id]))} paginationResetKey={JSON.stringify(filters)}/>
      </Card>

      {/* Add/Edit Dialog */}
      {isAdmin && (<ProgramDialog open={showDialog} onOpenChange={setShowDialog} program={selectedProgram} onSave={handleSaveProgram} trainers={trainers} partners={partners} isTrainersLoading={isTrainersLoading} isPartnersLoading={isPartnersLoading}/>)}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => {
            if (!open)
                setPendingDeleteId('');
        }}>
        <AlertDialogContent className="border-[#047857]/25">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete program?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected program and linked references may no longer appear in lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#ff8829] text-[#b45309] hover:bg-[#fff4eb] hover:text-[#9a3f05]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeleteProgram}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
