import { markNotificationEntityAsRead } from '../../services/notificationService';
import React, { useState } from 'react';
import { apiFetch } from '../../services/api';
import {
  CreditCard,
  Receipt,
  Printer,
  X,
  CheckCircle,
  AlertCircle,
  Lock,
  ArrowRight,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';

interface ParentFeesViewProps {
  student: any;
  feeStatement: any;
  loadingStatement: boolean;
  onRefreshStatement: () => void;
  formatCurrency: (val: number | string | undefined) => string;
}

export const ParentFeesView: React.FC<ParentFeesViewProps> = ({
  student,
  feeStatement,
  loadingStatement,
  onRefreshStatement,
  formatCurrency,
}) => {
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Online Payment Checkout State
  const [selectedTermForPayment, setSelectedTermForPayment] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [initiatingPayment, setInitiatingPayment] = useState<boolean>(false);
  const [verifyingPayment, setVerifyingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);

  const openReceipt = async (paymentId: string) => {
    markNotificationEntityAsRead('FEE', paymentId);
    try {
      const res = await apiFetch(`/fees/payments/${paymentId}/receipt`);
      if (res.success && res.data?.receipt) {
        setActiveReceipt(res.data.receipt);
        setShowReceiptModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startPaymentCheckout = (term: any) => {
    setSelectedTermForPayment(term);
    setPaymentAmount(term.remainingBalance || term.finalAmount);
    setPaymentError(null);
    setPaymentSuccessData(null);
    setShowPaymentModal(true);
  };

  const handleProcessOnlinePayment = async () => {
    if (!selectedTermForPayment || paymentAmount <= 0) return;

    try {
      setInitiatingPayment(true);
      setPaymentError(null);

      // 1. Create order on backend
      const orderRes = await apiFetch('/fees/online/create-order', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          feeAssignmentId: selectedTermForPayment.id,
          amount: paymentAmount,
        }),
      });

      if (!orderRes.success || !orderRes.data) {
        throw new Error(orderRes.error || 'Failed to initialize payment order');
      }

      const orderData = orderRes.data;

      // 2. Check if window.Razorpay exists (in production) or run verified simulated flow
      if (typeof (window as any).Razorpay !== 'undefined' && !orderData.isSimulated) {
        const options = {
          key: orderData.keyId,
          amount: Math.round(orderData.amount * 100),
          currency: orderData.currency || 'INR',
          name: 'Digital Guru Center',
          description: `Fee: ${orderData.feeName} (${orderData.termLabel})`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            await verifyPaymentOnServer(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
          },
          prefill: {
            name: `${student.firstName} ${student.lastName}`,
          },
          theme: {
            color: '#4E342E',
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          setPaymentError(response.error.description || 'Payment was declined by bank');
        });
        rzp.open();
      } else {
        // Verified Sandbox / Simulated Gateway Confirmation Flow
        // Generates test signature and calls verify endpoint
        const simulatedPaymentId = `pay_sim_${Date.now()}`;
        const simulatedSignature = `sig_sim_${Date.now()}`;

        await verifyPaymentOnServer(orderData.orderId, simulatedPaymentId, simulatedSignature);
      }
    } catch (err: any) {
      console.error('[Payment Checkout Error]', err);
      setPaymentError(err.message || 'Payment initiation failed');
    } finally {
      setInitiatingPayment(false);
    }
  };

  const verifyPaymentOnServer = async (
    orderId: string,
    paymentId: string,
    signature: string
  ) => {
    try {
      setVerifyingPayment(true);
      const verifyRes = await apiFetch('/fees/online/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          paymentId,
          signature,
        }),
      });

      if (verifyRes.success && verifyRes.data) {
        setPaymentSuccessData(verifyRes.data);
        onRefreshStatement(); // Refresh statement in background
      } else {
        throw new Error(verifyRes.error || 'Server signature verification failed');
      }
    } catch (err: any) {
      console.error('[Payment Verification Error]', err);
      setPaymentError(err.message || 'Payment verification failed');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const summary = feeStatement?.summary || {
    totalPayable: 0,
    totalPaid: 0,
    netOutstanding: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#64748B]" /> Tuition Fees & Online Payment Gateway
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Transparent fee structure, instant online payment, and downloadable tax receipts for{' '}
            <strong className="text-[#0F172A]">{student?.firstName} {student?.lastName}</strong>
          </p>
        </div>

        <button
          onClick={onRefreshStatement}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#006FFF] inline-flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5" /> Refresh Dues
        </button>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] block">
            Total Course Fees
          </span>
          <span className="text-2xl font-black text-[#0F172A] block mt-1">
            {formatCurrency(summary.totalPayable)}
          </span>
          <span className="text-[11px] text-[#94A3B8] mt-1 block">Assigned academic structures</span>
        </div>

        <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
            Total Fees Paid
          </span>
          <span className="text-2xl font-black text-emerald-900 block mt-1">
            {formatCurrency(summary.totalPaid)}
          </span>
          <span className="text-[11px] text-emerald-700 mt-1 block">Successfully verified & credited</span>
        </div>

        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
            Net Outstanding Balance
          </span>
          <span className="text-2xl font-black text-amber-900 block mt-1">
            {formatCurrency(summary.netOutstanding)}
          </span>
          <span className="text-[11px] text-amber-700 mt-1 block">Remaining due amount</span>
        </div>
      </div>

      {/* Fee Terms Ledger */}
      <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider">
          Fee Term Dues & Installments
        </h3>

        {loadingStatement ? (
          <div className="p-12 text-center text-xs text-[#94A3B8]">Loading fee terms...</div>
        ) : feeStatement?.statementItems?.length > 0 ? (
          <div className="space-y-3">
            {feeStatement.statementItems.map((term: any) => {
              const isPaid = term.calculatedStatus === 'PAID';
              const canPay = !isPaid && (term.remainingBalance || 0) > 0;

              return (
                <div
                  key={term.id}
                  className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#0F172A]">{term.feeStructure?.name}</h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : term.calculatedStatus === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {term.calculatedStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      Term: <strong>{term.termLabel}</strong> &bull; Due Date:{' '}
                      <strong className="text-[#0F172A]">
                        {new Date(term.dueDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </strong>
                    </p>
                    <div className="text-xs text-[#64748B] pt-1">
                      <span>Total: {formatCurrency(term.finalAmount)}</span>
                      <span className="mx-2">&bull;</span>
                      <span className="text-emerald-800 font-semibold">
                        Paid: {formatCurrency(term.netPaid)}
                      </span>
                      <span className="mx-2">&bull;</span>
                      <span className="text-amber-800 font-bold">
                        Remaining: {formatCurrency(term.remainingBalance)}
                      </span>
                    </div>

                    {/* Receipts Pills if payments exist */}
                    {term.payments?.length > 0 && (
                      <div className="pt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Receipts:</span>
                        {term.payments.map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => openReceipt(p.id)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white hover:bg-[#006FFF] text-[#006FFF] hover:text-white border border-[#E2E8F0] flex items-center gap-1 transition-colors shadow-xs"
                          >
                            <Receipt className="w-3 h-3" /> {p.receiptNumber} ({formatCurrency(p.amountPaid)})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {canPay && (
                    <button
                      onClick={() => startPaymentCheckout(term)}
                      className="px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 self-start md:self-auto"
                    >
                      <CreditCard className="w-4 h-4" /> Pay {formatCurrency(term.remainingBalance)} Online
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-[#94A3B8]">
            No fee terms are currently assigned to this student.
          </div>
        )}
      </div>

      {/* Online Payment Modal */}
      {showPaymentModal && selectedTermForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 sm:p-8 space-y-5 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Secure Online Tuition Payment</h3>
                  <span className="text-xs text-[#94A3B8]">256-Bit SSL Encrypted Transaction</span>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentSuccessData ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-emerald-900">Payment Successfully Verified!</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    Your payment of <strong>{formatCurrency(paymentAmount)}</strong> has been credited and verified on the server.
                  </p>
                  <span className="text-xs font-mono font-bold text-emerald-900 block mt-2">
                    Official Receipt: {paymentSuccessData.receiptNumber}
                  </span>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      openReceipt(paymentSuccessData.payment?.id);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Receipt className="w-4 h-4" /> View / Print Official Receipt
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Student:</span>
                    <strong className="text-[#0F172A]">{student.firstName} {student.lastName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Fee Description:</span>
                    <strong className="text-[#0F172A]">{selectedTermForPayment.feeStructure?.name} ({selectedTermForPayment.termLabel})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Remaining Due Balance:</span>
                    <strong className="text-amber-800">{formatCurrency(selectedTermForPayment.remainingBalance)}</strong>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#64748B] block mb-1">
                    Payment Amount (INR):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">₹</span>
                    <input
                      type="number"
                      max={selectedTermForPayment.remainingBalance}
                      min={1}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" /> Server-Side Verification Active
                  </span>
                  <p>
                    All payments are signed and cryptographically verified on the backend before receipts are generated. Never enter raw card PINs.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProcessOnlinePayment}
                    disabled={initiatingPayment || verifyingPayment || paymentAmount <= 0}
                    className="px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {initiatingPayment
                      ? 'Contacting Gateway...'
                      : verifyingPayment
                      ? 'Verifying Signature...'
                      : `Confirm & Pay ${formatCurrency(paymentAmount)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {showReceiptModal && activeReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-xl p-6 sm:p-8 space-y-4 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#64748B]" /> Official Fee Receipt
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print / PDF
                </button>
                <button onClick={() => setShowReceiptModal(false)} className="text-[#94A3B8] hover:text-[#0F172A] p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] space-y-4 text-xs">
              <div className="flex justify-between border-b border-[#E2E8F0] pb-3">
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base">{activeReceipt.institute?.name}</h3>
                  <p className="text-[#64748B] text-[11px]">{activeReceipt.institute?.phone} &bull; {activeReceipt.institute?.email}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-[#006FFF] block">{activeReceipt.receiptNumber}</span>
                  <span className="text-[#94A3B8] text-[11px] block">{new Date(activeReceipt.receiptDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <span className="text-[#94A3B8] text-[10px] uppercase block font-semibold">Student</span>
                  <span className="font-bold text-[#0F172A]">{activeReceipt.student?.fullName}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[10px] uppercase block font-semibold">Admission No</span>
                  <span className="font-mono text-[#0F172A]">{activeReceipt.student?.admissionNumber}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Fee Description:</span>
                  <span className="font-semibold text-[#0F172A]">{activeReceipt.feeDetails?.feeName} ({activeReceipt.feeDetails?.termLabel})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Payment Method:</span>
                  <span className="font-semibold text-[#0F172A]">{activeReceipt.feeDetails?.method || 'ONLINE'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Total Payable:</span>
                  <span className="text-[#0F172A]">{formatCurrency(activeReceipt.feeDetails?.totalPayable)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-800 text-sm">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(activeReceipt.feeDetails?.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-800">
                  <span>Remaining Balance:</span>
                  <span>{formatCurrency(activeReceipt.feeDetails?.remainingBalanceAfter)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] text-[10px] text-[#94A3B8] text-center">
                {activeReceipt.disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
