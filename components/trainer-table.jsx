'use client';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { TablePaginationFooter } from '@/components/table-pagination-footer';
import { getRetcFacilitatorRoleLabel, RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import { formatSpecializationsDisplay } from '@/lib/trainer-specializations';
export function TrainerTable({ trainers, isLoading, onEdit, onDelete, isAdmin, paginationResetKey = '', }) {
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
      <table className="w-full min-w-[900px]">
        <thead className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857]/10 via-[#047857]/5 to-[#ff8829]/10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Name</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Experience</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Specialization</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Partner</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Role</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Email</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Phone</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Status</th>
            {isAdmin && <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-4 sm:py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#047857]/10">
          {pagedItems.map((trainer) => (<tr key={trainer.$id} className="transition-colors hover:bg-gradient-to-r hover:from-[#047857]/[0.04] hover:to-[#ff8829]/[0.06]">
              <td className="px-3 py-3 text-sm font-medium text-gray-900 sm:px-4 sm:py-4">{trainer.name}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{trainer.years_of_experience}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{formatSpecializationsDisplay(trainer) || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{trainer.training_partner || trainer.trainingPartner || trainer['training-partners'] || trainer.training_partners || trainer.organization || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{getRetcFacilitatorRoleLabel(trainer.role)}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{trainer.email || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-4 sm:py-4">{trainer.phone || '-'}</td>
              <td className="px-3 py-3 text-sm sm:px-4 sm:py-4">
                <Badge variant={trainer.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {trainer.status}
                </Badge>
              </td>
              {isAdmin && (<td className="space-x-2 px-3 py-3 text-sm sm:px-4 sm:py-4">
                  <Button size="sm" variant="outline" onClick={() => onEdit?.(trainer)}>
                    <Pencil className="h-4 w-4"/>
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => onDelete?.(trainer.$id)}>
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
