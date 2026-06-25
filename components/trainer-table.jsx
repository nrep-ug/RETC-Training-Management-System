'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Eye, FileText, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { TablePaginationFooter } from '@/components/table-pagination-footer';
import { getRetcFacilitatorRoleLabel, RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import { formatSpecializationsDisplay } from '@/lib/trainer-specializations';
import { formatTechnologySelectionsDisplay } from '@/lib/trainer-technologies';
import {
    downloadFacilitatorDocument,
    getTrainerCvFileId,
    getTrainerCvFileName,
    openFacilitatorDocument,
} from '@/lib/trainer-documents';
import {
    getTrainerOptionalEmail,
    getTrainerOptionalPhone,
    TRAINER_OPTIONAL_EMAIL_KEY,
    TRAINER_OPTIONAL_PHONE_KEY,
} from '@/lib/trainer-contact-fields';

function getTrainerPartnerName(trainer) {
    return trainer.training_partner
        || trainer.trainingPartner
        || trainer['training-partners']
        || trainer.training_partners
        || trainer.organization
        || '';
}

function DetailField({ label, value, className = '' }) {
    return (
        <div className={cn('rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5', className)}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</p>
        </div>
    );
}

function TrainerCvPanel({ trainer, isAdmin, onDeleteCv, onTrainerChange }) {
    const cvFileId = getTrainerCvFileId(trainer);
    const cvFileName = getTrainerCvFileName(trainer) || 'Curriculum vitae';
    const [busyAction, setBusyAction] = useState('');
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    const runAction = async (action, fn) => {
        setBusyAction(action);
        setError('');
        try {
            await fn();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Action failed.');
        }
        finally {
            setBusyAction('');
        }
    };

    const handleView = () => runAction('view', () => openFacilitatorDocument(cvFileId));
    const handleDownload = () => runAction('download', () => downloadFacilitatorDocument(cvFileId, cvFileName));
    const handleDelete = async () => {
        setBusyAction('delete');
        setError('');
        try {
            const updated = await onDeleteCv?.(trainer);
            if (updated)
                onTrainerChange?.(updated);
            setConfirmDelete(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete CV.');
        }
        finally {
            setBusyAction('');
        }
    };

    return (
        <div className="rounded-xl border border-[#047857]/15 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#047857]">CV</p>
            {cvFileId ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#047857]/15">
                            <FileText className="h-5 w-5 text-[#047857]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{cvFileName}</p>
                            <p className="text-xs text-slate-500">Uploaded document</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={handleView} disabled={Boolean(busyAction)}>
                            {busyAction === 'view' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                            View
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={handleDownload} disabled={Boolean(busyAction)}>
                            {busyAction === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download
                        </Button>
                        {isAdmin && onDeleteCv ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setConfirmDelete(true)}
                                disabled={Boolean(busyAction)}
                            >
                                {busyAction === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Delete
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    No CV uploaded for this facilitator.
                </p>
            )}
            {error ? (
                <p className="mt-2 text-sm text-red-600">{error}</p>
            ) : null}

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent className="border-[#047857]/25">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete CV?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the CV file from storage. You can upload a new one when editing the facilitator.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busyAction === 'delete'}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            disabled={busyAction === 'delete'}
                            onClick={(e) => {
                                e.preventDefault();
                                void handleDelete();
                            }}
                        >
                            Delete CV
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function TrainerDetailView({ trainer, isAdmin, onDeleteCv, onTrainerChange }) {
    const partner = getTrainerPartnerName(trainer);
    const specializations = formatSpecializationsDisplay(trainer);
    const technologies = formatTechnologySelectionsDisplay(trainer);

    return (
        <div className="space-y-5 bg-gradient-to-b from-white via-white to-[#f7faf8] px-6 py-5">
            <div className="rounded-xl border border-[#047857]/20 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {RETC_FACILITATOR_LABELS.moduleSingular}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{trainer.name || '—'}</h3>
                        <p className="mt-1 text-sm text-slate-600">{getRetcFacilitatorRoleLabel(trainer.role)}</p>
                    </div>
                    <Badge
                        variant={trainer.status === 'active' ? 'default' : 'secondary'}
                        className="shrink-0 capitalize"
                    >
                        {trainer.status || '—'}
                    </Badge>
                </div>
            </div>

            <div className="rounded-xl border border-[#047857]/15 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#047857]">Contact</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailField label="Primary email" value={trainer.email} />
                    <DetailField label="Additional email" value={trainer[TRAINER_OPTIONAL_EMAIL_KEY] || getTrainerOptionalEmail(trainer)} />
                    <DetailField label="Primary phone" value={trainer.phone} />
                    <DetailField label="Additional contact" value={getTrainerOptionalPhone(trainer)} />
                </div>
            </div>

            <TrainerCvPanel
                trainer={trainer}
                isAdmin={isAdmin}
                onDeleteCv={onDeleteCv}
                onTrainerChange={onTrainerChange}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#ff8829]/25 bg-white p-4 shadow-sm sm:col-span-2">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#b45309]">Professional profile</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField label="Training partner" value={partner} />
                        <DetailField label="Years of experience" value={trainer.years_of_experience} />
                        <DetailField label="Categories" value={specializations} className="sm:col-span-2" />
                        <DetailField label="Technologies" value={technologies} className="sm:col-span-2" />
                    </div>
                </div>
                <DetailField label="Record ID" value={trainer.$id} className="font-mono text-xs sm:col-span-2" />
            </div>
        </div>
    );
}

export function TrainerTable({ trainers, isLoading, onEdit, onDelete, onDeleteCv, isAdmin, paginationResetKey = '', }) {
    const [viewTrainer, setViewTrainer] = useState(null);
    const pagination = useClientPagination(trainers, { resetKey: paginationResetKey });
    if (isLoading) {
        return (<div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#047857] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading {RETC_FACILITATOR_LABELS.modulePlural}...</p>
      </div>);
    }
    if (trainers.length === 0) {
        return (<div className="p-8 text-center">
        <p className="text-gray-600">No {RETC_FACILITATOR_LABELS.modulePlural} found. {isAdmin && 'Create one to get started.'}</p>
      </div>);
    }
    const { pagedItems, page, setPage, pageSize, setPageSize, total, totalPages, rangeFrom, rangeTo, } = pagination;
    return (<div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-gradient-to-br from-white via-white to-[#047857]/[0.03] shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857]/10 via-[#047857]/5 to-[#ff8829]/10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Name</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Experience</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Categories</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Partner</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Role</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#047857]/10">
          {pagedItems.map((trainer) => (<tr key={trainer.$id} className="transition-colors hover:bg-gradient-to-r hover:from-[#047857]/[0.04] hover:to-[#ff8829]/[0.06]">
              <td className="px-3 py-3 text-sm font-medium text-gray-900 sm:px-4 sm:py-4">{trainer.name}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{trainer.years_of_experience ?? '—'}</td>
              <td className="max-w-[200px] truncate px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4" title={formatSpecializationsDisplay(trainer)}>
                {formatSpecializationsDisplay(trainer) || '—'}
              </td>
              <td className="max-w-[160px] truncate px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4" title={getTrainerPartnerName(trainer)}>
                {getTrainerPartnerName(trainer) || '—'}
              </td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{getRetcFacilitatorRoleLabel(trainer.role)}</td>
              <td className="px-3 py-3 text-sm sm:px-4 sm:py-4">
                <Badge variant={trainer.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {trainer.status}
                </Badge>
              </td>
              <td className="space-x-2 px-3 py-3 text-sm sm:px-4 sm:py-4">
                  <Button size="sm" variant="outline" onClick={() => setViewTrainer(trainer)} title="View full details">
                    <Eye className="h-4 w-4"/>
                  </Button>
                  {isAdmin && (<>
                  <Button size="sm" variant="outline" onClick={() => onEdit?.(trainer)} title="Edit">
                    <Pencil className="h-4 w-4"/>
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => onDelete?.(trainer.$id)} title="Delete">
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                  </>)}
                </td>
            </tr>))}
        </tbody>
      </table>
      </div>
      <TablePaginationFooter total={total} page={page} pageSize={pageSize} totalPages={totalPages} rangeFrom={rangeFrom} rangeTo={rangeTo} onPageChange={setPage} onPageSizeChange={setPageSize}/>

      <Dialog
        open={!!viewTrainer}
        onOpenChange={(open) => {
            if (!open)
                setViewTrainer(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto border-[#047857]/25 p-0 sm:w-full">
          <DialogHeader className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white">
              {RETC_FACILITATOR_LABELS.moduleSingular} profile
            </DialogTitle>
          </DialogHeader>
          {viewTrainer && (
            <TrainerDetailView
                trainer={viewTrainer}
                isAdmin={isAdmin}
                onDeleteCv={onDeleteCv}
                onTrainerChange={setViewTrainer}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>);
}
