'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { Card } from '@/components/ui/card';
import { Users, BookOpen, TrendingUp, UserRoundCog, FileText, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { DashboardGreeting } from '@/components/dashboard-greeting';
export default function ManagerDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalTrainees: 0,
        totalPrograms: 0,
        activePrograms: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const quickActions = [
        {
            label: 'View Trainees',
            description: 'Browse trainee records and status',
            href: '/dashboard/trainees',
            icon: Users,
        },
        {
            label: 'View RETC Facilitators',
            description: 'Review RETC facilitator experience and roles',
            href: '/dashboard/trainers',
            icon: UserRoundCog,
        },
        {
            label: 'View Courses',
            description: 'See training course schedules',
            href: '/dashboard/programs',
            icon: BookOpen,
        },
        {
            label: 'View Analytics',
            description: 'Monitor KPIs and completion metrics',
            href: '/dashboard/analytics',
            icon: BarChart3,
        },
        {
            label: 'View Reports',
            description: 'Access generated operational reports',
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
            const traineesResponse = await databases.listDocuments(DB_ID, COLLECTIONS.TRAINEES);
            // Fetch programs count
            const programsResponse = await databases.listDocuments(DB_ID, COLLECTIONS.PROGRAMS);
            const activePrograms = programsResponse.documents.filter((p) => p.status === 'ongoing').length;
            setStats({
                totalTrainees: traineesResponse.total,
                totalPrograms: programsResponse.total,
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
      <DashboardGreeting name={user?.name} subtitle="Welcome to your manager workspace for monitoring training performance." />

      {/* Stats Cards - Read Only */}
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

      {/* View Only Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Actions</h2>
        <p className="text-gray-600 text-sm mb-4">As a Senior Manager, you have read-only access to view data and reports.</p>
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
