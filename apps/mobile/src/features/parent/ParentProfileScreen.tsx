import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { useParentStore } from '../../store/parentStore';
import { getParentMyChildrenApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  User,
  Users,
  Building,
  Phone,
  Mail,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  ChevronRight,
} from 'lucide-react-native';

export const ParentProfileScreen: React.FC = () => {
  const { user, activeInstitute, logout } = useAuthStore();
  const { selectedChild, selectChildById, children } = useParentStore();

  const { data: linkedChildren = [] } = useQuery({
    queryKey: ['parent-linked-children-profile'],
    queryFn: getParentMyChildrenApi,
  });

  const handleConfirmLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Digital Guru?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Header
        title="Parent Profile"
        subtitle="Account & Connected Children"
        showBack={false}
        showLogout={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Parent Hero Card */}
        <Card style={styles.parentHeroCard}>
          <View style={styles.avatarRow}>
            <View style={styles.parentAvatar}>
              <Text style={styles.parentAvatarText}>
                {(user?.fullName || 'Parent')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </Text>
            </View>

            <View style={styles.parentDetailsCol}>
              <Text style={styles.parentName}>{user?.fullName || 'Parent'}</Text>
              <Badge text="Verified Parent" variant="success" style={styles.roleBadge} />
            </View>
          </View>

          <View style={styles.contactInfoRow}>
            {user?.phone ? (
              <View style={styles.contactItem}>
                <Phone size={13} color="#94A3B8" />
                <Text style={styles.contactText}>{user.phone}</Text>
              </View>
            ) : null}

            {user?.email ? (
              <View style={styles.contactItem}>
                <Mail size={13} color="#94A3B8" />
                <Text style={styles.contactText}>{user.email}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* Linked Children Directory */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>LINKED CHILDREN</Text>
          <Text style={styles.sectionSubCount}>
            {children.length} Enrolled Student{children.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {children.map((child) => {
          const isSelected = child.studentId === selectedChild?.studentId;

          return (
            <Card
              key={child.studentId}
              style={[styles.childCard, isSelected && styles.childCardActive]}
            >
              <View style={styles.childCardRow}>
                <View
                  style={[
                    styles.childAvatar,
                    isSelected && styles.childAvatarActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.childAvatarText,
                      isSelected && styles.childAvatarTextActive,
                    ]}
                  >
                    {child.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </Text>
                </View>

                <View style={styles.childCardInfo}>
                  <Text style={styles.childCardName}>{child.fullName}</Text>
                  <Text style={styles.childCardBatch}>
                    {child.batchName} • Adm #{child.admissionNumber}
                  </Text>
                  <Text style={styles.childCardRelation}>
                    Relationship: {child.relationship}
                  </Text>
                </View>

                {isSelected ? (
                  <Badge text="Active" variant="success" />
                ) : (
                  <TouchableOpacity
                    style={styles.switchChildBtn}
                    onPress={() => selectChildById(child.studentId)}
                  >
                    <Text style={styles.switchChildBtnText}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          );
        })}

        {/* Institute Info Card */}
        <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
          <Text style={styles.sectionTitle}>CAMPUS AFFILIATION</Text>
        </View>

        <Card style={styles.instituteCard}>
          <View style={styles.instituteRow}>
            <View style={styles.instituteIconBox}>
              <Building size={22} color="#006FFF" />
            </View>
            <View style={styles.instituteCol}>
              <Text style={styles.instituteName}>
                {activeInstitute?.name || 'Digital Guru Franchise Center'}
              </Text>
              <Text style={styles.instituteCode}>
                Campus Code: {activeInstitute?.code || 'MAIN-01'}
              </Text>
              {activeInstitute?.phone && (
                <Text style={styles.institutePhone}>
                  Support: {activeInstitute.phone}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleConfirmLogout}
          activeOpacity={0.8}
        >
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Sign Out of Parent Portal</Text>
        </TouchableOpacity>

        <Text style={styles.versionFooter}>
          Digital Guru Franchise Mobile • Version 2.0 (Phase 4)
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  parentHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  parentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(254, 220, 50, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#FEDC32',
  },
  parentAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FEDC32',
  },
  parentDetailsCol: {
    flex: 1,
  },
  parentName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  roleBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  contactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  sectionSubCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  childCard: {
    marginBottom: 10,
    padding: 14,
  },
  childCardActive: {
    borderColor: '#006FFF',
    backgroundColor: '#F8FAFC',
  },
  childCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  childAvatarActive: {
    backgroundColor: '#0F172A',
  },
  childAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  childAvatarTextActive: {
    color: '#FEDC32',
  },
  childCardInfo: {
    flex: 1,
  },
  childCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  childCardBatch: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  childCardRelation: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  switchChildBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  switchChildBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006FFF',
  },
  instituteCard: {
    marginBottom: 20,
    padding: 14,
  },
  instituteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instituteIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instituteCol: {
    flex: 1,
  },
  instituteName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  instituteCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  institutePhone: {
    fontSize: 11,
    color: '#006FFF',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  versionFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 20,
    marginBottom: 10,
  },
});
