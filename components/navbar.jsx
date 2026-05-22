'use client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
export function Navbar({ onMenuClick }) {
    const { user, logout, isLoggingOut } = useAuth();
    const handleLogout = async () => {
        try {
            await logout();
        }
        catch (error) {
            console.error('Logout error:', error);
        }
    };
    return (<nav className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-[#047857]/30 bg-white px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Button type="button" variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => onMenuClick?.()} aria-label="Open navigation menu">
          <Menu className="h-5 w-5 text-[#047857]"/>
        </Button>
        <h1 className="truncate text-base font-bold text-[#047857] sm:text-xl md:text-2xl">RETC Training Management System</h1>
      </div>
      
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {user && (<div className="hidden text-right sm:mr-2 sm:block md:mr-4">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs capitalize text-[#ff8829]">{user.role}</p>
          </div>)}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <User className="h-4 w-4"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4"/>
              <span>{user?.email}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
              <LogOut className="mr-2 h-4 w-4"/>
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>);
}
