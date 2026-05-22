'use client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { TablePaginationFooter } from '@/components/table-pagination-footer';
export function PartnerTable({ partners, isLoading, isAdmin, onEdit, onDelete, paginationResetKey = '', }) {
    const pagination = useClientPagination(partners, { resetKey: paginationResetKey });
    if (isLoading) {
        return (<div className="p-8 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[#047857]"></div>
        <p className="text-gray-600">Loading partners...</p>
      </div>);
    }
    if (partners.length === 0) {
        return (<div className="p-8 text-center">
        <p className="text-gray-600">No partners found. {isAdmin && 'Create one to get started.'}</p>
      </div>);
    }
    const { pagedItems, page, setPage, pageSize, setPageSize, total, totalPages, rangeFrom, rangeTo, } = pagination;
    return (<div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-gradient-to-br from-white via-white to-[#047857]/[0.03] shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857]/10 via-[#047857]/5 to-[#ff8829]/10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Partner Name</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Contact Person</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Email</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Phone</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Status</th>
            {isAdmin && <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#047857]/10">
          {pagedItems.map((partner) => (<tr key={partner.$id} className="transition-colors hover:bg-gradient-to-r hover:from-[#047857]/[0.04] hover:to-[#ff8829]/[0.06]">
              <td className="px-3 py-3 text-sm font-medium text-gray-900 sm:px-6 sm:py-4">{partner.name}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{partner.contact_person || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{partner.email || '-'}</td>
              <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{partner.phone || '-'}</td>
              <td className="px-3 py-3 text-sm sm:px-6 sm:py-4">
                <Badge variant={partner.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {partner.status || 'inactive'}
                </Badge>
              </td>
              {isAdmin && (<td className="space-x-2 px-3 py-3 text-sm sm:px-6 sm:py-4">
                  <Button size="sm" variant="outline" onClick={() => onEdit?.(partner)}>
                    <Pencil className="h-4 w-4"/>
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => onDelete?.(partner.$id)}>
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
