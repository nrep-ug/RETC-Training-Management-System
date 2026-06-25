'use client';
/**
 * Navigation panel rendered inside the layout’s single <aside>. Root is a <div role="complementary"> so we don’t nest two asides.
 */
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, UserRoundCog, BookOpen, BarChart3, FileText, CalendarDays, MapPinned, } from 'lucide-react';
import { Handshake } from 'lucide-react';
export function Sidebar({ onNavigate, className }) {
    const pathname = usePathname();
    const { isAdmin } = useAuth();
    const navItems = [
        {
            label: 'Dashboard',
            href: isAdmin ? '/dashboard/admin' : '/dashboard/manager',
            icon: LayoutDashboard,
            visible: true,
        },
        {
            label: 'Trainees',
            href: '/dashboard/trainees',
            icon: Users,
            visible: true,
        },
        {
            label: 'Courses',
            href: '/dashboard/programs',
            icon: BookOpen,
            visible: true,
        },
        {
            label: 'Facility calendar',
            href: '/dashboard/facility-calendar',
            icon: CalendarDays,
            visible: true,
        },
        {
            label: 'Partners',
            href: '/dashboard/partners',
            icon: Handshake,
            visible: true,
        },
        {
            label: 'RETC Facilitators',
            href: '/dashboard/trainers',
            icon: UserRoundCog,
            visible: true,
        },
        {
            label: 'Study Trip Sites',
            href: '/dashboard/study-trip-sites',
            icon: MapPinned,
            visible: true,
        },
        {
            label: 'Analytics',
            href: '/dashboard/analytics',
            icon: BarChart3,
            visible: true,
        },
        {
            label: 'Reports',
            href: '/dashboard/reports',
            icon: FileText,
            visible: true,
        },
    ];
    const visibleItems = navItems.filter(item => item.visible);
    return (<div role="complementary" aria-label="Main navigation" className={cn('flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#047857] p-5 text-white sm:p-6', className)}>
      <div className="mb-6 shrink-0">
        <Link href={isAdmin ? '/dashboard/admin' : '/dashboard/manager'} className="flex items-center gap-3" onClick={() => onNavigate?.()}>
          <Image src="/logo.png" alt="RETC Logo" width={42} height={42} />
          <span className="text-xl font-bold">RETC</span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 pb-4">
        {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (<Link key={item.href} href={item.href} onClick={() => onNavigate?.()} className={cn('flex items-center gap-3 rounded-xl px-4 py-3 transition-colors sm:py-3.5', isActive
                    ? 'bg-[#ff8829] text-white'
                    : 'text-white/85 hover:bg-white/15')}>
              <Icon className="h-5 w-5 shrink-0"/>
              <span className="font-medium">{item.label}</span>
            </Link>);
        })}
      </nav>

      <div className="shrink-0 border-t border-white/25 pt-4 text-center text-xs text-white/80">
        <p>RETC Training Management System</p>
      </div>
    </div>);
}
