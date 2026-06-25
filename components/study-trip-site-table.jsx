'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Pencil, Trash2, Eye, MapPin, Mail, Phone, User, Layers, Ruler, MapPinned } from 'lucide-react';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { TablePaginationFooter } from '@/components/table-pagination-footer';
import { cn } from '@/lib/utils';
import {
    formatStudyTripSiteSize,
    getStudyTripSiteContactPerson,
    getStudyTripSiteContactPhone,
    getStudyTripSiteLocation,
    getStudyTripSiteName,
} from '@/lib/study-trip-site-fields';

function DetailField({ label, value, icon: Icon, className = '' }) {
    return (
        <div className={cn('flex gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm', className)}>
            {Icon ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#047857]/10 text-[#047857]">
                    <Icon className="h-4 w-4" />
                </div>
            ) : null}
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || '—'}</p>
            </div>
        </div>
    );
}

function StudyTripSiteDetailView({ site }) {
    const siteName = getStudyTripSiteName(site);
    const location = getStudyTripSiteLocation(site);

    return (
        <div className="bg-gradient-to-b from-[#f8faf9] via-white to-white">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#047857] via-[#056b4d] to-[#0b8d68] px-6 pb-8 pt-6 text-white">
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute bottom-0 right-12 h-16 w-16 rounded-full bg-[#ff8829]/20" />
                <div className="relative flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                        <MapPinned className="h-7 w-7 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-widest text-white/75">Study trip site</p>
                        <h3 className="mt-1 text-xl font-bold leading-tight">{siteName || '—'}</h3>
                        {location ? (
                            <p className="mt-2 flex items-start gap-1.5 text-sm text-white/90">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{location}</span>
                            </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                            {site.technology ? (
                                <Badge className="border-0 bg-white/20 text-white hover:bg-white/25">
                                    {site.technology}
                                </Badge>
                            ) : null}
                            {site.type ? (
                                <Badge className="border-0 bg-[#ff8829]/90 text-white hover:bg-[#ff8829]">
                                    {site.type}
                                </Badge>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-5 px-6 py-5">
                <div className="rounded-2xl border border-[#047857]/15 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#047857]">Site profile</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField label="Technology" value={site.technology} icon={Layers} />
                        <DetailField label="Type" value={site.type} icon={MapPinned} />
                        <DetailField
                            label="Size"
                            value={formatStudyTripSiteSize(site.size)}
                            icon={Ruler}
                            className="sm:col-span-2"
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-[#ff8829]/20 bg-gradient-to-br from-white to-[#fff8f3] p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#b45309]">Contact</p>
                    <div className="grid grid-cols-1 gap-3">
                        <DetailField label="Contact person" value={getStudyTripSiteContactPerson(site)} icon={User} />
                        <DetailField label="Email" value={site.email} icon={Mail} />
                        <DetailField label="Phone" value={getStudyTripSiteContactPhone(site)} icon={Phone} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function StudyTripSiteTable({
    sites,
    isLoading,
    isAdmin,
    onEdit,
    onDelete,
    paginationResetKey = '',
}) {
    const [viewSite, setViewSite] = useState(null);
    const pagination = useClientPagination(sites, { resetKey: paginationResetKey });

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[#047857]" />
                <p className="text-gray-600">Loading study trip sites...</p>
            </div>
        );
    }

    if (sites.length === 0) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-600">No study trip sites found. {isAdmin && 'Create one to get started.'}</p>
            </div>
        );
    }

    const { pagedItems, page, setPage, pageSize, setPageSize, total, totalPages, rangeFrom, rangeTo } = pagination;

    return (
        <>
            <div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-gradient-to-br from-white via-white to-[#047857]/[0.03] shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px]">
                        <thead className="border-b border-[#047857]/15 bg-gradient-to-r from-[#047857]/10 via-[#047857]/5 to-[#ff8829]/10">
                            <tr>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Site name</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Location</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Technology</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Type</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Size</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Contact person</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Email</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Phone</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#1f2937] sm:px-6 sm:py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#047857]/10">
                            {pagedItems.map((site) => (
                                <tr key={site.$id} className="transition-colors hover:bg-gradient-to-r hover:from-[#047857]/[0.04] hover:to-[#ff8829]/[0.06]">
                                    <td className="px-3 py-3 text-sm font-medium text-gray-900 sm:px-6 sm:py-4">{getStudyTripSiteName(site)}</td>
                                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{getStudyTripSiteLocation(site) || '—'}</td>
                                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{site.technology || '—'}</td>
                                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{site.type || '—'}</td>
                                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{formatStudyTripSiteSize(site.size)}</td>
                                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{getStudyTripSiteContactPerson(site)}</td>
                                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{site.email || '—'}</td>
                                    <td className="px-3 py-3 text-sm text-gray-600 sm:px-6 sm:py-4">{getStudyTripSiteContactPhone(site) || '—'}</td>
                                    <td className="space-x-2 px-3 py-3 text-sm sm:px-6 sm:py-4">
                                        <Button size="sm" variant="outline" onClick={() => setViewSite(site)} aria-label="View site">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {isAdmin && (
                                            <>
                                                <Button size="sm" variant="outline" onClick={() => onEdit?.(site)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-600 hover:text-red-700"
                                                    onClick={() => onDelete?.(site.$id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
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
            </div>

            <Dialog open={!!viewSite} onOpenChange={(open) => { if (!open) setViewSite(null); }}>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden border-[#047857]/20 p-0 shadow-xl">
                    {viewSite ? <StudyTripSiteDetailView site={viewSite} /> : null}
                </DialogContent>
            </Dialog>
        </>
    );
}
