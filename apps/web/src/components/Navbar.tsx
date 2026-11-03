import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Building, ShieldCheck, User as UserIcon } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import BRANDING from '../config/branding';

export const Navbar: React.FC = () => {
  const { user, activeInstitute, logout } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white border border-slate-900">Super Admin</span>;
      case 'FRANCHISE_OWNER':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#006FFF]/15 text-[#006FFF] border border-[#006FFF]/30">Franchise Owner</span>;
      case 'BRANCH_ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">Branch Admin</span>;
      case 'ACADEMIC_ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">Academic Admin</span>;
      case 'STAFF':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">Staff</span>;
      case 'PARENT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">Parent</span>;
      case 'STUDENT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">Student</span>;
      default:
        return null;
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between text-slate-900 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img
            src={BRANDING.logo.navbar}
            alt="Digital Guru"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              // Graceful fallback to branded SVG icon if webp fails to render
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-slate-900 leading-tight">
              Digital Guru <span className="text-[#006FFF] font-semibold text-xs tracking-normal">Franchise</span>
            </span>
          </div>
        </div>
        {activeInstitute && (
          <span className="hidden sm:inline-flex items-center gap-1.5 ml-3 text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
            <Building className="w-3.5 h-3.5 text-[#006FFF]" /> {activeInstitute.name} ({activeInstitute.code})
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {getRoleBadge(user?.role)}

        <NotificationBell />

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-900">{user?.fullName}</span>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
