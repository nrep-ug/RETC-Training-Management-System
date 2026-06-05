'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Query } from 'appwrite';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments } from '@/lib/fetch-all-documents';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PartnerDialog } from '@/components/partner-dialog';
import { PartnerTable } from '@/components/partner-table';
import { PARTNER_LABELS } from '@/lib/partner-labels';
function documentStableId(doc) {
    if (!doc)
        return '';
    return String(doc.$id ?? doc.documentId ?? doc.id ?? '').trim();
}
function sanitizePartnerPayload(data) {
    const cleaned = {};
    Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null)
            return;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed)
                return;
            if (key === 'phone' && trimmed.replace(/\s+/g, '').length > 12) {
                throw new Error('Partner phone must be a string with at most 12 characters.');
            }
            cleaned[key] = key === 'email' ? trimmed.toLowerCase() : trimmed;
            return;
        }
        cleaned[key] = value;
    });
    return cleaned;
}
async function fetchAllPartnerDocuments() {
    return fetchAllDocuments(databases, DB_ID, COLLECTIONS.PARTNERS);
}
/** Blocks duplicate partner org name / email only. Contact person (and phone) may repeat across partners. */
async function assertNoPartnerDuplicates(payload, { excludeId = '', localPartners = [] } = {}) {
    if (!databases || !DB_ID || !COLLECTIONS.PARTNERS)
        return;
    const nameTrim = String(payload.name || '').trim();
    const nameLower = nameTrim.toLowerCase();
    const emailLower = String(payload.email || '').trim().toLowerCase();
    const tryEqual = async (attr, value) => {
        if (!value)
            return null;
        try {
            const res = await databases.listDocuments(DB_ID, COLLECTIONS.PARTNERS, [
                Query.equal(attr, value),
                Query.limit(10),
            ]);
            return res.documents.find((d) => documentStableId(d) !== excludeId) || null;
        }
        catch {
            return null;
        }
    };
    for (const p of localPartners) {
        if (!p || documentStableId(p) === excludeId)
            continue;
        if (nameLower && String(p.name || '').trim().toLowerCase() === nameLower) {
            throw new Error(`A partner named "${p.name || nameTrim}" already exists (same name, different spelling may still count). Edit that record or choose a different name.`);
        }
        if (emailLower && String(p.email || '').trim().toLowerCase() === emailLower) {
            throw new Error(`The email ${emailLower} is already used by "${p.name || 'another partner'}". Each partner must have a unique email.`);
        }
    }
    if (nameTrim) {
        const dupName = await tryEqual('name', nameTrim);
        if (dupName && documentStableId(dupName) !== excludeId)
            throw new Error(`A partner named "${dupName.name || nameTrim}" already exists. Edit that record or choose a different name.`);
    }
    if (emailLower) {
        const dupEmail = await tryEqual('email', emailLower);
        if (dupEmail && documentStableId(dupEmail) !== excludeId)
            throw new Error(`The email ${emailLower} is already used by "${dupEmail.name || 'another partner'}". Each partner must have a unique email.`);
    }
}
function formatPartnerSaveError(error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (/duplicate|unique|already exists|409/i.test(raw))
        return 'A partner with this name or email already exists (database unique rule). Change the values or edit the existing partner.';
    return raw;
}
export default function PartnersPage() {
    const { isAdmin } = useAuth();
    const [partners, setPartners] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [filters, setFilters] = useState({
        query: '',
        status: 'all',
    });
    useEffect(() => {
        fetchPartners();
    }, []);
    const fetchPartners = async () => {
        try {
            setIsLoading(true);
            if (!COLLECTIONS.PARTNERS) {
                throw new Error('Partners collection is not configured. Set NEXT_PUBLIC_APPWRITE_PARTNERS_COLLECTION_ID.');
            }
            const documents = await fetchAllPartnerDocuments();
            setPartners(documents);
        }
        catch (error) {
            toast({
                title: 'Unable to load partners',
                description: error instanceof Error ? error.message : 'Could not fetch partners.',
                variant: 'destructive',
            });
            setPartners([]);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSavePartner = async (data) => {
        try {
            const payload = sanitizePartnerPayload(data);
            const excludePartnerId = documentStableId(selectedPartner);
            await assertNoPartnerDuplicates(payload, { excludeId: excludePartnerId, localPartners: partners });
            if (selectedPartner) {
                const updateId = String(selectedPartner.$id || selectedPartner.documentId || excludePartnerId).trim();
                await databases.updateDocument(DB_ID, COLLECTIONS.PARTNERS, updateId, payload);
                setPartners((prev) => prev.map((p) => (documentStableId(p) === excludePartnerId ? { ...p, ...payload } : p)));
            }
            else {
                const response = await databases.createDocument(DB_ID, COLLECTIONS.PARTNERS, 'unique()', payload);
                setPartners((prev) => [...prev, response]);
            }
            setShowDialog(false);
            setSelectedPartner(null);
            toast({
                title: selectedPartner ? 'Partner updated' : 'Partner added',
                description: selectedPartner ? 'Partner changes were saved.' : 'Partner created successfully.',
            });
        }
        catch (error) {
            toast({
                title: 'Save failed',
                description: formatPartnerSaveError(error),
                variant: 'destructive',
            });
            throw error;
        }
    };
    const confirmDeletePartner = async () => {
        if (!pendingDeleteId)
            return;
        try {
            await databases.deleteDocument(DB_ID, COLLECTIONS.PARTNERS, pendingDeleteId);
            setPartners((prev) => prev.filter((p) => p.$id !== pendingDeleteId));
            toast({
                title: 'Partner deleted',
                description: 'The partner was removed successfully.',
            });
        }
        catch (error) {
            toast({
                title: 'Delete failed',
                description: error instanceof Error ? error.message : 'Could not delete partner.',
                variant: 'destructive',
            });
        }
        finally {
            setPendingDeleteId('');
        }
    };
    const filteredPartners = useMemo(() => {
        return partners.filter((partner) => {
            const q = filters.query.trim().toLowerCase();
            const matchesQuery = !q
                || String(partner.name || '').toLowerCase().includes(q)
                || String(partner.contact_person || '').toLowerCase().includes(q)
                || String(partner.email || '').toLowerCase().includes(q);
            const matchesStatus = filters.status === 'all' || String(partner.status || '').toLowerCase() === filters.status;
            return matchesQuery && matchesStatus;
        });
    }, [partners, filters]);
    return (<div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">{PARTNER_LABELS.moduleTitle}</h1>
          <p className="mt-2 text-gray-600">{PARTNER_LABELS.manageDescription}.</p>
        </div>
        {isAdmin && (<Button className="w-full shrink-0 sm:w-auto" onClick={() => {
                setSelectedPartner(null);
                setShowDialog(true);
            }}>
            <Plus className="mr-2 h-4 w-4"/>
            {PARTNER_LABELS.addButton}
          </Button>)}
      </div>
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Search</Label>
            <Input placeholder="Search by partner name, contact, email..." value={filters.query} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}/>
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
        <PartnerTable partners={filteredPartners} isLoading={isLoading} isAdmin={isAdmin} paginationResetKey={JSON.stringify(filters)} onEdit={isAdmin ? (partner) => {
                setSelectedPartner(partner);
                setShowDialog(true);
            } : undefined} onDelete={isAdmin ? (id) => setPendingDeleteId(id) : undefined}/>
      </Card>
      {isAdmin && (<PartnerDialog open={showDialog} onOpenChange={setShowDialog} partner={selectedPartner} onSave={handleSavePartner}/>)}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => {
            if (!open)
                setPendingDeleteId('');
        }}>
        <AlertDialogContent className="border-[#047857]/25">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Courses referencing this partner may lose partner context.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#ff8829] text-[#b45309] hover:bg-[#fff4eb] hover:text-[#9a3f05]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeletePartner}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
