import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ChildSelectorCard } from '../../components/parent/ChildSelectorCard';
import { useParentStore } from '../../store/parentStore';
import { getParentMaterialsApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  BookOpen,
  FileText,
  Download,
  AlertCircle,
  ExternalLink,
  Calendar,
  Layers,
} from 'lucide-react-native';

export const ParentMaterialsScreen: React.FC = () => {
  const { selectedChild } = useParentStore();
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

  const {
    data: materials = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-child-materials', selectedChild?.studentId],
    queryFn: () => getParentMaterialsApi(),
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Extract unique subjects
  const subjects = ['ALL', ...Array.from(new Set(materials.map((m) => (typeof m.subject === 'string' ? m.subject : m.subject?.name)).filter(Boolean)))];

  const filteredMaterials = materials.filter((m) => {
    if (selectedSubject === 'ALL') return true;
    const subName = typeof m.subject === 'string' ? m.subject : m.subject?.name;
    return subName === selectedSubject;
  });

  const handleOpenMaterial = (url?: string) => {
    if (!url) {
      Alert.alert('Notice', 'No direct download link available for this document.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open the file link.');
    });
  };

  return (
    <ScreenContainer>
      <Header
        title="Learning Materials"
        subtitle="Syllabus, Notes & Study Handouts"
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[brandColors.navy]}
          />
        }
      >
        <ChildSelectorCard />

        {/* Subject Filter Pills */}
        {subjects.length > 2 && (
          <View style={styles.subjectsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subjectsRow}
            >
              {subjects.map((sub) => {
                const isSelected = selectedSubject === sub;
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subjectPill, isSelected && styles.subjectPillActive]}
                    onPress={() => setSelectedSubject(sub as string)}
                  >
                    <Text
                      style={[
                        styles.subjectPillText,
                        isSelected && styles.subjectPillTextActive,
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={brandColors.navy} />
            <Text style={styles.loadingText}>Fetching study materials...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Materials</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve study files for this class. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : filteredMaterials.length === 0 ? (
          <Card style={styles.emptyCard}>
            <BookOpen size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Materials Available</Text>
            <Text style={styles.emptyText}>
              There are no uploaded handouts or notes for this subject yet.
            </Text>
          </Card>
        ) : (
          filteredMaterials.map((item) => {
            return (
              <Card key={item.id} style={styles.materialCard}>
                <View style={styles.materialRow}>
                  <View style={styles.iconBox}>
                    <FileText size={22} color="#006FFF" />
                  </View>

                  <View style={styles.materialInfoCol}>
                    <Text style={styles.materialTitle}>{item.title}</Text>
                    <Text style={styles.materialSubject}>
                      {typeof item.subject === 'string' ? item.subject : item.subject?.name || 'General Handout'}
                    </Text>

                    {item.description ? (
                      <Text style={styles.materialDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}

                    <View style={styles.metaRow}>
                      <Badge
                        text={item.fileType?.toUpperCase() || 'DOCUMENT'}
                        variant="info"
                      />
                      {item.createdAt && (
                        <Text style={styles.createdDate}>
                          Uploaded {new Date(item.createdAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.openBtn}
                    onPress={() => handleOpenMaterial(item.fileUrl || undefined)}
                    accessibilityLabel="Open document"
                  >
                    <Download size={18} color="#006FFF" />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
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
  subjectsContainer: {
    marginBottom: 14,
  },
  subjectsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subjectPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subjectPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  subjectPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  subjectPillTextActive: {
    color: '#FEDC32',
    fontWeight: '700',
  },
  materialCard: {
    marginBottom: 10,
    padding: 12,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  materialInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  materialSubject: {
    fontSize: 12,
    fontWeight: '600',
    color: '#006FFF',
    marginTop: 1,
  },
  materialDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  createdDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  openBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
