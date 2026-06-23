'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments } from '@/lib/fetch-all-documents';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { TrainerDialog } from '@/components/trainer-dialog';
import { TrainerTable } from '@/components/trainer-table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getRetcFacilitatorRoleLabel, RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import {
    buildSpecializationWriteVariants,
    normalizeSpecializationKeys,
    trainerMatchesSpecializationQuery,
} from '@/lib/trainer-specializations';
function documentStableId(doc) {
    if (!doc)
        return '';
    return String(doc.$id ?? doc.documentId ?? doc.id ?? '').trim();
}
function sanitizeTrainerPayload(data) {
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
            if (key === 'email') {
                if (trimmed && !trimmed.includes('@')) {
                    throw new Error('Please enter a valid RETC facilitator email.');
                }
                cleaned[key] = trimmed.toLowerCase();
                return;
            }
            cleaned[key] = trimmed;
            return;
        }
        cleaned[key] = value;
    });
    if (Array.isArray(data.specializations)) {
        const keys = normalizeSpecializationKeys(data.specializations);
        if (keys.length === 0) {
            throw new Error('Select at least one specialization.');
        }
        cleaned.specializations = keys;
    }
    if (cleaned.training_partner) {
        // Keep backward compatibility with existing Appwrite schema keys.
        if (!cleaned.organization) {
            cleaned.organization = cleaned.training_partner;
        }
        if (!cleaned['training-partners']) {
            cleaned['training-partners'] = cleaned.training_partner;
        }
    }
    if (!String(cleaned.training_partner || '').trim()
        && !String(cleaned.organization || '').trim()
        && !String(cleaned['training-partners'] || '').trim()) {
        throw new Error('Training partner is required.');
    }
    if (!String(cleaned.email || '').trim()) {
        throw new Error('Email is required.');
    }
    return cleaned;
}
function buildTrainerPayloadCandidates(payload) {
    const base = { ...payload };
    const trainingPartner = String(base.training_partner || '').trim();
    const email = String(base.email || '').trim().toLowerCase();
    const specializations = normalizeSpecializationKeys(base.specializations);
    if (!email) {
        throw new Error('Email is required.');
    }
    if (!trainingPartner) {
        throw new Error('Training partner is required.');
    }
    if (!specializations.length) {
        throw new Error('Select at least one specialization.');
    }
    delete base.training_partner;
    delete base.trainingPartner;
    delete base.training_partners;
    delete base['training-partners'];
    delete base.organization;
    delete base.specialization;
    delete base.specialisation;
    delete base.specializations;
    delete base.specialization_keys;
    delete base.specializationKeys;
    base.email = email;
    const candidates = [];
    const specVariants = buildSpecializationWriteVariants(specializations);
    const partnerVariants = [
        { 'training-partners': trainingPartner },
        { training_partners: trainingPartner },
        { trainingPartner: trainingPartner },
        { organization: trainingPartner },
        {},
    ];
    specVariants.forEach((specPatch) => {
        partnerVariants.forEach((partnerPatch) => {
            candidates.push({ ...base, ...specPatch, ...partnerPatch });
        });
    });
    return candidates;
}
async function createTrainerWithFallback(payload) {
    const candidates = buildTrainerPayloadCandidates(payload);
    const errors = [];
    for (let i = 0; i < candidates.length; i++) {
        try {
            return await databases.createDocument(DB_ID, COLLECTIONS.TRAINERS, 'unique()', candidates[i]);
        }
        catch (error) {
            errors.push(`Attempt ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(`Failed to create RETC facilitator. ${errors.join(' | ')}`);
}
async function updateTrainerWithFallback(trainerId, payload) {
    const candidates = buildTrainerPayloadCandidates(payload);
    const errors = [];
    for (let i = 0; i < candidates.length; i++) {
        try {
            return await databases.updateDocument(DB_ID, COLLECTIONS.TRAINERS, trainerId, candidates[i]);
        }
        catch (error) {
            errors.push(`Attempt ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(`Failed to update RETC facilitator. ${errors.join(' | ')}`);
}
export default function TrainersPage() {
    const { isAdmin } = useAuth();
    const [trainers, setTrainers] = useState([]);
    const [partners, setPartners] = useState([]);
    const [isPartnersLoading, setIsPartnersLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [filters, setFilters] = useState({
        query: '',
        role: 'all',
        status: 'all',
    });
    useEffect(() => {
        fetchTrainers();
        fetchPartners();
    }, []);
    const fetchPartners = async () => {
        if (!COLLECTIONS.PARTNERS) {
            setPartners([]);
            return;
        }
        try {
            setIsPartnersLoading(true);
            const docs = await fetchAllDocuments(databases, DB_ID, COLLECTIONS.PARTNERS);
            setPartners(docs);
        }
        catch (error) {
            console.error('Error fetching partners for trainer assignment:', error);
            setPartners([]);
        }
        finally {
            setIsPartnersLoading(false);
        }
    };
    const fetchTrainers = async () => {
        try {
            setIsLoading(true);
            const docs = await fetchAllDocuments(databases, DB_ID, COLLECTIONS.TRAINERS);
            setTrainers(docs);
        }
        catch (error) {
            console.error('Error fetching trainers:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleAddTrainer = () => {
        setSelectedTrainer(null);
        setShowDialog(true);
    };
    const handleEditTrainer = (trainer) => {
        setSelectedTrainer(trainer);
        setShowDialog(true);
    };
    const handleDeleteTrainer = async (id) => {
        setPendingDeleteId(id);
    };
    const confirmDeleteTrainer = async () => {
        if (!pendingDeleteId)
            return;
        try {
            await databases.deleteDocument(DB_ID, COLLECTIONS.TRAINERS, pendingDeleteId);
            setTrainers(trainers.filter(t => t.$id !== pendingDeleteId));
            toast({
                title: 'RETC facilitator deleted',
                description: 'The RETC facilitator profile was removed successfully.',
            });
        }
        catch (error) {
            console.error('Error deleting trainer:', error);
            toast({
                title: 'Delete failed',
                description: error instanceof Error ? error.message : 'Could not delete RETC facilitator.',
                variant: 'destructive',
            });
        }
        finally {
            setPendingDeleteId('');
        }
    };
    const handleSaveTrainer = async (data) => {
        try {
            const payload = sanitizeTrainerPayload(data);
            const normalizedEmail = String(payload.email || '').trim().toLowerCase();
            const normalizedPhone = String(payload.phone || '').trim();
            const selectedId = documentStableId(selectedTrainer);
            const duplicate = trainers.find((trainer) => {
                if (selectedTrainer && documentStableId(trainer) === selectedId)
                    return false;
                const emailMatch = normalizedEmail && String(trainer.email || '').trim().toLowerCase() === normalizedEmail;
                const phoneMatch = normalizedPhone && String(trainer.phone || '').trim() === normalizedPhone;
                return emailMatch || phoneMatch;
            });
            if (duplicate) {
                const reason = String(duplicate.email || '').trim().toLowerCase() === normalizedEmail ? 'email' : 'phone';
                throw new Error(`An RETC facilitator with this ${reason} already exists.`);
            }
            if (selectedTrainer) {
                const updateId = String(selectedTrainer.$id || selectedTrainer.documentId || selectedId).trim();
                const updated = await updateTrainerWithFallback(updateId, payload);
                setTrainers(trainers.map((t) => (documentStableId(t) === selectedId ? updated : t)));
            }
            else {
                const response = await createTrainerWithFallback(payload);
                setTrainers([...trainers, response]);
            }
            setShowDialog(false);
            setSelectedTrainer(null);
            toast({
                title: selectedTrainer ? 'RETC facilitator updated' : 'RETC facilitator added',
                description: selectedTrainer ? 'RETC facilitator changes were saved.' : 'New RETC facilitator created successfully.',
            });
        }
        catch (error) {
            console.error('Error saving trainer:', error);
            toast({
                title: 'Save failed',
                description: error instanceof Error ? error.message : 'Failed to save RETC facilitator.',
                variant: 'destructive',
            });
            throw error;
        }
    };
    const filteredTrainers = useMemo(() => {
        return trainers.filter((t) => {
            const q = filters.query.trim().toLowerCase();
            const matchesQuery = !q
                || String(t.name || '').toLowerCase().includes(q)
                || String(t.email || '').toLowerCase().includes(q)
                || trainerMatchesSpecializationQuery(t, q)
                || String(t.training_partner || t.trainingPartner || t['training-partners'] || t.training_partners || t.organization || '').toLowerCase().includes(q);
            const matchesRole = filters.role === 'all' || String(t.role || '').toLowerCase() === filters.role;
            const matchesStatus = filters.status === 'all' || String(t.status || '').toLowerCase() === filters.status;
            return matchesQuery && matchesRole && matchesStatus;
        });
    }, [trainers, filters]);
    return (<div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">{RETC_FACILITATOR_LABELS.moduleTitle}</h1>
          <p className="mt-2 text-gray-600">{RETC_FACILITATOR_LABELS.manageDescription}</p>
        </div>
        {isAdmin && (<Button className="w-full shrink-0 sm:w-auto" onClick={handleAddTrainer}>
            <Plus className="mr-2 h-4 w-4"/>
            {RETC_FACILITATOR_LABELS.addButton}
          </Button>)}
      </div>
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input placeholder="Name, email, specialization..." value={filters.query} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}/>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={filters.role} onValueChange={(value) => setFilters((prev) => ({ ...prev, role: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="trainer">{getRetcFacilitatorRoleLabel('trainer')}</SelectItem>
                <SelectItem value="senior_trainer">{getRetcFacilitatorRoleLabel('senior_trainer')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <TrainerTable trainers={filteredTrainers} isLoading={isLoading} onEdit={isAdmin ? handleEditTrainer : undefined} onDelete={isAdmin ? handleDeleteTrainer : undefined} isAdmin={isAdmin} paginationResetKey={JSON.stringify(filters)}/>
      </Card>

      {isAdmin && (<TrainerDialog open={showDialog} onOpenChange={setShowDialog} trainer={selectedTrainer} onSave={handleSaveTrainer} partners={partners} isPartnersLoading={isPartnersLoading}/>)}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => {
            if (!open)
                setPendingDeleteId('');
        }}>
        <AlertDialogContent className="border-[#047857]/25">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RETC facilitator?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The RETC facilitator profile will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#ff8829] text-[#b45309] hover:bg-[#fff4eb] hover:text-[#9a3f05]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeleteTrainer}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
