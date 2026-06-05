'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments } from '@/lib/fetch-all-documents';
import { TraineeStatus, TRAINEE_STATUS_HINT } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { TraineeDialog } from '@/components/trainee-dialog';
import { TraineeTable } from '@/components/trainee-table';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { getCourseFilterSelectOptions, getCourseKeyFromProgram, getTraineeCourseLabel, traineeMatchesCourseFilter, } from '@/lib/renewable-energy-courses';
import { assertValidTraineeLevel, enrichTraineeWithLevel, getTraineeLevelFilterSelectOptions, getTraineeLevelFromDoc, getTraineeLevelLabel, traineeMatchesLevelFilter, } from '@/lib/trainee-levels';
import { buildTrainerNameById, getTrainerIdFromProgram, resolveTrainerDisplayName, } from '@/lib/program-trainer';
function getEnrollmentTraineeId(doc) {
    const value = doc.trainee_id || doc.traineeId || doc.trainee || '';
    if (typeof value === 'string')
        return value;
    if (value && typeof value === 'object') {
        return value.$id || value.documentId || value.id || '';
    }
    return '';
}
function getEnrollmentProgramId(doc) {
    const value = doc.program_id || doc.programId || doc.program || '';
    if (typeof value === 'string')
        return value;
    if (value && typeof value === 'object') {
        return value.$id || value.documentId || value.id || '';
    }
    return '';
}
function documentStableId(doc) {
    if (!doc)
        return '';
    return String(doc.$id ?? doc.documentId ?? doc.id ?? '').trim();
}
function getProgramLabel(value) {
    if (!value)
        return '';
    if (typeof value === 'string')
        return '';
    if (Array.isArray(value)) {
        const first = value[0];
        return getProgramLabel(first);
    }
    if (typeof value === 'object') {
        return value.title || value.name || value.program_name || '';
    }
    return '';
}
function sanitizeTraineePayload(data) {
    const cleaned = {};
    Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null)
            return;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed === '')
                return;
            if (key === 'phone') {
                const normalized = trimmed.replace(/\s+/g, '');
                if (normalized.length > 12) {
                    throw new Error('Phone must be a string with at most 12 characters.');
                }
                cleaned[key] = normalized;
                return;
            }
            if (key === 'next_of_kin_phone') {
                const normalized = trimmed.replace(/\s+/g, '');
                if (normalized.length > 12) {
                    throw new Error('Next of kin phone must be a string with at most 12 characters.');
                }
                cleaned[key] = normalized;
                return;
            }
            if (key === 'gender') {
                const lower = trimmed.toLowerCase();
                if (lower === 'm' || lower === 'male') {
                    cleaned[key] = 'Male';
                    return;
                }
                if (lower === 'f' || lower === 'female') {
                    cleaned[key] = 'Female';
                    return;
                }
                throw new Error('Gender must be Male or Female.');
            }
            if (key === 'certification_status') {
                const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
                if (normalized === 'certified' || normalized === 'pending' || normalized === 'not_certified') {
                    cleaned[key] = normalized === 'not_certified' ? 'not-certified' : normalized;
                    return;
                }
                throw new Error('Certification status must be certified, pending, or not-certified.');
            }
            if (key === 'trainee_level') {
                const level = assertValidTraineeLevel(trimmed);
                cleaned[key] = level;
                return;
            }
            cleaned[key] = trimmed;
            return;
        }
        cleaned[key] = value;
    });
    if (typeof cleaned.consent_given === 'boolean') {
        cleaned.consent_given = cleaned.consent_given ? 'yes' : 'no';
    }
    if (typeof cleaned.consent_given === 'string') {
        const normalized = cleaned.consent_given.trim().toLowerCase();
        cleaned.consent_given = (normalized === 'yes' || normalized === 'true' || normalized === '1') ? 'yes' : 'no';
    }
    if (!cleaned.consent_given) {
        cleaned.consent_given = 'no';
    }
    if (!cleaned.certification_status) {
        cleaned.certification_status = 'pending';
    }
    return cleaned;
}
function buildTraineePayloadCandidates(payload, programId) {
    const base = {
        ...payload,
        program_id: programId,
    };
    const levelKey = payload.trainee_level ? assertValidTraineeLevel(payload.trainee_level) : '';
    const strictStringConsent = {
        ...base,
        consent_given: String(base.consent_given || 'no'),
    };
    if (levelKey) {
        strictStringConsent.trainee_level = levelKey;
    }
    const withoutConsentDate = { ...strictStringConsent };
    delete withoutConsentDate.consent_date;
    const consentTrueFalse = {
        ...withoutConsentDate,
        consent_given: withoutConsentDate.consent_given === 'yes' ? 'true' : 'false',
    };
    const candidates = [strictStringConsent, withoutConsentDate, consentTrueFalse];
    if (levelKey) {
        const withCamelLevel = { ...strictStringConsent, traineeLevel: levelKey };
        delete withCamelLevel.trainee_level;
        const withShortLevel = { ...strictStringConsent, level: levelKey };
        delete withShortLevel.trainee_level;
        const withShortLevelNoDate = { ...withoutConsentDate, level: levelKey };
        delete withShortLevelNoDate.trainee_level;
        candidates.unshift(withShortLevel, withCamelLevel, withShortLevelNoDate);
    }
    else {
        const withoutLevel = { ...strictStringConsent };
        delete withoutLevel.trainee_level;
        const withoutLevelNoDate = { ...withoutConsentDate };
        delete withoutLevelNoDate.trainee_level;
        candidates.push(withoutLevel, withoutLevelNoDate);
    }
    return candidates;
}
function isUnknownTraineeLevelAttributeError(message) {
    const msg = String(message || '');
    return /Unknown attribute:\s*["'](trainee_level|traineeLevel|level)["']/i.test(msg);
}
function responseHasTraineeLevel(doc) {
    return Boolean(getTraineeLevelFromDoc(doc));
}
function throwTraineeLevelAttributeSetupError() {
    throw new Error('Participant level was not saved. In Appwrite → trainees collection → Attributes, add Enum `trainee_level` (or `level`) with values `beginner`, `technician`, and `trainer`, click Update, then save again.');
}
async function createTraineeWithFallback(payload, programId) {
    const levelKey = payload.trainee_level ? assertValidTraineeLevel(payload.trainee_level) : '';
    const candidates = buildTraineePayloadCandidates(payload, programId);
    const attemptErrors = [];
    let sawUnknownLevel = false;
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        try {
            const doc = await databases.createDocument(DB_ID, COLLECTIONS.TRAINEES, 'unique()', {
                ...candidate,
                status: candidate.status || TraineeStatus.ENROLLED,
            });
            if (levelKey && !responseHasTraineeLevel(doc)) {
                throwTraineeLevelAttributeSetupError();
            }
            return doc;
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (isUnknownTraineeLevelAttributeError(msg)) {
                sawUnknownLevel = true;
                attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
                continue;
            }
            if (msg.includes('Participant level was not saved')) {
                throw error;
            }
            attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
        }
    }
    if (levelKey && sawUnknownLevel) {
        throwTraineeLevelAttributeSetupError();
    }
    throw new Error(`Failed to create trainee. ${attemptErrors.join(' | ')}`);
}
async function updateTraineeWithFallback(traineeId, payload, programId) {
    const levelKey = payload.trainee_level ? assertValidTraineeLevel(payload.trainee_level) : '';
    const candidates = buildTraineePayloadCandidates(payload, programId);
    const attemptErrors = [];
    let sawUnknownLevel = false;
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        try {
            const doc = await databases.updateDocument(DB_ID, COLLECTIONS.TRAINEES, traineeId, candidate);
            if (levelKey && !responseHasTraineeLevel(doc)) {
                throwTraineeLevelAttributeSetupError();
            }
            return doc;
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (isUnknownTraineeLevelAttributeError(msg)) {
                sawUnknownLevel = true;
                attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
                continue;
            }
            if (msg.includes('Participant level was not saved')) {
                throw error;
            }
            attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
        }
    }
    if (levelKey && sawUnknownLevel) {
        throwTraineeLevelAttributeSetupError();
    }
    throw new Error(`Failed to update trainee. ${attemptErrors.join(' | ')}`);
}
export default function TraineesPage() {
    const { isAdmin, isManager } = useAuth();
    const [trainees, setTrainees] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [isProgramsLoading, setIsProgramsLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedTrainee, setSelectedTrainee] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [filters, setFilters] = useState({
        query: '',
        status: 'all',
        gender: 'all',
        course: 'all',
        traineeLevel: 'all',
        programId: 'all',
        district: '',
    });
    useEffect(() => {
        fetchTrainees();
    }, []);
    const fetchPrograms = async () => {
        setIsProgramsLoading(true);
        if (!databases || !DB_ID || !COLLECTIONS.PROGRAMS) {
            toast({
                title: 'Courses not configured',
                description: 'Set NEXT_PUBLIC_APPWRITE_PROGRAMS_COLLECTION_ID in your environment.',
                variant: 'destructive',
            });
            setIsProgramsLoading(false);
            return [];
        }
        try {
            return await fetchAllDocuments(databases, DB_ID, COLLECTIONS.PROGRAMS);
        }
        catch (error) {
            console.error('Error fetching programs for trainee form:', error);
            toast({
                title: `Unable to load ${COURSE_MODULE_LABELS.modulePlural}`,
                description: error instanceof Error ? error.message : `Could not load ${COURSE_MODULE_LABELS.modulePlural} for enrollment.`,
                variant: 'destructive',
            });
            return [];
        }
        finally {
            setIsProgramsLoading(false);
        }
    };
    const fetchTrainers = async () => {
        if (!databases || !DB_ID || !COLLECTIONS.TRAINERS)
            return [];
        try {
            return await fetchAllDocuments(databases, DB_ID, COLLECTIONS.TRAINERS);
        }
        catch (error) {
            console.error('Error fetching trainers for trainees:', error);
            return [];
        }
    };
    const fetchEnrollments = async () => {
        if (!databases || !DB_ID || !COLLECTIONS.ENROLLMENTS)
            return [];
        return await fetchAllDocuments(databases, DB_ID, COLLECTIONS.ENROLLMENTS);
    };
    const fetchTrainees = async () => {
        try {
            setIsLoading(true);
            if (!databases || !DB_ID || !COLLECTIONS.TRAINEES) {
                throw new Error('Trainees collection is not configured. Check your Appwrite environment variables.');
            }
            const [traineeDocs, programDocs, enrollmentDocs, trainerDocs] = await Promise.all([
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.TRAINEES),
                fetchPrograms(),
                fetchEnrollments(),
                fetchTrainers(),
            ]);
            setPrograms(programDocs);
            setTrainers(trainerDocs);
            const trainerById = buildTrainerNameById(trainerDocs);
            const enrollmentByTrainee = Object.fromEntries(enrollmentDocs
                .map((e) => {
                const traineeId = getEnrollmentTraineeId(e);
                const programValue = e.program || e.program_id || e.programId || '';
                return [traineeId, {
                        program_id: getEnrollmentProgramId(e),
                        program_name: getProgramLabel(programValue),
                    }];
            })
                .filter(([traineeId]) => !!traineeId));
            const programByIdSnapshot = Object.fromEntries(programDocs.map((p) => [p.$id, p]));
            const mappedTrainees = traineeDocs.map((t) => {
                const programId = enrollmentByTrainee[t.$id]?.program_id
                    || t.program_id
                    || t.programId
                    || (t.program && typeof t.program === 'object' ? (t.program.$id || t.program.documentId || t.program.id || '') : t.program)
                    || '';
                const prog = programByIdSnapshot[programId];
                const trainerId = prog ? getTrainerIdFromProgram(prog) : '';
                return {
                    ...t,
                    trainee_level: getTraineeLevelFromDoc(t),
                    trainee_level_label: getTraineeLevelLabel(getTraineeLevelFromDoc(t)),
                    program_id: programId,
                    program_name: enrollmentByTrainee[t.$id]?.program_name
                        || (t.program && typeof t.program === 'object' ? getProgramLabel(t.program) : '')
                        || '',
                    trainer_id: trainerId,
                    trainer_name: prog ? resolveTrainerDisplayName(prog, trainerById) : '',
                };
            });
            setTrainees(mappedTrainees);
        }
        catch (error) {
            console.error('Error fetching trainees:', error);
            toast({
                title: 'Unable to load trainees',
                description: error instanceof Error ? error.message : 'Please verify Appwrite configuration.',
                variant: 'destructive',
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleAddTrainee = () => {
        setSelectedTrainee(null);
        setShowDialog(true);
    };
    const handleEditTrainee = (trainee) => {
        setSelectedTrainee(trainee);
        setShowDialog(true);
    };
    useEffect(() => {
        if (!showDialog)
            return;
        Promise.all([fetchPrograms(), fetchTrainers()]).then(([programDocs, trainerDocs]) => {
            setPrograms(programDocs);
            setTrainers(trainerDocs);
        });
    }, [showDialog]);
    const handleDeleteTrainee = async (id) => {
        setPendingDeleteId(id);
    };
    const confirmDeleteTrainee = async () => {
        if (!pendingDeleteId)
            return;
        try {
            await databases.deleteDocument(DB_ID, COLLECTIONS.TRAINEES, pendingDeleteId);
            setTrainees(trainees.filter(t => t.$id !== pendingDeleteId));
            toast({
                title: 'Trainee deleted',
                description: 'The trainee record was removed successfully.',
            });
        }
        catch (error) {
            console.error('Error deleting trainee:', error);
            toast({
                title: 'Delete failed',
                description: error instanceof Error ? error.message : 'Could not delete trainee.',
                variant: 'destructive',
            });
        }
        finally {
            setPendingDeleteId('');
        }
    };
    const trainerById = useMemo(() => buildTrainerNameById(trainers), [trainers]);
    const programById = useMemo(() => Object.fromEntries(programs.map((p) => [p.$id, { ...p, course: getCourseKeyFromProgram(p) }])), [programs]);
    const handleSaveTrainee = async (data) => {
        try {
            if (!databases || !DB_ID || !COLLECTIONS.TRAINEES) {
                throw new Error('Trainees collection is not configured. Check your Appwrite environment variables.');
            }
            const payload = sanitizeTraineePayload(data);
            payload.gender = payload.gender === 'Female' ? 'Female' : 'Male';
            if (!String(payload.qualification || '').trim()) {
                throw new Error('Qualification is required.');
            }
            const { program_id, ...traineePayload } = payload;
            if (!program_id) {
                throw new Error(`Please select a ${COURSE_MODULE_LABELS.moduleSingular} for this trainee.`);
            }
            const normalizedEmail = String(traineePayload.email || '').trim().toLowerCase();
            const normalizedPhone = String(traineePayload.phone || '').trim();
            const selectedId = documentStableId(selectedTrainee);
            const duplicate = trainees.find((t) => {
                if (selectedTrainee && documentStableId(t) === selectedId)
                    return false;
                const sameEmail = normalizedEmail &&
                    String(t.email || '').trim().toLowerCase() === normalizedEmail;
                const samePhone = normalizedPhone &&
                    String(t.phone || '').trim() === normalizedPhone;
                return sameEmail || samePhone;
            });
            if (duplicate) {
                const duplicateReason = String(duplicate.email || '').trim().toLowerCase() === normalizedEmail
                    ? 'email'
                    : 'phone';
                throw new Error(`A trainee with this ${duplicateReason} already exists.`);
            }
            if (selectedTrainee) {
                // Update existing
                const updateId = String(selectedTrainee.$id || selectedTrainee.documentId || selectedId).trim();
                const updated = await updateTraineeWithFallback(updateId, traineePayload, program_id);
                const prog = programById[program_id];
                const tid = prog ? getTrainerIdFromProgram(prog) : '';
                setTrainees(trainees.map((t) => (documentStableId(t) === selectedId
                    ? enrichTraineeWithLevel({
                        ...t,
                        ...updated,
                        program_id,
                        trainer_id: tid,
                        trainer_name: prog ? resolveTrainerDisplayName(prog, trainerById) : '',
                    }, traineePayload.trainee_level)
                    : t)));
            }
            else {
                // Create new
                const response = await createTraineeWithFallback(traineePayload, program_id);
                const prog = programById[program_id];
                const tid = prog ? getTrainerIdFromProgram(prog) : '';
                setTrainees([...trainees, enrichTraineeWithLevel({
                    ...response,
                    program_id,
                    trainer_id: tid,
                    trainer_name: prog ? resolveTrainerDisplayName(prog, trainerById) : '',
                }, traineePayload.trainee_level)]);
            }
            setShowDialog(false);
            setSelectedTrainee(null);
            toast({
                title: selectedTrainee ? 'Trainee updated' : 'Trainee added',
                description: selectedTrainee
                    ? 'Changes were saved successfully.'
                    : 'New trainee record created successfully.',
            });
        }
        catch (error) {
            console.error('Error saving trainee:', error);
            let message = error instanceof Error ? error.message : 'Failed to save trainee.';
            if (typeof message === 'string' && message.includes('Unknown attribute: "program_id"')) {
                message = 'Add a "program_id" attribute in the trainees collection (String or Relationship to courses), then try again.';
            }
            toast({
                title: 'Save failed',
                description: message,
                variant: 'destructive',
            });
            throw error;
        }
    };
    const courseMap = useMemo(() => Object.fromEntries(programs.map((p) => [p.$id, getTraineeCourseLabel({ program_id: p.$id }, programById)])), [programs, programById]);
    const filteredTrainees = useMemo(() => {
        const statusBucket = (s) => {
            const v = String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
            if (v === 'active')
                return 'in_progress';
            return v;
        };
        return trainees.filter((t) => {
            const q = filters.query.trim().toLowerCase();
            const matchesQuery = !q
                || String(t.name || '').toLowerCase().includes(q)
                || String(t.email || '').toLowerCase().includes(q)
                || String(t.phone || '').toLowerCase().includes(q);
            const matchesStatus = filters.status === 'all' || statusBucket(t.status) === statusBucket(filters.status);
            const matchesGender = filters.gender === 'all' || String(t.gender || '').toLowerCase() === filters.gender;
            const traineeProgramId = String(t.program_id || '').trim();
            const matchesProgram = filters.programId === 'all' || traineeProgramId === filters.programId;
            const matchesCourse = traineeMatchesCourseFilter(t, filters.course, programById);
            const matchesLevel = traineeMatchesLevelFilter(t, filters.traineeLevel);
            const districtNeedle = filters.district.trim().toLowerCase();
            const matchesDistrict = !districtNeedle || String(t.district || '').toLowerCase().includes(districtNeedle);
            return matchesQuery && matchesStatus && matchesGender && matchesCourse && matchesLevel && matchesProgram && matchesDistrict;
        });
    }, [trainees, filters, programById]);
    return (<div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">Trainees</h1>
          <p className="mt-2 text-gray-600">Manage training course participants</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {isAdmin && (<>
              <Link href="/dashboard/trainees/import" className="min-w-0 flex-1 sm:flex-none">
                <Button className="w-full sm:w-auto">
                  <Upload className="mr-2 h-4 w-4"/>
                  Import CSV
                </Button>
              </Link>
              <Button className="flex-1 sm:flex-none" onClick={handleAddTrainee}>
                <Plus className="mr-2 h-4 w-4"/>
                Add Trainee
              </Button>
            </>)}
        </div>
      </div>
      <Card className="mb-6 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <div className="min-w-0 space-y-2 sm:col-span-2 2xl:col-span-2">
            <Label>Search</Label>
            <Input placeholder="Search by name, email or phone" value={filters.query} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}/>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="enrolled">Currently Enrolled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="dropped">Dropped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Gender</Label>
            <Select value={filters.gender} onValueChange={(value) => setFilters((prev) => ({ ...prev, gender: value }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2 sm:col-span-2 2xl:col-span-2">
            <Label>{COURSE_MODULE_LABELS.categoryFilterLabel}</Label>
            <Select value={filters.course} onValueChange={(value) => setFilters((prev) => ({ ...prev, course: value }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getCourseFilterSelectOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Level</Label>
            <Select value={filters.traineeLevel} onValueChange={(value) => setFilters((prev) => ({ ...prev, traineeLevel: value }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getTraineeLevelFilterSelectOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-2 2xl:col-span-2">
            <Label>{COURSE_MODULE_LABELS.enrollmentLabel}</Label>
            <Select value={filters.programId} onValueChange={(value) => setFilters((prev) => ({ ...prev, programId: value }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{COURSE_MODULE_LABELS.filterAll}</SelectItem>
                {programs.map((p) => (<SelectItem key={p.$id} value={p.$id}>{p.title || p.name || 'Untitled'}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>District</Label>
            <Input className="w-full" placeholder="Filter district" value={filters.district} onChange={(e) => setFilters((prev) => ({ ...prev, district: e.target.value }))}/>
          </div>
        </div>
      </Card>

      {/* Trainees Table */}
      <Card>
        <TraineeTable trainees={filteredTrainees} isLoading={isLoading} onEdit={isAdmin ? handleEditTrainee : undefined} onDelete={isAdmin ? handleDeleteTrainee : undefined} isAdmin={isAdmin} programMap={Object.fromEntries(programs.map((p) => [p.$id, p.title || p.name || p.program_name || '']))} courseMap={courseMap} paginationResetKey={JSON.stringify(filters)}/>
      </Card>

      {/* Add/Edit Dialog */}
      {isAdmin && (<TraineeDialog open={showDialog} onOpenChange={setShowDialog} trainee={selectedTrainee} onSave={handleSaveTrainee} programs={programs} isProgramsLoading={isProgramsLoading}/>)}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => {
            if (!open)
                setPendingDeleteId('');
        }}>
        <AlertDialogContent className="border-[#047857]/25">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trainee?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The trainee record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#ff8829] text-[#b45309] hover:bg-[#fff4eb] hover:text-[#9a3f05]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeleteTrainee}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
