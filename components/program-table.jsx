'use client';
import { useState } from 'react';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { TablePaginationFooter } from '@/components/table-pagination-footer';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { getCourseLabel } from '@/lib/renewable-energy-courses';
import { RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
function getTrainingPartnerDisplay(program) {
    const raw = program.training_partner
        || program.trainingPartner
        || program['training-partners']
        || program.training_partners;
    if (typeof raw === 'string' && String(raw).trim())
        return String(raw).trim();
    if (raw && typeof raw === 'object') {
        return String(raw.name || raw.title || '').trim() || '-';
    }
    return '-';
}
function getTrainerId(program) {
    if (!program)
        return '';
    const v = program.trainer_id
        || program.trainerId
        || program.lead_trainer_id
        || program.leadTrainerId
        || program.trainer;
    if (!v)
        return '';
    if (typeof v === 'string')
        return v.trim();
    if (typeof v === 'object')
        return String(v.$id || v.documentId || v.id || '').trim();
    return '';
}
function getOtherPartnersLabel(program, partnersList = []) {
    const names = Array.isArray(program.partner_names) ? program.partner_names.filter(Boolean) : [];
    if (names.length > 0)
        return names.join(', ');
    const mainId = String(program.training_partner_id || program.trainingPartnerId || '').trim();
    const ids = Array.isArray(program.partner_ids) ? program.partner_ids : [];
    if (ids.length === 0)
        return '—';
    const lookup = new Map();
    partnersList.forEach((p) => {
        const label = String(p.name || p.email || p.$id || '').trim();
        const id = String(p.$id || '').trim();
        if (id)
            lookup.set(id, label);
        const docId = String(p.documentId || '').trim();
        if (docId)
            lookup.set(docId, label);
    });
    const resolved = ids
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== mainId)
        .map((id) => lookup.get(id) || id);
    return resolved.length > 0 ? resolved.join(', ') : '—';
}
function getTrainingPeriodWeeks(program) {
    const start = program.start_date ? new Date(program.start_date) : null;
    const end = program.end_date ? new Date(program.end_date) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return '-';
    }
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0)
        return '-';
    return String(Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))));
}
export function ProgramTable({ programs, isLoading, onEdit, onDelete, isAdmin, partners = [], trainerMap = {}, paginationResetKey = '', }) {
    const [viewProgram, setViewProgram] = useState(null);
    const pagination = useClientPagination(programs, { resetKey: paginationResetKey });
    if (isLoading) {
        return (<div className="p-8 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[#047857]"></div>
        <p className="text-gray-600">{COURSE_MODULE_LABELS.loading}</p>
      </div>);
    }
    if (programs.length === 0) {
        return (<div className="p-8 text-center">
        <p className="text-gray-600">{COURSE_MODULE_LABELS.empty} {isAdmin && 'Create one to get started.'}</p>
      </div>);
    }
    const { pagedItems, page, setPage, pageSize, setPageSize, total, totalPages, rangeFrom, rangeTo, } = pagination;
    const getStatusColor = (status) => {
        switch (status) {
            case 'upcoming':
                return 'secondary';
            case 'ongoing':
                return 'default';
            case 'completed':
                return 'outline';
            default:
                return 'secondary';
        }
    };
    return (<div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-gradient-to-br from-white via-white to-[#047857]/[0.03] shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[680px]">
        <thead className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857]/10 via-[#047857]/5 to-[#ff8829]/10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">{COURSE_MODULE_LABELS.titleField}</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">{COURSE_MODULE_LABELS.categoryFilterLabel}</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Partner</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Location</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Start Date</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Training Period (Weeks)</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#047857]/10">
          {pagedItems.map((program) => (<tr key={program.$id} className="transition-colors hover:bg-gradient-to-r hover:from-[#047857]/[0.04] hover:to-[#ff8829]/[0.06]">
              <td className="px-3 py-3 text-sm font-medium text-gray-900 sm:px-6 sm:py-4">{program.title}</td>
              <td className="max-w-[160px] truncate px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4" title={program.course_label || getCourseLabel(program.course)}>
                {program.course_label || getCourseLabel(program.course)}
              </td>
              <td className="max-w-[200px] truncate px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4" title={getTrainingPartnerDisplay(program)}>
                {getTrainingPartnerDisplay(program)}
              </td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{program.training_location || program.trainingLocation || program.location || program.venue || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">
                {program.start_date ? format(new Date(program.start_date), 'MMM dd, yyyy') : '-'}
              </td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{getTrainingPeriodWeeks(program)}</td>
              <td className="px-3 py-3 text-sm sm:px-6 sm:py-4">
                <Badge variant={getStatusColor(program.status)} className="capitalize">
                  {program.status}
                </Badge>
              </td>
              <td className="space-x-2 px-3 py-3 text-sm sm:px-6 sm:py-4">
                  <Button size="sm" variant="outline" onClick={() => setViewProgram(program)}>
                    <Eye className="h-4 w-4"/>
                  </Button>
                  {isAdmin && (<>
                  <Button size="sm" variant="outline" onClick={() => onEdit?.(program)}>
                    <Pencil className="h-4 w-4"/>
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => onDelete?.(program.$id)}>
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </>)}
                </td>
            </tr>))}
        </tbody>
      </table>
      </div>
      <TablePaginationFooter total={total} page={page} pageSize={pageSize} totalPages={totalPages} rangeFrom={rangeFrom} rangeTo={rangeTo} onPageChange={setPage} onPageSizeChange={setPageSize}/>
      <Dialog open={!!viewProgram} onOpenChange={(open) => {
            if (!open)
                setViewProgram(null);
        }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto border-[#047857]/25 p-0 sm:w-full">
          <DialogHeader className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white">{COURSE_MODULE_LABELS.detailsTitle}</DialogTitle>
          </DialogHeader>
          {viewProgram && (<div className="space-y-5 bg-gradient-to-b from-white via-white to-[#f7faf8] px-6 py-5">
              <div className="rounded-xl border border-[#047857]/20 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{viewProgram.title || COURSE_MODULE_LABELS.untitled}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${String(viewProgram.status || '').toLowerCase() === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : String(viewProgram.status || '').toLowerCase() === 'ongoing'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-slate-100 text-slate-700'}`}>
                    {viewProgram.status || '-'}
                  </span>
                </div>
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{COURSE_MODULE_LABELS.categoryFieldLabel}</p>
                  <p className="mt-1 font-semibold text-slate-800">{viewProgram.course_label || getCourseLabel(viewProgram.course)}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Start Date</p>
                    <p className="mt-1 font-semibold text-slate-800">{viewProgram.start_date ? format(new Date(viewProgram.start_date), 'MMM dd, yyyy') : '-'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Training Period</p>
                    <p className="mt-1 font-semibold text-slate-800">{getTrainingPeriodWeeks(viewProgram)} weeks</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Capacity</p>
                    <p className="mt-1 font-semibold text-slate-800">{viewProgram.max_capacity ?? '-'}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Training Location</p>
                  <p className="mt-1 font-semibold text-slate-800">{viewProgram.training_location || viewProgram.trainingLocation || viewProgram.location || viewProgram.venue || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#047857]/15 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#047857]">Partner Details</p>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold text-slate-700">Partner:</span> {getTrainingPartnerDisplay(viewProgram)}</div>
                    <div><span className="font-semibold text-slate-700">Other partners:</span> {getOtherPartnersLabel(viewProgram, partners)}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-[#ff8829]/25 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#b45309]">Delivery Details</p>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold text-slate-700">{RETC_FACILITATOR_LABELS.leadOnCourse}:</span> {(() => {
                        const tid = getTrainerId(viewProgram);
                        const name = String(viewProgram.trainer_name || '').trim() || (tid ? trainerMap[tid] : '') || '';
                        return name || '—';
                    })()}</div>
                    <div><span className="font-semibold text-slate-700">Course ID:</span> {viewProgram.$id || '-'}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Description</p>
                <p className="text-sm leading-relaxed text-slate-700 break-words">{viewProgram.description || '-'}</p>
              </div>
            </div>)}
        </DialogContent>
      </Dialog>
    </div>);
}
