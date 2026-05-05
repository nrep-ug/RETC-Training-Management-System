'use client';
/**
 * Authenticated shell: desktop = sticky sidebar column + scrolling main; mobile = sidebar in a Sheet drawer.
 * Sidebar root lives here as the only <aside>; inner panel is a <div> (see Sidebar) to avoid nested asides.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
export default function DashboardLayout({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    // Close the mobile drawer after navigation so the next screen is not covered by the sheet.
    useEffect(() => {
        setMobileNavOpen(false);
    }, [pathname]);
    if (isLoading) {
        return (<div className="flex min-h-[100dvh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#047857]"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>);
    }
    if (!isAuthenticated) {
        router.push('/login');
        return null;
    }
    return (<div className="flex min-h-[100dvh] w-full flex-col bg-[#f7f9f4] lg:flex-row lg:items-stretch">
      <aside className="relative z-20 hidden h-[100dvh] max-h-[100dvh] w-64 shrink-0 overflow-hidden lg:sticky lg:top-0 lg:block" aria-label="Sidebar">
        <Sidebar />
      </aside>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(20rem,92vw)] gap-0 border-0 bg-[#047857] p-0 text-white [&>button]:top-3 [&>button]:right-3 [&>button]:text-white [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100">
          <Sidebar className="min-h-0 flex-1 border-0 shadow-none" onNavigate={() => setMobileNavOpen(false)}/>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setMobileNavOpen(true)}/>
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>);
}
