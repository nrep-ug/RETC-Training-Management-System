'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { getTraineeLevelLabel } from '@/lib/trainee-levels';
import { TraineeLevelBadge } from '@/components/trainee-level-badge';
import { getTraineeStatusLabel, isConsentGiven, normalizeTraineeStatus } from '@/lib/types';
import { getTraineeLevelForProgram, getTraineeStatusForProgram } from '@/lib/trainee-enrollment';
import { TablePaginationFooter } from '@/components/table-pagination-footer';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';

function getStatusBadgeStyles(status) {
    const key = normalizeTraineeStatus(status);
    switch (key) {
        case 'completed':
        case 'complete':
            return 'border-transparent bg-emerald-600 text-white shadow-sm';
        case 'in_progress':
        case 'active':
            return 'border-transparent bg-blue-600 text-white shadow-sm';
        case 'enrolled':
            return 'border-transparent bg-sky-500 text-white shadow-sm';
        case 'dropped':
        case 'failed':
        case 'cancelled':
        case 'canceled':
        case 'withdrawn':
            return 'border-transparent bg-red-600 text-white shadow-sm';
        case 'pending':
        case 'on_hold':
        case 'onhold':
            return 'border border-amber-300 bg-amber-100 text-amber-950 shadow-sm';
        case 'upcoming':
            return 'border-transparent bg-violet-600 text-white shadow-sm';
        default:
            return 'border border-slate-300 bg-slate-100 text-slate-800 shadow-sm';
    }
}

function getCertificationLabel(status) {
    const normalized = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized === 'certified')
        return 'Certified';
    if (normalized === 'not_certified' || normalized === 'not-certified')
        return 'Not Certified';
    if (normalized === 'pending')
        return 'Pending';
    return '—';
}

function formatDisplayDate(value) {
    if (!value)
        return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return String(value);
    return format(d, 'MMM dd, yyyy');
}

function DetailField({ label, value, className = '' }) {
    return (
        <div className={cn('rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5', className)}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</p>
        </div>
    );
}

function formatCourseList(trainee, programMap) {
    if (trainee.program_name)
        return trainee.program_name;
    const ids = Array.isArray(trainee.program_ids) ? trainee.program_ids : [trainee.program_id].filter(Boolean);
    const names = ids.map((id) => programMap[id] || id).filter(Boolean);
    return names.length > 0 ? names.join(', ') : '—';
}

