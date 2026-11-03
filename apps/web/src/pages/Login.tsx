import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { UserRole } from '../types';
import BRANDING from '../config/branding';
import {
  ShieldCheck,
  Building2,
  User,
  Users,
  Lock,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  X,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface DemoAccount {
  role: UserRole;
  label: string;
  roleBadgeColor: string;
  badgeBg: string;
  identifier: string;
  password: string;
  subtext: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    roleBadgeColor: 'text-slate-900',
    badgeBg: 'bg-slate-100 border-slate-300',
    identifier: 'superadmin@platform.local',
    password: 'AdminSecurePassword#2026',
    subtext: 'Platform Master Portal',
  },
  {
    role: 'FRANCHISE_OWNER',
    label: 'Franchise Owner',
    roleBadgeColor: 'text-[#006FFF]',
    badgeBg: 'bg-blue-50 border-blue-200',
    identifier: 'rajesh.owner@digitalghuru.example.com',
    password: 'FranchiseOwner#2026',
    subtext: 'Franchise & Branch Revenue',
  },
  {
    role: 'ACADEMIC_ADMIN',
    label: 'Branch Admin',
    roleBadgeColor: 'text-amber-800',
    badgeBg: 'bg-amber-50 border-amber-200',
    identifier: 'admin@apexacademy.com',
    password: 'Password#123',
    subtext: 'Campus Operations',
  },
  {
    role: 'STAFF',
    label: 'Staff / Faculty',
    roleBadgeColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    identifier: 'teacher@apexacademy.com',
    password: 'Password#123',
    subtext: 'Attendance & Academics',
  },
  {
    role: 'PARENT',
    label: 'Parent Portal',
    roleBadgeColor: 'text-indigo-700',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    identifier: '9826444306',
    password: 'Password#123',
    subtext: 'Phone: 9826444306',
  },
  {
    role: 'STUDENT',
    label: 'Student Portal',
    roleBadgeColor: 'text-purple-700',
    badgeBg: 'bg-purple-50 border-purple-200',
    identifier: 'student@apexacademy.com',
    password: 'Password#123',
    subtext: 'Coursework & Materials',
  },
];

