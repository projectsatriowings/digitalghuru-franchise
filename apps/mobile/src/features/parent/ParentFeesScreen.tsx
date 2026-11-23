import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ChildSelectorCard } from '../../components/parent/ChildSelectorCard';
import { useParentStore } from '../../store/parentStore';
import { getParentFeeStatementApi, getParentPaymentsApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Calendar,
  ArrowUpRight,
} from 'lucide-react-native';

export const ParentFeesScreen: React.FC = () => {
  const { selectedChild } = useParentStore();
  const [activeTab, setActiveTab] = useState<'STATEMENT' | 'HISTORY'>('STATEMENT');
  const studentId = selectedChild?.studentId || '';

  const {
    data: feeStatement,
    isLoading: isLoadingStatement,
    isError: isErrorStatement,
    refetch: refetchStatement,
    isRefetching: isRefetchingStatement,
  } = useQuery({
    queryKey: ['parent-fee-statement', studentId],
    queryFn: () => getParentFeeStatementApi(studentId),
    enabled: !!studentId,
  });

  const {
    data: payments = [],
    isLoading: isLoadingPayments,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ['parent-fee-payments', studentId],
    queryFn: () => getParentPaymentsApi(studentId),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(() => {
    refetchStatement();
    refetchPayments();
  }, [refetchStatement, refetchPayments]);

  const summary = feeStatement?.summary;
  const statementItems = feeStatement?.statementItems || [];

  const netOutstanding = summary?.netOutstanding ?? 0;
  const totalPayable = summary?.totalPayable ?? 0;
  const totalPaid = summary?.totalPaid ?? 0;

  return (
    <ScreenContainer>
      <Header
        title="Fees & Accounts"
        subtitle="Itemized Fee Statement & Payment Receipts"
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingStatement}
            onRefresh={onRefresh}
            colors={[brandColors.navy]}
          />
        }
      >
        <ChildSelectorCard />

        {/* Financial Summary Hero Banner */}
        <Card style={styles.heroBanner}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroLabel}>NET OUTSTANDING BALANCE</Text>
              <Text style={styles.heroAmount}>
                {netOutstanding > 0 ? `₹${netOutstanding.toLocaleString('en-IN')}` : '₹0.00'}
              </Text>
            </View>

            <Badge
              text={netOutstanding > 0 ? 'Dues Pending' : 'Paid in Full'}
              variant={netOutstanding > 0 ? 'warning' : 'success'}
            />
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Total Invoiced</Text>
              <Text style={styles.heroStatVal}>
                ₹{totalPayable.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.statVerticalDivider} />

            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Total Received</Text>
              <Text style={[styles.heroStatVal, { color: '#10B981' }]}>
                ₹{totalPaid.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </Card>

        {/* View Switcher Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'STATEMENT' && styles.tabButtonActive]}
            onPress={() => setActiveTab('STATEMENT')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'STATEMENT' && styles.tabButtonTextActive,
              ]}
            >
              Fee Statement ({statementItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'HISTORY' && styles.tabButtonActive]}
            onPress={() => setActiveTab('HISTORY')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'HISTORY' && styles.tabButtonTextActive,
              ]}
            >
              Payment History ({payments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'STATEMENT' ? (
          isLoadingStatement ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={brandColors.navy} />
              <Text style={styles.loadingText}>Fetching statement...</Text>
            </View>
          ) : isErrorStatement ? (
            <Card style={styles.errorCard}>
              <AlertCircle size={36} color={brandColors.error} />
              <Text style={styles.errorTitle}>Unable to Load Statement</Text>
              <Text style={styles.errorDesc}>
                Could not retrieve fee dues. Please try refreshing.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetchStatement()}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </Card>
          ) : statementItems.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Receipt size={36} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Statement Items</Text>
              <Text style={styles.emptyText}>
                No fee items or installments have been invoiced yet.
              </Text>
            </Card>
          ) : (
            statementItems.map((item) => {
              const isPaid = item.status === 'PAID';
              const isPartial = item.status === 'PARTIALLY_PAID';

              return (
                <Card key={item.id} style={styles.statementCard}>
                  <View style={styles.statementRow}>
                    <View style={styles.statementInfoCol}>
                      <Text style={styles.feeStructureTitle}>
                        {item.feeStructure?.name || 'Academic Fee'}
                      </Text>
                      <Text style={styles.feeDueDate}>
                        Due Date: {new Date(item.dueDate).toLocaleDateString()}
                      </Text>
                      <View style={styles.amountBreakdownRow}>
                        <Text style={styles.amountBreakdownText}>
                          Amount: ₹{item.amount.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.amountBreakdownText}>
                          • Paid: ₹{item.paidAmount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.statementBalanceCol}>
                      <Text style={styles.balanceAmount}>
                        ₹{item.balance.toLocaleString('en-IN')}
                      </Text>
                      <Badge
                        text={
                          isPaid
                            ? 'Settled'
                            : isPartial
                            ? 'Partial'
                            : 'Pending'
                        }
                        variant={isPaid ? 'success' : isPartial ? 'warning' : 'error'}
                        style={styles.statusBadge}
                      />
                    </View>
                  </View>
                </Card>
              );
            })
          )
        ) : (
          /* Payment Receipts & Transaction Log */
          isLoadingPayments ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={brandColors.navy} />
              <Text style={styles.loadingText}>Fetching payment history...</Text>
            </View>
          ) : payments.length === 0 ? (
            <Card style={styles.emptyCard}>
              <CreditCard size={36} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Payments Recorded</Text>
              <Text style={styles.emptyText}>
                No online or offline fee receipts have been recorded for this student.
              </Text>
            </Card>
          ) : (
            payments.map((payment) => (
              <Card key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentReceiptCol}>
                    <Text style={styles.receiptNumber}>
                      Receipt #{payment.receiptNumber || payment.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {new Date(payment.paymentDate).toLocaleDateString()} • {payment.paymentMode}
                    </Text>
                    {payment.transactionRef ? (
                      <Text style={styles.transactionRefText}>
                        Ref: {payment.transactionRef}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.paymentAmountCol}>
                    <Text style={styles.paidAmountText}>
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </Text>
                    <Badge text="Success" variant="success" style={styles.statusBadge} />
                  </View>
                </View>
              </Card>
            ))
          )
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorCard: {
    padding: 24,
    alignItems: 'center',
    marginVertical: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  errorDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heroBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FEDC32',
    marginTop: 2,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 14,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  heroStatVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statVerticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    fontWeight: '700',
    color: '#0F172A',
  },
  statementCard: {
    marginBottom: 10,
    padding: 14,
  },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  statementInfoCol: {
    flex: 1,
    paddingRight: 12,
  },
  feeStructureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  feeDueDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  amountBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  amountBreakdownText: {
    fontSize: 11,
    color: '#475569',
  },
  statementBalanceCol: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    marginTop: 4,
  },
  paymentCard: {
    marginBottom: 10,
    padding: 14,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentReceiptCol: {
    flex: 1,
  },
  receiptNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  transactionRefText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  paymentAmountCol: {
    alignItems: 'flex-end',
  },
  paidAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
});
