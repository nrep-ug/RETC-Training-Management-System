'use client';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { TablePaginationFooter } from '@/components/table-pagination-footer';
function normalizeTraineeStatus(status) {
    return String(status || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}
/** Conventional status colors (success=green, info=blue, warning=amber, danger=red). Uses plain span to avoid Badge variant overriding backgrounds. */
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
export function TraineeTable({ trainees, isLoading, onEdit, onDelete, isAdmin, programMap = {}, paginationResetKey = '', }) {
    const pagination = useClientPagination(trainees, { resetKey: paginationResetKey });
    const getStatusLabel = (status) => {
        const normalized = normalizeTraineeStatus(status);
        if (normalized === 'in_progress' || normalized === 'active')
            return 'In Progress';
        if (normalized === 'enrolled')
            return 'Enrolled';
        if (normalized === 'completed' || normalized === 'complete')
            return 'Completed';
        if (normalized === 'dropped' || normalized === 'withdrawn')
            return 'Dropped';
        if (normalized === 'failed')
            return 'Failed';
        if (normalized === 'cancelled' || normalized === 'canceled')
            return 'Cancelled';
        if (normalized === 'pending')
            return 'Pending';
        if (normalized === 'upcoming')
            return 'Upcoming';
        if (normalized === 'on_hold' || normalized === 'onhold')
            return 'On Hold';
        return status || '-';
    };
    if (isLoading) {
        return (<div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading trainees...</p>
      </div>);
    }
    if (trainees.length === 0) {
        return (<div className="p-8 text-center">
        <p className="text-gray-600">No trainees found. {isAdmin && 'Create one to get started.'}</p>
      </div>);
    }
    const { pagedItems, page, setPage, pageSize, setPageSize, total, totalPages, rangeFrom, rangeTo, } = pagination;
    return (<div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-gradient-to-br from-white via-white to-[#047857]/[0.03] shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857]/10 via-[#047857]/5 to-[#ff8829]/10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Name</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Email</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Phone</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Gender</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">District</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Program</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Status</th>
            {isAdmin && <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#047857]/10">
          {pagedItems.map((trainee) => (<tr key={trainee.$id} className="transition-colors hover:bg-gradient-to-r hover:from-[#047857]/[0.04] hover:to-[#ff8829]/[0.06]">
              <td className="px-3 py-3 text-sm font-medium text-gray-900 sm:px-6 sm:py-4">{trainee.name}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{trainee.email}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{trainee.phone || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{trainee.gender || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{trainee.district || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{trainee.program_name || programMap[trainee.program_id] || '-'}</td>
              <td className="px-3 py-3 text-sm sm:px-6 sm:py-4">
                <span role="status" className={cn('inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', getStatusBadgeStyles(trainee.status))}>
                  {getStatusLabel(trainee.status)}
                </span>
              </td>
              {isAdmin && (<td className="space-x-2 px-3 py-3 text-sm sm:px-6 sm:py-4">
                  <Button size="sm" variant="outline" onClick={() => onEdit?.(trainee)}>
                    <Pencil className="h-4 w-4"/>
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => onDelete?.(trainee.$id)}>
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </td>)}
            </tr>))}
        </tbody>
      </table>
      </div>
      <TablePaginationFooter total={total} page={page} pageSize={pageSize} totalPages={totalPages} rangeFrom={rangeFrom} rangeTo={rangeTo} onPageChange={setPage} onPageSizeChange={setPageSize}/>
    </div>);
}
