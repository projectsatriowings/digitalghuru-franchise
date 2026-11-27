import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Building2,
  Users,
  GraduationCap,
  HelpCircle,
  X,
  ChevronRight,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import BRANDING from '../config/branding';
import { UserRole } from '../types';

interface DemoAccount {
  role: UserRole;
  label: string;
  roleBadgeColor: string;
  badgeBg: string;
  identifier: string;
  password: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    roleBadgeColor: 'text-slate-900',
    badgeBg: 'bg-slate-100 border-slate-300',
    identifier: 'superadmin@gmail.com',
    password: 'admin@123',
    subtext: 'Master Platform Portal',
    icon: ShieldCheck,
  },
];

export const Login: React.FC = () => {
  const isDemoModeEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true';
  const { login } = useAuth();

  // Sign In States (Default to Super Admin)
  const [selectedRole, setSelectedRole] = useState<UserRole>('SUPER_ADMIN');
  const [identifier, setIdentifier] = useState('superadmin@gmail.com');
  const [password, setPassword] = useState('admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Help Modal State
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Multi-Institute Selection State
  const [pendingAuth, setPendingAuth] = useState<{
    token: string;
    user: any;
    memberships: Array<{ id: string; role: string; institute: { id: string; name: string; code: string } }>;
  } | null>(null);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
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
        setError(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login request failed. Please check network connectivity.');
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

  useEffect(() => {
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#F8FAFC';
    document.documentElement.style.backgroundColor = '#F8FAFC';
    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
    };
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex-1 bg-gradient-to-br from-[#F1F5F9] via-[#E8F0FE] to-[#F8FAFC] text-slate-800 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans">
      {/* Background Floating Decorative Geometric Shapes */}
      <div className="absolute top-10 left-12 w-24 h-24 rounded-3xl bg-[#006FFF]/10 rotate-12 blur-[1px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-12 left-16 w-32 h-32 rounded-full border-4 border-[#006FFF]/15 pointer-events-none" />
      <div className="absolute top-20 right-16 w-20 h-20 rounded-2xl bg-[#FEDC32]/25 -rotate-6 pointer-events-none" />
      <div className="absolute bottom-20 right-24 w-28 h-28 rounded-3xl bg-[#FE4D01]/10 rotate-45 pointer-events-none" />
      <div className="absolute top-1/2 left-8 w-14 h-14 rounded-xl bg-purple-500/10 rotate-45 pointer-events-none" />
      <div className="absolute top-1/3 right-8 w-16 h-16 rounded-full bg-blue-400/15 pointer-events-none" />

      {/* Main Container Card: Left = White Form Side, Right = Blue Image Side */}
      <div className="w-full max-w-5xl bg-white rounded-[32px] sm:rounded-[36px] shadow-2xl shadow-blue-900/15 border border-slate-200/80 overflow-hidden relative z-10 flex flex-col min-h-[620px] md:min-h-[660px]">
        {/* Multi-Institute Selection Step Override */}
        {pendingAuth ? (
          <div className="p-8 sm:p-12 max-w-lg mx-auto my-auto w-full text-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#006FFF] shadow-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 font-display">Select Branch Campus</h2>
                <p className="text-xs text-slate-500">Your account is registered across multiple franchise branches</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5">
              Choose the branch context you wish to access for this session:
            </p>

            <div className="space-y-3">
              {pendingAuth.memberships.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    login(pendingAuth.token, pendingAuth.user, m.institute);
                    setPendingAuth(null);
                  }}
                  className="w-full p-4 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-[#006FFF]/50 text-left transition-all flex items-center justify-between group shadow-sm hover:shadow"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm group-hover:text-[#006FFF] transition-colors">
                      {m.institute.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Code: {m.institute.code} &bull; Role: {m.role}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#006FFF] group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPendingAuth(null)}
              className="w-full mt-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors text-center cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <div className="relative w-full flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* ============================================================== */}
            {/* COLUMN 1 (LEFT 50% ON DESKTOP): WHITE SIDE - LOGIN FORM        */}
            {/* ============================================================== */}
            <div className="w-full md:w-1/2 flex flex-col justify-between p-7 sm:p-10 lg:p-12 bg-white relative z-10 min-h-[580px] md:min-h-[640px]">


              {/* Center: Centered Logo, Brand Name, Sign In, and Form */}
              <div className="my-auto py-4 w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center">
                {/* Centered Logo */}
                <img
                  src={BRANDING.logo.navbar}
                  alt="Digital Guru"
                  className="h-14 sm:h-16 w-auto object-contain mx-auto mb-2.5"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = BRANDING.logo.login;
                  }}
                />

                {/* Centered Brand Name */}
                <div className="font-black text-xl sm:text-2xl tracking-tight text-slate-900 font-display text-center mb-1">
                  Digital Guru <span className="text-[#006FFF]">Franchise</span>
                </div>

                {/* Centered Sign in to Account (Reduced font size) */}
                <h2 className="text-base sm:text-lg font-bold text-slate-600 text-center tracking-tight mb-4">
                  Sign in to Account
                </h2>

                {/* Demo Credentials Persona Circles */}
                <div className="w-full flex flex-col items-center mb-4">
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3 py-1">
                    {DEMO_ACCOUNTS.map((demo) => {
                      const IconComp = demo.icon;
                      const isSelected = selectedRole === demo.role && identifier === demo.identifier;
                      return (
                        <button
                          key={demo.role}
                          type="button"
                          onClick={() => handleSelectDemo(demo)}
                          title={`${demo.label} (${demo.identifier})`}
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                            isSelected
                              ? 'bg-[#006FFF] text-white shadow-md shadow-blue-500/35 ring-2 ring-blue-400/50 scale-105'
                              : 'bg-slate-50 hover:bg-blue-50/80 text-slate-600 hover:text-[#006FFF] border border-slate-200/80 hover:border-blue-200'
                          }`}
                        >
                          <IconComp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 font-medium shadow-lg">
                            {demo.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-full flex items-center gap-3 my-2.5 text-slate-300 text-xs">
                    <div className="flex-1 h-px bg-slate-200/90" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      or with credentials
                    </span>
                    <div className="flex-1 h-px bg-slate-200/90" />
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="w-full mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="flex-1">{error}</span>
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSignInSubmit} autoComplete="off" className="w-full space-y-4">
                  {/* Identifier */}
                  <div className="relative">
                    <div className="flex items-center bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white rounded-full border border-slate-200/90 focus-within:border-[#006FFF] focus-within:ring-2 focus-within:ring-[#006FFF]/20 transition-all px-4 py-3">
                      <Mail className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                      <input
                        type="text"
                        name="dg_identifier"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="Email or phone number"
                        className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <div className="flex items-center bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white rounded-full border border-slate-200/90 focus-within:border-[#006FFF] focus-within:ring-2 focus-within:ring-[#006FFF]/20 transition-all px-4 py-3">
                      <Lock className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="dg_password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none pr-7"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-700 transition-colors p-1 focus:outline-none cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex items-center justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowHelpModal(true)}
                      className="text-xs text-slate-400 hover:text-[#006FFF] transition-colors font-medium hover:underline cursor-pointer"
                    >
                      Forgot your password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 text-center">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-[#006FFF] via-[#0058D4] to-[#0042A6] hover:from-[#0058D4] hover:to-[#003078] text-white font-bold text-xs uppercase tracking-widest py-3.5 px-8 rounded-full shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="animate-pulse">Signing in...</span>
                      ) : (
                        <>
                          SIGN IN <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ============================================================== */}
            {/* COLUMN 2 (RIGHT 50% ON DESKTOP): BLUE SIDE - PNG IMAGE        */}
            {/* ============================================================== */}
            <div className="w-full md:w-1/2 flex flex-col justify-between items-center text-center p-8 sm:p-10 lg:p-12 bg-gradient-to-br from-[#006FFF] via-[#0058D4] to-[#0A2540] text-white relative overflow-hidden">
              {/* Glowing Background Decorative Orbs */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FEDC32]/20 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-[#FE4D01]/15 blur-2xl pointer-events-none" />

              {/* Text Header */}
              <div className="relative z-10 max-w-sm mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold mb-3">
                  <Sparkles className="w-3 h-3 text-[#FEDC32]" /> Enterprise LMS & Franchise Ops
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight drop-shadow-sm">
                  Welcome Back!
                </h2>
                <p className="text-xs sm:text-sm text-blue-100/90 mt-2 font-normal leading-relaxed">
                  To keep connected with Digital Guru please login with your personal credentials.
                </p>
              </div>

              {/* Interactive Vector Illustration Container with Gentle Floating & Hover Zoom */}
              <div className="relative z-10 my-auto w-full max-w-sm sm:max-w-md flex justify-center items-center py-4 group cursor-pointer">
                {/* Dynamic radial glow behind the illustration that intensifies on hover */}
                <div className="absolute inset-0 max-w-[280px] sm:max-w-[320px] max-h-[280px] sm:max-h-[320px] mx-auto my-auto rounded-full bg-gradient-to-tr from-[#FEDC32]/25 via-[#006FFF]/30 to-[#FE4D01]/20 blur-3xl transition-all duration-700 ease-out group-hover:scale-125 group-hover:opacity-100 opacity-60 animate-pulse-glow pointer-events-none" />

                <img
                  src="/images/auth-vector-illustration.png"
                  alt="Digital Guru Franchise & Digital Learning System"
                  className="w-full h-auto max-h-[300px] sm:max-h-[340px] object-contain relative z-10 transition-all duration-500 ease-out transform group-hover:scale-110 group-hover:-translate-y-2 group-active:scale-95 drop-shadow-[0_15px_30px_rgba(0,0,0,0.35)] group-hover:drop-shadow-[0_25px_45px_rgba(0,0,0,0.45)] select-none animate-float-gentle"
                />
              </div>

              {/* Bottom Subtle Caption */}
              <div className="relative z-10 text-[11px] text-blue-200/70 font-medium">
                Digital Guru Enterprise LMS & Franchise Management
              </div>
            </div>
          </div>
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
                  <Building2 className="w-4 h-4" /> Franchisee Admin
                </div>
                <p className="text-slate-600">
                  Your franchise administrator credentials are provided by Super Admin during onboarding. Franchisee Admin manages all operating campus branches.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1">
                  <Users className="w-4 h-4" /> Staff & Faculty
                </div>
                <p className="text-slate-600">
                  Employee codes and credentials are created by your Franchisee Admin upon profile approval.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-indigo-700 flex items-center gap-1.5 mb-1">
                  <User className="w-4 h-4" /> Parents & Students
                </div>
                <p className="text-slate-600">
                  Use your registered mobile number or admission number (e.g. <code>ADM-2026-001</code>). Passwords are sent via SMS upon enrollment.
                </p>
              </div>

              {/* Demo Credentials Table */}
              <div className="pt-2">
                <div className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>Demo Login Credentials:</span>
                  <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Active Environment
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Role</th>
                        <th className="p-2">Identifier</th>
                        <th className="p-2">Password</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {DEMO_ACCOUNTS.map((d) => (
                        <tr key={d.role} className="hover:bg-slate-50">
                          <td className="p-2 font-semibold text-slate-800">{d.label}</td>
                          <td className="p-2 font-mono text-[10px]">{d.identifier}</td>
                          <td className="p-2 font-mono text-[10px]">{d.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Contact Details */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-slate-500 flex flex-col gap-1 text-[11px]">
                <div>
                  <strong>Digital Guru Head Office Support:</strong>{' '}
                  <a href={`tel:${BRANDING.contact.phone}`} className="text-[#006FFF] hover:underline font-semibold">
                    {BRANDING.contact.phone}
                  </a>
                </div>
                <div>
                  <strong>Email:</strong>{' '}
                  <a href={`mailto:${BRANDING.contact.email}`} className="text-[#006FFF] hover:underline">
                    {BRANDING.contact.email}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
