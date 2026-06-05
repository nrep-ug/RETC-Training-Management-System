'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments } from '@/lib/fetch-all-documents';
import { Card } from '@/components/ui/card';
import { Users, BookOpen, TrendingUp, UserRoundCog, FileText, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { DashboardGreeting } from '@/components/dashboard-greeting';
export default function AdminDashboard() {
    const { user, hasRole } = useAuth();
    const [stats, setStats] = useState({
        totalTrainees: 0,
        totalPrograms: 0,
        activePrograms: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const quickActions = [
        {
            label: 'Manage Trainees',
            description: 'Add, edit, and track trainee records',
            href: '/dashboard/trainees',
            icon: Users,
        },
        {
            label: 'Manage RETC Facilitators',
            description: 'Maintain RETC facilitator profiles and roles',
            href: '/dashboard/trainers',
            icon: UserRoundCog,
        },
        {
            label: 'Manage Courses',
            description: 'Create and update training courses',
            href: '/dashboard/programs',
            icon: BookOpen,
        },
        {
            label: 'View Analytics',
            description: 'Review performance and completion trends',
            href: '/dashboard/analytics',
            icon: BarChart3,
        },
        {
            label: 'Generate Reports',
            description: 'Export and review compliance reports',
            href: '/dashboard/reports',
            icon: FileText,
        },
    ];
    useEffect(() => {
        fetchStats();
    }, []);
    const fetchStats = async () => {
        try {
            setIsLoading(true);
            // Fetch trainees count
            const [traineeDocs, programDocs] = await Promise.all([
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.TRAINEES),
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.PROGRAMS),
            ]);
            const activePrograms = programDocs.filter((p) => p.status === 'ongoing').length;
            setStats({
                totalTrainees: traineeDocs.length,
                totalPrograms: programDocs.length,
                activePrograms,
            });
        }
        catch (error) {
            console.error('Error fetching stats:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<div className="p-4 sm:p-6 lg:p-8">
      <DashboardGreeting name={user?.name} subtitle="Here is your admin overview with key operational insights." />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Trainees</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {isLoading ? '-' : stats.totalTrainees}
              </p>
            </div>
            <Users className="h-12 w-12 text-blue-500 opacity-20"/>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Courses</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {isLoading ? '-' : stats.totalPrograms}
              </p>
            </div>
            <BookOpen className="h-12 w-12 text-green-500 opacity-20"/>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Active Courses</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {isLoading ? '-' : stats.activePrograms}
              </p>
            </div>
            <TrendingUp className="h-12 w-12 text-purple-500 opacity-20"/>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-xl border border-[#047857]/15 bg-white p-4 transition-all hover:border-[#ff8829]/50 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-[#047857]/10 p-2 text-[#047857] transition-colors group-hover:bg-[#ff8829]/15 group-hover:text-[#ff8829]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{action.label}</p>
                    <p className="mt-1 text-sm text-gray-600">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>);
}