export const Login: React.FC = () => {
  const isDemoModeEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true';
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('ACADEMIC_ADMIN');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Help Modal State
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Multi-Institute Selection State
  const [pendingAuth, setPendingAuth] = useState<{
    token: string;
    user: any;
    memberships: Array<{ id: string; role: string; institute: { id: string; name: string; code: string } }>;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          role: selectedRole,
        }),
      });

      if (res.success && res.data?.accessToken) {
        if (res.data.memberships && res.data.memberships.length > 1) {
          setPendingAuth({
            token: res.data.accessToken,
            user: res.data.user,
            memberships: res.data.memberships,
          });
        } else {
          login(res.data.accessToken, res.data.user, res.data.institute);
        }
      } else {
        setError(res.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (demo: DemoAccount) => {
    setSelectedRole(demo.role);
    setIdentifier(demo.identifier);
    setPassword(demo.password);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A2540] text-slate-100 flex flex-col justify-between items-center px-4 py-8 relative overflow-x-hidden">
      {/* Background brand glow accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#006FFF]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FEDC32]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Form Container */}
      <div className="w-full max-w-md my-auto relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl mb-3">
            <img
              src={BRANDING.logo.login}
              alt="Digital Guru"
              className="h-14 w-auto object-contain max-w-[200px]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = BRANDING.logo.navbar;
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
            Digital Guru <span className="text-[#FEDC32]">Franchise</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
            Tuition & Franchise Enterprise Management Platform
          </p>
        </div>

        {/* Multi-Institute Selection Step */}
        {pendingAuth ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#006FFF]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Select Your Branch Campus</h2>
                <p className="text-xs text-slate-500">Your account is registered across multiple franchise branches</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Choose the branch context you wish to access for this session:
            </p>

            <div className="space-y-2.5">
              {pendingAuth.memberships.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    login(pendingAuth.token, pendingAuth.user, m.institute);
                    setPendingAuth(null);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-[#006FFF]/50 text-left transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm group-hover:text-[#006FFF] transition-colors">
                      {m.institute.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Code: {m.institute.code} &bull; Role: {m.role}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#006FFF] group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPendingAuth(null)}
              className="w-full mt-5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors text-center"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            {/* Role Selector Tabs */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 mb-5 grid grid-cols-3 sm:grid-cols-6 gap-1 text-center shadow-lg">
              {(
                [
                  { role: 'FRANCHISE_OWNER', label: 'Franchise' },
                  { role: 'ACADEMIC_ADMIN', label: 'Admin' },
                  { role: 'STAFF', label: 'Staff' },
                  { role: 'PARENT', label: 'Parent' },
                  { role: 'STUDENT', label: 'Student' },
                  { role: 'SUPER_ADMIN', label: 'Super' },
                ] as const
              ).map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => {
                    setSelectedRole(item.role);
                    setError(null);
                  }}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all ${
                    selectedRole === item.role
                      ? 'bg-[#006FFF] text-white shadow-md font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Login Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 shadow-2xl text-slate-900">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-display">
                  {selectedRole === 'SUPER_ADMIN' ? (
                    <>
                      <ShieldCheck className="w-5 h-5 text-slate-900" /> Super Admin Portal
                    </>
                  ) : selectedRole === 'FRANCHISE_OWNER' ? (
                    <>
                      <Building2 className="w-5 h-5 text-[#006FFF]" /> Franchise Owner Portal
                    </>
                  ) : selectedRole === 'ACADEMIC_ADMIN' ? (
                    <>
                      <Building2 className="w-5 h-5 text-amber-700" /> Branch Admin Login
                    </>
                  ) : selectedRole === 'STAFF' ? (
                    <>
                      <Users className="w-5 h-5 text-emerald-700" /> Staff & Faculty Login
                    </>
                  ) : (
                    <>
                      <User className="w-5 h-5 text-indigo-700" /> {selectedRole === 'PARENT' ? 'Parent' : 'Student'} Portal
                    </>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your registered credentials to access your Digital Guru workspace
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                  {error.includes('registered as') && (
                    <div className="pl-6 pt-1">
                      {error.includes('registered as FRANCHISE_OWNER') && (
                        <button
                          type="button"
                          onClick={() => { setSelectedRole('FRANCHISE_OWNER'); setError(null); }}
                          className="px-2.5 py-1 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-lg font-medium text-[11px] transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          Switch to Franchise Tab <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {error.includes('registered as PARENT') && (
                        <button
                          type="button"
                          onClick={() => { setSelectedRole('PARENT'); setError(null); }}
                          className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-medium text-[11px] transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          Switch to Parent Tab <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {error.includes('registered as STAFF') && (
                        <button
                          type="button"
                          onClick={() => { setSelectedRole('STAFF'); setError(null); }}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium text-[11px] transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          Switch to Staff Tab <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {error.includes('registered as ACADEMIC_ADMIN') && (
                        <button
                          type="button"
                          onClick={() => { setSelectedRole('ACADEMIC_ADMIN'); setError(null); }}
                          className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-medium text-[11px] transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          Switch to Admin Tab <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {error.includes('registered as STUDENT') && (
                        <button
                          type="button"
                          onClick={() => { setSelectedRole('STUDENT'); setError(null); }}
                          className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-medium text-[11px] transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          Switch to Student Tab <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {selectedRole === 'PARENT' ? 'Mobile Phone Number / Email' : 'Email Address / Username'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      name="dg_user_identifier"
                      id="dg_user_identifier"
                      required
                      autoComplete="off"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={selectedRole === 'PARENT' ? 'Enter mobile number or email' : 'Enter email address or username'}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 focus:border-[#006FFF] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="dg_user_secret"
                      id="dg_user_secret"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 focus:border-[#006FFF] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-lg focus:outline-none cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Need Credentials Link */}
                <div className="flex items-center justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-xs text-[#006FFF] hover:text-[#0058D4] transition-colors flex items-center gap-1 font-semibold"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#006FFF]" /> Need login assistance?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold py-2.5 rounded-xl shadow-lg shadow-[#006FFF]/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span className="animate-pulse">Authenticating...</span>
                  ) : (
                    <>
                      Sign In to Digital Guru <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Demo Credentials Autofill Section (Visible only in Development or explicitly enabled Demo mode) */}
              {isDemoModeEnabled && (
                <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Sparkles className="w-3.5 h-3.5 text-[#006FFF]" /> Quick Demo Access (1-Click Fill)
                  </span>
                  <span className="text-[10px] bg-blue-50 text-[#006FFF] px-2 py-0.5 rounded-full border border-blue-200 font-semibold">
                    Demo Mode
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {DEMO_ACCOUNTS.map((demo) => (
                    <button
                      key={demo.role}
                      type="button"
                      onClick={() => handleSelectDemo(demo)}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-[#006FFF]/40 text-left text-slate-900 transition-all group cursor-pointer"
                    >
                      <div className={`font-bold text-[11px] ${demo.roleBadgeColor}`}>{demo.label}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{demo.subtext}</div>
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>

            {/* Bottom Security notice */}
            <div className="text-center mt-5 text-xs text-slate-400">
              Digital Guru Franchise Operating System &bull; Enterprise Multi-Tenant Security
            </div>
          </>
        )}
      </div>

      {/* Credential Guidance Modal with Official Digital Guru Contact Information */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#006FFF]">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">Account Access & Support</h3>
                  <p className="text-xs text-slate-500">Digital Guru Support & Credential Assistance</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-[#006FFF] flex items-center gap-1.5 mb-1">
                  <Building2 className="w-4 h-4" /> Franchise Owner & Branch Admin
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Franchise credentials are provided upon agreement signing by the Super Admin team. Contact your franchise coordinator or platform administrator.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                  <Users className="w-4 h-4" /> Staff / Faculty Members
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Contact your branch institute's Academic Admin to provision or reset your faculty account password.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-indigo-800 flex items-center gap-1.5 mb-1">
                  <User className="w-4 h-4" /> Parents & Students
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Credentials are automatically issued upon admission registration. Contact your local branch campus admissions desk if you require assistance.
                </p>
              </div>

              {/* Official Contact Details from Digital Guru */}
              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
                <div className="font-bold text-slate-900 text-xs font-display flex items-center justify-between">
                  <span>Digital Guru Direct Support</span>
                  <span className="text-[10px] text-[#006FFF] font-semibold">9:00 AM - 7:00 PM IST</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-[#006FFF]" />
                  <a href="tel:+918825948859" className="hover:underline font-semibold">{BRANDING.contact.phone}</a>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-[#006FFF]" />
                  <a href={`mailto:${BRANDING.contact.email}`} className="hover:underline">{BRANDING.contact.email}</a>
                </div>
                <div className="pt-1 text-[11px] text-slate-600 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#006FFF] shrink-0 mt-0.5" />
                  <span>Campuses in Anna Nagar (Chennai), Ameerpet (Hyderabad), and Korattur (Chennai)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-900">Security Notice:</span> Digital Guru Franchise enforces strict institutional data isolation. Account details are never shared across franchise branches.
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-[#006FFF]/20 cursor-pointer"
              >
                Close Guidance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding Bar */}
      <div className="w-full max-w-5xl mx-auto mt-8 pt-4 border-t border-slate-800 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 z-10">
        <div>
          © {new Date().getFullYear()} Digital Ghuru. All rights reserved. &bull; In collaboration with Jaighurudeva Educational Academy
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <a href="tel:+918825948859" className="hover:text-white transition-colors">{BRANDING.contact.phone}</a>
          <span>&bull;</span>
          <a href={`mailto:${BRANDING.contact.email}`} className="hover:text-white transition-colors">{BRANDING.contact.email}</a>
        </div>
      </div>
    </div>
  );
};