function TraineeDetailView({ trainee, programMap, courseMap, programFilterId = 'all' }) {
    const levelKey = getTraineeLevelForProgram(trainee, programFilterId);
    const displayStatus = getTraineeStatusForProgram(trainee, programFilterId);
    const courseName = formatCourseList(trainee, programMap);
    const categoryLabel = (Array.isArray(trainee.program_ids) ? trainee.program_ids : [trainee.program_id])
        .map((id) => courseMap[id])
        .filter(Boolean)
        .join(', ') || trainee.course_label || '—';
    const consentGiven = isConsentGiven(trainee.consent_given);
    return (
        <div className="space-y-5 bg-gradient-to-b from-white via-white to-[#f7faf8] px-6 py-5">
            <div className="rounded-xl border border-[#047857]/20 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Participant</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{trainee.name || '—'}</h3>
                        {trainee.email && (
                            <p className="mt-1 truncate text-sm text-slate-600">{trainee.email}</p>
                        )}
                    </div>
                    <span
                        role="status"
                        className={cn(
                            'inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold capitalize',
                            getStatusBadgeStyles(displayStatus),
                        )}
                    >
                        {getTraineeStatusLabel(displayStatus)}
                    </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <TraineeLevelBadge trainee={trainee} levelKey={levelKey} className="px-3 py-1" />
                    <span className="rounded-full bg-[#ff8829]/15 px-3 py-1 text-xs font-semibold text-[#b45309]">
                        {getCertificationLabel(trainee.certification_status || trainee.certificationStatus)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#047857]/15 bg-white p-4 shadow-sm sm:col-span-2">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#047857]">Contact</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <DetailField label="Phone" value={trainee.phone} />
                        <DetailField label="Gender" value={trainee.gender} />
                        <DetailField label="District" value={trainee.district} />
                    </div>
                </div>

                <div className="rounded-xl border border-[#ff8829]/25 bg-white p-4 shadow-sm sm:col-span-2">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#b45309]">Training</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField
                            label={COURSE_MODULE_LABELS.enrollmentLabel}
                            value={courseName}
                            className="sm:col-span-2"
                        />
                        {Array.isArray(trainee.enrollments) && trainee.enrollments.length > 1 && (
                            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Course history</p>
                                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                    {trainee.enrollments.map((e) => (
                                        <li key={`${e.programId}-${e.enrollmentId}`}>
                                            {programMap[e.programId] || e.programId}
                                            {e.status ? ` — ${getTraineeStatusLabel(e.status)}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <DetailField label={COURSE_MODULE_LABELS.categoryFieldLabel} value={categoryLabel} />
                        <DetailField label={RETC_FACILITATOR_LABELS.traineesTrainerLabel} value={trainee.trainer_name} />
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Level</p>
                            <div className="mt-2">
                                <TraineeLevelBadge trainee={trainee} levelKey={levelKey} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Education</p>
                    <DetailField label="Qualification" value={trainee.qualification} />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Emergency contact</p>
                    <div className="grid grid-cols-1 gap-3">
                        <DetailField label="Next of kin" value={trainee.next_of_kin_name} />
                        <DetailField label="Kin phone" value={trainee.next_of_kin_phone} />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Consent & record</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField label="Data consent" value={consentGiven ? 'Consent given' : 'Not recorded'} />
                        <DetailField label="Consent date" value={consentGiven ? formatDisplayDate(trainee.consent_date) : '—'} />
                        <DetailField label="Record ID" value={trainee.$id} className="font-mono text-xs sm:col-span-2" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function TraineeTable({
    trainees,
    isLoading,
    onEdit,
    onDelete,
    isAdmin,
    programFilterId = 'all',
    programMap = {},
    courseMap = {},
    paginationResetKey = '',
}) {
    const [viewTrainee, setViewTrainee] = useState(null);
    const pagination = useClientPagination(trainees, { resetKey: paginationResetKey });

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[#047857]" />
                <p className="text-gray-600">Loading trainees...</p>
            </div>
        );
    }

    if (trainees.length === 0) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-600">No trainees found. {isAdmin && 'Create one to get started.'}</p>
            </div>
        );
    }

    const { pagedItems, page, setPage, pageSize, setPageSize, total, totalPages, rangeFrom, rangeTo } = pagination;

    return (
        <div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-gradient-to-br from-white via-white to-[#047857]/[0.03] shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                    <thead className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857]/10 via-[#047857]/5 to-[#ff8829]/10">
                        <tr>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">
                                Name
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">
                                {COURSE_MODULE_LABELS.enrollmentLabel}
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">
                                Level
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">
                                Status
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#047857]/10">
                        {pagedItems.map((trainee) => {
                            const courseName = formatCourseList(trainee, programMap);
                            const displayStatus = getTraineeStatusForProgram(trainee, programFilterId);
                            const displayLevel = getTraineeLevelForProgram(trainee, programFilterId);
                            return (
                                <tr
                                    key={trainee.$id}
                                    className="transition-colors hover:bg-gradient-to-r hover:from-[#047857]/[0.04] hover:to-[#ff8829]/[0.06]"
                                >
                                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                                        <p className="text-sm font-medium text-gray-900">{trainee.name}</p>
                                        {trainee.email && (
                                            <p className="mt-0.5 truncate text-xs text-gray-500">{trainee.email}</p>
                                        )}
                                    </td>
                                    <td
                                        className="max-w-[220px] truncate px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4"
                                        title={courseName}
                                    >
                                        {courseName}
                                    </td>
                                    <td className="px-3 py-3 text-sm sm:px-6 sm:py-4">
                                        <TraineeLevelBadge levelKey={displayLevel} label={getTraineeLevelLabel(displayLevel)} />
                                    </td>
                                    <td className="px-3 py-3 text-sm sm:px-6 sm:py-4">
                                        <span
                                            role="status"
                                            className={cn(
                                                'inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                                                getStatusBadgeStyles(displayStatus),
                                            )}
                                        >
                                            {getTraineeStatusLabel(displayStatus)}
                                        </span>
                                    </td>
                                    <td className="space-x-2 px-3 py-3 text-sm sm:px-6 sm:py-4">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setViewTrainee(trainee)}
                                            title="View full details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {isAdmin && (
                                            <>
                                                <Button size="sm" variant="outline" onClick={() => onEdit?.(trainee)} title="Edit">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-600 hover:text-red-700"
                                                    onClick={() => onDelete?.(trainee)}
                                                    title="Remove or delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <TablePaginationFooter
                total={total}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                rangeFrom={rangeFrom}
                rangeTo={rangeTo}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
            />

            <Dialog
                open={!!viewTrainee}
                onOpenChange={(open) => {
                    if (!open)
                        setViewTrainee(null);
                }}
            >
                <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto border-[#047857]/25 p-0 sm:w-full">
                    <DialogHeader className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] px-6 py-4">
                        <DialogTitle className="text-xl font-bold text-white">Trainee profile</DialogTitle>
                    </DialogHeader>
                    {viewTrainee && (
                        <TraineeDetailView trainee={viewTrainee} programMap={programMap} courseMap={courseMap} programFilterId={programFilterId} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
