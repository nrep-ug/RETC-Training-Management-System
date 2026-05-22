import { LoginForm } from '@/components/login-form';
import Image from 'next/image';
import { BriefcaseBusiness, ChartColumnIncreasing, ShieldCheck } from 'lucide-react';
export const metadata = {
    title: 'Login - RETC Training Management System',
    description: 'Login to RETC Training Management System',
};
export default function LoginPage() {
    return (<main className="relative min-h-screen bg-gradient-to-br from-emerald-100 via-emerald-50 to-orange-100 p-3 sm:p-6">
      <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_10%_15%,rgba(21,128,61,0.12),transparent_36%),radial-gradient(circle_at_90%_85%,rgba(249,115,22,0.1),transparent_34%)]"/>
      <div className="relative mx-auto grid min-h-[92vh] w-full max-w-7xl overflow-x-hidden rounded-[26px] border border-emerald-200/40 bg-white/50 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur md:grid-cols-[1.15fr_0.85fr]">
        <section className="relative flex flex-col justify-center bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 p-8 text-white sm:p-14 md:[clip-path:polygon(0_0,91%_0,100%_50%,91%_100%,0_100%)]">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:17px_17px]"/>
          <div className="pointer-events-none absolute -right-16 top-1/2 hidden h-52 w-52 -translate-y-1/2 rounded-full border border-emerald-200/35 bg-emerald-200/15 blur-[1px] md:block"/>
          <div className="pointer-events-none absolute -right-7 top-1/2 hidden h-20 w-20 -translate-y-1/2 rounded-full bg-orange-200/70 md:block"/>
          <div className="relative">
            <div className="mb-5 inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-medium tracking-wide text-emerald-100">
              RETC Training Management System
            </div>
            <h1 className="max-w-lg text-4xl font-bold leading-tight sm:text-5xl">
              Welcome to RETC Training Management System
            </h1>
            <p className="mt-4 max-w-md text-emerald-100/90">
              Empowering teams with practical training, skills development, and measurable performance outcomes.
            </p>
            <div className="mt-9 space-y-4">
              <FeatureItem icon={BriefcaseBusiness} title="Trainee Management" text="Register trainees, update profiles, track status, and manage imports from a single workspace."/>
              <FeatureItem icon={ChartColumnIncreasing} title="Courses and Analytics" text="Create training courses, monitor completion trends, and review dashboard metrics for better planning."/>
              <FeatureItem icon={ShieldCheck} title="Reports and Compliance" text="Generate training reports, keep auditable records, and support role-based access for administrators and managers."/>
            </div>
          </div>
        </section>
        <section className="relative flex items-stretch justify-center bg-gradient-to-b from-white/92 to-orange-50/50 p-6 sm:p-10">
          <div className="flex h-full w-full max-w-md flex-col rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
            <div className="mb-6 text-center">
              <div className="mb-3 flex justify-center">
                <Image src="/logo.png" alt="RETC Logo" width={58} height={58} priority/>
              </div>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900">Sign In</h2>
              <p className="mt-1 text-sm text-slate-500">Enter your credentials to access your account</p>
            </div>
            <div className="mt-2 flex-1">
              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </main>);
}
function FeatureItem({ icon: Icon, title, text }) {
    return (<div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-white/15 p-2">
          <Icon className="h-5 w-5 text-emerald-100"/>
        </div>
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-emerald-100/90">{text}</p>
        </div>
      </div>
    </div>);
}
