'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { TraineeStatus } from '@/lib/types';
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
    const strictStringConsent = {
        ...base,
        consent_given: String(base.consent_given || 'no'),
    };
    const withoutConsentDate = { ...strictStringConsent };
    delete withoutConsentDate.consent_date;
    const consentTrueFalse = {
        ...withoutConsentDate,
        consent_given: withoutConsentDate.consent_given === 'yes' ? 'true' : 'false',
    };
    return [strictStringConsent, withoutConsentDate, consentTrueFalse];
}
async function createTraineeWithFallback(payload, programId) {
    const candidates = buildTraineePayloadCandidates(payload, programId);
    const attemptErrors = [];
    for (let i = 0; i < candidates.length; i++) {
        try {
            return await databases.createDocument(DB_ID, COLLECTIONS.TRAINEES, 'unique()', {
                ...candidates[i],
                status: candidates[i].status || TraineeStatus.ENROLLED,
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
        }
    }
    throw new Error(`Failed to create trainee. ${attemptErrors.join(' | ')}`);
}
async function updateTraineeWithFallback(traineeId, payload, programId) {
    const candidates = buildTraineePayloadCandidates(payload, programId);
    const attemptErrors = [];
    for (let i = 0; i < candidates.length; i++) {
        try {
            return await databases.updateDocument(DB_ID, COLLECTIONS.TRAINEES, traineeId, candidates[i]);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            attemptErrors.push(`Attempt ${i + 1}: ${msg}`);
        }
    }
    throw new Error(`Failed to update trainee. ${attemptErrors.join(' | ')}`);
}
export default function TraineesPage() {
    const { isAdmin, isManager } = useAuth();
    const [trainees, setTrainees] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [isProgramsLoading, setIsProgramsLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedTrainee, setSelectedTrainee] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [filters, setFilters] = useState({
        query: '',
        status: 'all',
        gender: 'all',
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
                title: 'Programs not configured',
                description: 'Set NEXT_PUBLIC_APPWRITE_PROGRAMS_COLLECTION_ID in your environment.',
                variant: 'destructive',
            });
            setIsProgramsLoading(false);
            return [];
        }
        try {
            const response = await databases.listDocuments(DB_ID, COLLECTIONS.PROGRAMS);
            return response.documents;
        }
        catch (error) {
            console.error('Error fetching programs for trainee form:', error);
            toast({
                title: 'Unable to load programs',
                description: error instanceof Error ? error.message : 'Could not load programs for enrollment.',
                variant: 'destructive',
            });
            return [];
        }
        finally {
            setIsProgramsLoading(false);
        }
    };
    const fetchEnrollments = async () => {
        if (!databases || !DB_ID || !COLLECTIONS.ENROLLMENTS)
            return [];
        const response = await databases.listDocuments(DB_ID, COLLECTIONS.ENROLLMENTS);
        return response.documents;
    };
    const fetchTrainees = async () => {
        try {
            setIsLoading(true);
            if (!databases || !DB_ID || !COLLECTIONS.TRAINEES) {
                throw new Error('Trainees collection is not configured. Check your Appwrite environment variables.');
            }
            const traineeResponse = await databases.listDocuments(DB_ID, COLLECTIONS.TRAINEES);
            const [programDocs, enrollmentDocs] = await Promise.all([fetchPrograms(), fetchEnrollments()]);
            setPrograms(programDocs);
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
            const mappedTrainees = traineeResponse.documents.map((t) => ({
                ...t,
                program_id: enrollmentByTrainee[t.$id]?.program_id
                    || t.program_id
                    || t.programId
                    || (t.program && typeof t.program === 'object' ? (t.program.$id || t.program.documentId || t.program.id || '') : t.program)
                    || '',
                program_name: enrollmentByTrainee[t.$id]?.program_name
                    || (t.program && typeof t.program === 'object' ? getProgramLabel(t.program) : '')
                    || '',
            }));
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
        fetchPrograms().then((docs) => setPrograms(docs));
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
                throw new Error('Please select a program for this trainee.');
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
                setTrainees(trainees.map((t) => (documentStableId(t) === selectedId ? { ...t, ...updated, program_id } : t)));
            }
            else {
                // Create new
                const response = await createTraineeWithFallback(traineePayload, program_id);
                setTrainees([...trainees, { ...response, program_id }]);
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
                message = 'Add a "program_id" attribute in the trainees collection (String or Relationship to programs), then try again.';
            }
            toast({
                title: 'Save failed',
                description: message,
                variant: 'destructive',
            });
            throw error;
        }
    };
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
            const districtNeedle = filters.district.trim().toLowerCase();
            const matchesDistrict = !districtNeedle || String(t.district || '').toLowerCase().includes(districtNeedle);
            return matchesQuery && matchesStatus && matchesGender && matchesProgram && matchesDistrict;
        });
    }, [trainees, filters]);
    return (<div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">Trainees</h1>
          <p className="mt-2 text-gray-600">Manage training program participants</p>
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
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <Label>Search</Label>
            <Input placeholder="Search by name, email or phone" value={filters.query} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}/>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="enrolled">Enrolled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="dropped">Dropped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={filters.gender} onValueChange={(value) => setFilters((prev) => ({ ...prev, gender: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Program</Label>
            <Select value={filters.programId} onValueChange={(value) => setFilters((prev) => ({ ...prev, programId: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {programs.map((p) => (<SelectItem key={p.$id} value={p.$id}>{p.title || p.name || 'Untitled'}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>District</Label>
            <Input placeholder="Filter district" value={filters.district} onChange={(e) => setFilters((prev) => ({ ...prev, district: e.target.value }))}/>
          </div>
        </div>
      </Card>

      {/* Trainees Table */}
      <Card>
        <TraineeTable trainees={filteredTrainees} isLoading={isLoading} onEdit={isAdmin ? handleEditTrainee : undefined} onDelete={isAdmin ? handleDeleteTrainee : undefined} isAdmin={isAdmin} programMap={Object.fromEntries(programs.map((p) => [p.$id, p.title || p.name || p.program_name || '']))} paginationResetKey={JSON.stringify(filters)}/>
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
