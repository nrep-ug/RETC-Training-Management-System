'use client';

import { format } from 'date-fns';
import { eventsOnDay, formatEventDateRange, getStatusBarClass } from '@/lib/facility-calendar';

export function FacilityCalendarDay({ dayDate, events = [], onSelectEvent, hideNavigation = false }) {
    const dayEvents = eventsOnDay(events, dayDate);

    return (
        <div className="overflow-hidden rounded-2xl border border-[#047857]/15 bg-white shadow-lg">
            {!hideNavigation && (
                <div className="bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] px-4 py-3">
                    <h2 className="text-lg font-bold text-white">{format(dayDate, 'EEEE, d MMMM yyyy')}</h2>
                </div>
            )}
            <div className="p-4">
                {dayEvents.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No bookings on this day.</p>
                ) : (
                    <ul className="space-y-2">
                        {dayEvents.map((event) => (
                            <li key={event.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelectEvent?.(event)}
                                    className={`w-full rounded-lg px-4 py-3 text-left text-sm shadow-sm ${getStatusBarClass(event.status)} ${event.hasOverlap ? 'ring-2 ring-red-400' : ''}`}
                                >
                                    <p className="font-semibold">{event.title}</p>
                                    <p className="mt-0.5 text-xs capitalize opacity-90">{event.status}</p>
                                    <p className="mt-1 text-xs opacity-90">{formatEventDateRange(event.start, event.end)}</p>
                                    <p className="text-xs opacity-90">{event.trainingPartner}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
