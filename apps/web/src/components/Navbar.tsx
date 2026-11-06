import React, { useState, useRef, useEffect } from 'react';
import { useAuth, ALL_BRANCHES_SELECTION } from '../context/AuthContext';
import {
  LogOut,
  Building,
  ChevronDown,
  Check,
  Search,
  Sparkles,
  MapPin,
  User as UserIcon,
  Layers,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import BRANDING from '../config/branding';

export const Navbar: React.FC = () => {
  const { user, activeInstitute, assignedBranches, isConsolidatedMode, setActiveInstitute, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white border border-slate-900">
            Super Admin
          </span>
        );
      case 'FRANCHISE_OWNER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#006FFF]/15 text-[#006FFF] border border-[#006FFF]/30">
            Franchisee Admin
          </span>
        );
      case 'BRANCH_ADMIN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            Branch Admin
          </span>
        );
      case 'ACADEMIC_ADMIN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            Academic Admin
          </span>
        );
      case 'STAFF':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            Staff
          </span>
        );
      case 'PARENT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            Parent
          </span>
        );
      case 'STUDENT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            Student
          </span>
        );
      default:
        return null;
    }
  };

  const isFranchiseeOrSuperAdmin = user?.role === 'FRANCHISE_OWNER' || user?.role === 'SUPER_ADMIN';

  const filteredBranches = assignedBranches.filter((b) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.name.toLowerCase().includes(term) ||
      b.code.toLowerCase().includes(term) ||
      (b.city && b.city.toLowerCase().includes(term))
    );
  });

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between text-slate-900 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img
            src={BRANDING.logo.navbar}
            alt="Digital Guru"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-slate-900 leading-tight">
              Digital Guru <span className="text-[#006FFF] font-semibold text-xs tracking-normal">Franchise</span>
            </span>
          </div>
        </div>

        {/* TOP NAVIGATION BRANCH SELECTOR FOR FRANCHISEE ADMIN & SUPER ADMIN */}
        {isFranchiseeOrSuperAdmin && assignedBranches.length > 0 ? (
          <div className="relative ml-2 sm:ml-4" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${isConsolidatedMode
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-[#006FFF]/40 text-[#006FFF] shadow-sm'
                  : 'bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-800 shadow-sm'
                }`}
              title="Click to switch between campus branches or view consolidated data"
            >
              {isConsolidatedMode ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#006FFF]" />
                  <span className="font-bold">All Assigned Branches</span>
                  <span className="hidden md:inline-block px-1.5 py-0.2 bg-[#006FFF]/10 text-[#006FFF] text-[10px] rounded-md font-mono">
                    Consolidated ({assignedBranches.length})
                  </span>
                </>
              ) : (
                <>
                  <Building className="w-3.5 h-3.5 text-[#006FFF]" />
                  <span className="font-bold max-w-[150px] sm:max-w-[200px] truncate">{activeInstitute?.name}</span>
                  <span className="hidden lg:inline-block text-slate-500 font-mono text-[10px]">
                    ({activeInstitute?.code})
                  </span>
                  {activeInstitute?.city && (
                    <span className="hidden xl:inline-flex items-center gap-0.5 text-slate-500 text-[11px]">
                      • {activeInstitute.city}
                    </span>
                  )}
                </>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 bg-slate-50/80 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Multi-Branch Switcher
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {assignedBranches.length} Campus{assignedBranches.length > 1 ? 'es' : ''}
                    </span>
                  </div>

                  {/* Search box if multiple branches */}
                  {assignedBranches.length > 2 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search by campus name, code, or city..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006FFF]/30"
                      />
                    </div>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
                  {/* Option 1: All Assigned Branches (Consolidated Mode) */}
                  <button
                    onClick={() => {
                      setActiveInstitute(ALL_BRANCHES_SELECTION);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start justify-between gap-3 ${isConsolidatedMode
                        ? 'bg-[#006FFF]/10 border border-[#006FFF]/30 text-[#006FFF]'
                        : 'hover:bg-slate-50 text-slate-800'
                      }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-blue-100 text-[#006FFF] mt-0.5">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-extrabold text-xs flex items-center gap-1.5">
                          All Assigned Branches
                          <span className="px-1.5 py-0.5 bg-[#006FFF] text-white text-[9px] font-bold rounded-full">
                            Consolidated
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Aggregated overview, KPIs, and performance across all {assignedBranches.length} campuses.
                        </div>
                      </div>
                    </div>
                    {isConsolidatedMode && <Check className="w-4 h-4 text-[#006FFF] shrink-0 mt-1" />}
                  </button>

                  {/* Separator */}
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                    Individual Campus Branches ({filteredBranches.length})
                  </div>

                  {/* List of Branches */}
                  {filteredBranches.map((branch) => {
                    const isSelected = activeInstitute?.id === branch.id;
                    return (
                      <button
                        key={branch.id}
                        onClick={() => {
                          setActiveInstitute({
                            id: branch.id,
                            name: branch.name,
                            code: branch.code,
                            city: branch.city,
                          });
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 ${isSelected
                            ? 'bg-[#006FFF]/10 border border-[#006FFF]/30 text-[#006FFF]'
                            : 'hover:bg-slate-50 text-slate-800'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-[#006FFF] text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Building className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate text-slate-900">{branch.name}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-mono text-[#006FFF] font-semibold">{branch.code}</span>
                              {branch.city && (
                                <span className="flex items-center gap-0.5 text-slate-400">
                                  <MapPin className="w-3 h-3" /> {branch.city}
                                </span>
                              )}
                              {branch._count?.students !== undefined && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                  {branch._count.students} Students
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#006FFF] shrink-0" />}
                      </button>
                    );
                  })}

                  {filteredBranches.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No branches matching &ldquo;{searchTerm}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          activeInstitute && (
            <span className="hidden sm:inline-flex items-center gap-1.5 ml-3 text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
              <Building className="w-3.5 h-3.5 text-[#006FFF]" /> {activeInstitute.name} ({activeInstitute.code})
            </span>
          )
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
