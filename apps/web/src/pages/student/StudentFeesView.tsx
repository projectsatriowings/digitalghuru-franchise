import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '@tuition/shared';
import {
  CreditCard,
  Receipt,
  Printer,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCw,
  X,
  ShieldCheck,
  ArrowRight,
  FileText,
  Calendar,
  Lock,
  Download,
} from 'lucide-react';

export const StudentFeesView: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [feeData, setFeeData] = useState<any>(null);

  // Online Checkout State
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [initiating, setInitiating] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any>(null);

  // Digital Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);

  const loadFees = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/fees/student/my-fees', { skipCache: true });
      if (res.success && res.data) {
        setFeeData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load fee information', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFees();
  }, []);

  const openReceipt = async (paymentId: string) => {
    try {
      setLoadingReceipt(true);
      setShowReceiptModal(true);
      const res = await apiFetch(`/fees/payments/${paymentId}/receipt`);
      if (res.success && res.data?.receipt) {
        setActiveReceipt(res.data.receipt);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch receipt', 'error');
      setShowReceiptModal(false);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const startCheckout = (assignment: any) => {
    setSelectedAssignment(assignment);
    setPayAmount(assignment.remainingBalance || assignment.finalAmount);
    setCheckoutError(null);
    setSuccessReceipt(null);
    setShowCheckoutModal(true);
  };

  const handlePayNow = async () => {
    if (!selectedAssignment || payAmount <= 0) return;

    try {
      setInitiating(true);
      setCheckoutError(null);

      // 1. Create order on backend
      const orderRes = await apiFetch('/fees/online/create-order', {
        method: 'POST',
        body: JSON.stringify({
          studentId: feeData.student.id,
          feeAssignmentId: selectedAssignment.id,
          amount: payAmount,
        }),
      });

      if (!orderRes.success || !orderRes.data) {
        throw new Error(orderRes.error || 'Failed to initialize payment order');
      }

      const orderData = orderRes.data;

      // 2. Production Razorpay Checkout or Simulated Verification
      if (typeof (window as any).Razorpay !== 'undefined' && !orderData.isSimulated) {
        const options = {
          key: orderData.keyId,
          amount: Math.round(orderData.amount * 100),
          currency: orderData.currency || 'INR',
          name: 'DigitalGhuru Franchise Center',
          description: `Fee: ${orderData.feeName} (${orderData.termLabel || 'Tuition'})`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
          },
          prefill: {
            name: `${feeData.student.firstName} ${feeData.student.lastName}`,
          },
          theme: {
            color: '#006FFF',
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setCheckoutError(resp.error?.description || 'Payment was declined by your bank');
        });
        rzp.open();
      } else {
        // Development Sandbox / Verified Simulated Gateway Flow
        const simPaymentId = `pay_sim_${Date.now()}`;
        const simSignature = `sig_sim_${Date.now()}`;
        await verifyPayment(orderData.orderId, simPaymentId, simSignature);
      }
    } catch (err: any) {
      console.error('[Payment Checkout Error]', err);
      setCheckoutError(err.message || 'Payment initiation failed');
    } finally {
      setInitiating(false);
    }
  };

  const verifyPayment = async (orderId: string, paymentId: string, signature: string) => {
    try {
      setVerifying(true);
      const res = await apiFetch('/fees/online/verify-payment', {
        method: 'POST',
        body: JSON.stringify({ orderId, paymentId, signature }),
      });

      if (res.success && res.data) {
        setSuccessReceipt(res.data);
        showToast('Payment successful & official receipt generated!', 'success');
        loadFees();
      } else {
        throw new Error(res.error || 'Payment signature verification failed');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading && !feeData) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs">
        <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#006FFF]" />
        Loading your fee invoices and payment statements...
      </div>
    );
  }

  const student = feeData?.student || {};
  const summary = feeData?.summary || { totalFees: 0, totalPaid: 0, totalPending: 0 };
  const assignments = feeData?.assignments || [];

  // Extract all payment history across assignments
  const allPayments: any[] = [];
  assignments.forEach((a: any) => {
    if (a.payments && Array.isArray(a.payments)) {
      a.payments.forEach((p: any) => {
        allPayments.push({
          ...p,
          feeName: a.feeStructure?.name,
          termLabel: a.termLabel,
        });
      });
    }
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FEDC32]">
            <CreditCard className="w-4 h-4" /> Centralized Student Fee Portal
          </div>
          <h2 className="text-xl font-black font-display mt-1">
            Student Fee Invoices & Payment Receipts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Campus: <span className="text-white font-medium">{student.branchName}</span> | Admission No:{' '}
            <span className="font-mono text-white">{student.admissionNumber}</span>
          </p>
        </div>

        <button
          onClick={loadFees}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold self-start md:self-auto cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Total Course Fee</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {formatCurrency(summary.totalFees)}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Total assigned tuition obligations</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">Fees Paid to Date</span>
          <span className="text-2xl font-black text-emerald-800 mt-1 block">
            {formatCurrency(summary.totalPaid)}
          </span>
          <span className="text-xs text-emerald-600 mt-1 block">Verified authoritative payments</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">Outstanding Balance</span>
          <span className="text-2xl font-black text-amber-900 mt-1 block">
            {formatCurrency(summary.totalPending)}
          </span>
          <span className="text-xs text-amber-600 mt-1 block">
            {summary.totalPending <= 0 ? 'All fees settled' : 'Payment due'}
          </span>
        </div>
      </div>

      {/* Fee Invoices & Term Installments */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">Fee Invoices & Installments</h3>
            <p className="text-xs text-slate-500">Pay via Centralized DigitalGhuru Razorpay Checkout (UPI, Card, Net Banking).</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Fee Structure / Course</th>
                <th className="px-4 py-3">Term / Installment</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Assessed Amount</th>
                <th className="px-4 py-3">Paid Amount</th>
                <th className="px-4 py-3">Remaining Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No fee assignments found for your student profile.
                  </td>
                </tr>
              ) : (
                assignments.map((a: any) => {
                  const isPaid = a.calculatedStatus === 'PAID';
                  const isPending = a.remainingBalance > 0;

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {a.feeStructure?.name || 'Course Fee'}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          Academic Year: {a.academicYear || a.feeStructure?.academicYear || '2026-27'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {a.termLabel || 'Standard Installment'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(a.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatCurrency(a.finalAmount)}
                        {Number(a.discountAmount) > 0 && (
                          <span className="block text-[10px] text-emerald-600">
                            -₹{Number(a.discountAmount)} concession
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {formatCurrency(a.netPaid)}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {formatCurrency(a.remainingBalance)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.calculatedStatus === 'PARTIALLY_PAID'
                              ? 'bg-blue-100 text-blue-800'
                              : a.calculatedStatus === 'OVERDUE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {a.calculatedStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending ? (
                          <button
                            onClick={() => startCheckout(a)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold text-xs shadow-sm shadow-[#006FFF]/20 transition-all cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pay Now
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                            <CheckCircle className="w-4 h-4 text-emerald-600" /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Payment History & Digital Receipts */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">Payment Receipts & Transaction History</h3>
            <p className="text-xs text-slate-500">Official digital receipts with transaction references.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Receipt Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Amount Paid</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Gateway Ref</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                allPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {new Date(p.paidAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {p.receiptNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.feeName} <span className="text-slate-400">({p.termLabel || 'Installment'})</span>
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900">
                      {formatCurrency(p.amountPaid)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-700">
                        {p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {p.transactionReference || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        SUCCESS
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openReceipt(p.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" /> Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CHECKOUT MODAL (RAZORPAY INTEGRATION) */}
      {/* ========================================================================= */}
      {showCheckoutModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Pay Student Fees</h3>
                  <span className="text-[11px] text-slate-500">Centralized DigitalGhuru Gateway</span>
                </div>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-slate-700 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {successReceipt ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 font-display">Payment Successful!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Your fee payment has been officially recorded and credited.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-1">
                  <div>
                    <span className="text-slate-400">Receipt No:</span>{' '}
                    <span className="font-mono font-bold text-slate-900">{successReceipt.receiptNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Amount Paid:</span>{' '}
                    <span className="font-bold text-emerald-700">{formatCurrency(payAmount)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCheckoutModal(false);
                    if (successReceipt.payment?.id) openReceipt(successReceipt.payment.id);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                >
                  View Digital Receipt
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fee Item:</span>
                    <span className="font-bold text-slate-800">{selectedAssignment.feeStructure?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Term:</span>
                    <span className="font-semibold text-slate-800">{selectedAssignment.termLabel || 'Installment'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Assessed:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(selectedAssignment.finalAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="font-bold text-slate-700">Remaining Balance:</span>
                    <span className="font-black text-[#006FFF]">{formatCurrency(selectedAssignment.remainingBalance)}</span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedAssignment.remainingBalance}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Math.min(selectedAssignment.remainingBalance, Math.max(1, parseFloat(e.target.value) || 0)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold text-sm"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    You can pay the full remaining balance or enter a partial payment amount.
                  </span>
                </div>

                {checkoutError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>256-bit SSL encrypted & secure Razorpay Checkout</span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCheckoutModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={initiating || verifying || payAmount <= 0}
                    onClick={handlePayNow}
                    className="flex-1 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#006FFF]/20 cursor-pointer"
                  >
                    {initiating || verifying ? (
                      <RotateCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    Pay {formatCurrency(payAmount)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIGITAL PAYMENT RECEIPT MODAL */}
      {/* ========================================================================= */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="font-bold text-xs text-slate-700">Digital Payment Receipt</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/50"
                  title="Print Receipt"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {loadingReceipt ? (
                <div className="py-12 text-center text-slate-400">
                  <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#006FFF]" />
                  Loading receipt...
                </div>
              ) : activeReceipt ? (
                <>
                  <div className="text-center border-b border-slate-200 pb-4 space-y-1">
                    <h3 className="font-black text-slate-900 text-base font-display">DIGITALGHURU EDUCATION</h3>
                    <p className="text-slate-500 text-[11px]">{activeReceipt.institute?.name || 'Main Center Campus'}</p>
                    <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full text-[11px] border border-emerald-200 mt-1">
                      Payment Confirmed (SUCCESS)
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-400 block">Receipt No:</span>
                      <span className="font-mono font-bold text-slate-900">{activeReceipt.receiptNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Payment Date:</span>
                      <span className="font-semibold">{new Date(activeReceipt.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Student Name:</span>
                      <span className="font-bold text-slate-900">{activeReceipt.student?.firstName} {activeReceipt.student?.lastName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Admission Number:</span>
                      <span className="font-mono font-semibold">{activeReceipt.student?.admissionNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Payment Method:</span>
                      <span className="font-semibold uppercase">{activeReceipt.method}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Gateway Ref:</span>
                      <span className="font-mono text-[11px]">{activeReceipt.transactionReference || '—'}</span>
                    </div>
                  </div>

                  <div className="border-t border-b border-slate-200 py-3 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 block">{activeReceipt.feeAssignment?.feeStructure?.name || 'Tuition Fee'}</span>
                      <span className="text-slate-400 text-[11px]">{activeReceipt.feeAssignment?.termLabel || 'Installment'}</span>
                    </div>
                    <span className="text-lg font-black text-slate-900">{formatCurrency(activeReceipt.amountPaid)}</span>
                  </div>

                  <div className="text-center text-slate-400 text-[10px] pt-2">
                    This is a computer-generated digital receipt and requires no physical signature.
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StudentFeesView;
