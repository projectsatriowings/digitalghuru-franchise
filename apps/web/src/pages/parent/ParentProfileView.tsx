import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  User,
  GraduationCap,
  Calendar,
  Building,
  QrCode,
  ShieldCheck,
  Phone,
  Mail,
  CheckCircle,
} from 'lucide-react';

interface ParentProfileViewProps {
  student: any;
  parent: any;
}

export const ParentProfileView: React.FC<ParentProfileViewProps> = ({ student, parent }) => {
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState<boolean>(true);

  useEffect(() => {
    async function loadQrPass() {
      if (!student?.id) return;
      try {
        setLoadingQr(true);
        const res = await apiFetch(`/attendance/students/${student.id}/qr`);
        if (res.success && res.data?.qrData) {
          setQrCodeData(res.data.qrData);
        }
      } catch (err) {
        console.error('[Load QR Pass Error]', err);
      } finally {
        setLoadingQr(false);
      }
    }

    loadQrPass();
  }, [student?.id]);

  const activeEnrollment = student?.enrollments?.[0];
  const batch = activeEnrollment?.batch;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#64748B]" /> Student Identity & Verified Credentials
        </h2>
        <p className="text-xs text-[#64748B] mt-0.5">
          Official enrollment records, guardian contact details, and attendance QR pass for{' '}
          <strong className="text-[#0F172A]">{student?.firstName} {student?.lastName}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Student Academic Record */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <User className="w-4 h-4 text-[#64748B]" /> Student Profile Information
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Active Enrolled
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">First Name</span>
                <strong className="text-[#0F172A] text-sm block mt-0.5">{student?.firstName}</strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Last Name</span>
                <strong className="text-[#0F172A] text-sm block mt-0.5">{student?.lastName}</strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Admission Number</span>
                <strong className="text-[#006FFF] font-mono text-sm block mt-0.5">
                  {student?.admissionNumber}
                </strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Gender</span>
                <span className="text-[#0F172A] font-semibold block mt-0.5">
                  {student?.gender || 'Not specified'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Blood Group</span>
                <span className="text-[#0F172A] font-semibold block mt-0.5">
                  {student?.bloodGroup || 'Not specified'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Admission Date</span>
                <span className="text-[#0F172A] font-semibold block mt-0.5">
                  {student?.admissionDate
                    ? new Date(student.admissionDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Academic Batch & Institute Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
              <Building className="w-4 h-4 text-[#64748B]" /> Academic Institute & Batch Enrollment
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/60 space-y-1">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Course Centre</span>
                <strong className="text-sm font-bold text-[#0F172A] block">
                  {student?.institute?.name || 'Digital Guru Center'}
                </strong>
                <span className="text-[11px] text-[#64748B] block">
                  Institute Code: {student?.institute?.code}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/60 space-y-1">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Class Batch</span>
                <strong className="text-sm font-bold text-[#0F172A] block">
                  {batch?.name || 'Class 10 Regular'}
                </strong>
                <span className="text-[11px] text-[#64748B] block">
                  Academic Year: {batch?.academicYear || '2026-2027'}
                </span>
              </div>
            </div>
          </div>

          {/* Guardian Relation Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
              <ShieldCheck className="w-4 h-4 text-[#64748B]" /> Linked Guardian Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Guardian Name</span>
                <strong className="text-[#0F172A] block mt-0.5">{parent?.fullName || 'Parent'}</strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Contact Phone</span>
                <strong className="text-[#0F172A] block mt-0.5">{parent?.phone || 'N/A'}</strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">In-App Alerts</span>
                <span className="text-emerald-800 font-bold block mt-0.5">Enabled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance QR Pass */}
        <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-5 text-center flex flex-col items-center justify-between">
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
              <QrCode className="w-4 h-4" /> Digital Attendance Pass
            </div>
            <p className="text-xs text-[#94A3B8]">
              Scan this QR code at the institute entrance kiosk for instant touch-free check-in & check-out.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center my-2 shadow-inner">
            {loadingQr ? (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-[#94A3B8]">
                Generating secure pass...
              </div>
            ) : qrCodeData ? (
              <QRCodeSVG
                value={qrCodeData}
                size={190}
                level="H"
                includeMargin={true}
                fgColor="#2D1E18"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-[#94A3B8]">
                QR pass unavailable
              </div>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <span className="font-bold text-[#0F172A] block">
              {student?.firstName} {student?.lastName}
            </span>
            <span className="font-mono text-xs text-[#64748B] block">
              Admission No: {student?.admissionNumber}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] w-full flex items-center justify-center gap-1.5 font-medium">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Cryptographically Signed Pass
          </div>
        </div>
      </div>
    </div>
  );
};
