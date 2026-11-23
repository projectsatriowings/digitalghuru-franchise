import React, { useState, useMemo, useCallback } from 'react';
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
import { brandColors, theme } from '../../theme';
import { getStudentMaterialsApi } from '../../api/student.api';
import { LearningMaterialItem } from '../../types/student';
import { API_BASE_URL } from '../../api/client';
import {
  BookOpen,
  FileText,
  Download,
  ExternalLink,
  Search,
  AlertCircle,
  FileCheck2,
} from 'lucide-react-native';

export const StudentMaterialsScreen: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const {
    data: materials = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['student-materials'],
    queryFn: () => getStudentMaterialsApi(),
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Extract distinct material types
  const typeFilterList = useMemo(() => {
    const types = new Set<string>();
    types.add('ALL');
    materials.forEach((m) => {
      if (m.type) types.add(m.type);
    });
    return Array.from(types);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    if (selectedType === 'ALL') return materials;
    return materials.filter((m) => m.type === selectedType);
  }, [materials, selectedType]);

  const handleOpenMaterial = async (material: LearningMaterialItem) => {
    try {
      if (material.fileUrl) {
        // Construct full URL if relative
        const fullUrl = material.fileUrl.startsWith('http')
          ? material.fileUrl
          : `${API_BASE_URL.replace('/api', '')}${material.fileUrl}`;
        const canOpen = await Linking.canOpenURL(fullUrl);
        if (canOpen) {
          await Linking.openURL(fullUrl);
        } else {
          Alert.alert('Notice', 'Cannot open file URL directly on this device.');
        }
      } else {
        Alert.alert('Material Details', material.description || 'No direct attachment available.');
      }
    } catch {
      Alert.alert('Error', 'Unable to open material link.');
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Study Materials" subtitle="Loading course documents..." />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading study materials...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <Header title="Study Materials" subtitle="Course documents" />
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Failed to Load Materials</Text>
          <Text style={styles.errorSubtitle}>
            Unable to retrieve course files. Tap retry to reload.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title="Study Materials"
        subtitle={`${materials.length} resources available`}
      />

      {/* Type Filter Pills */}
      {typeFilterList.length > 1 && (
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {typeFilterList.map((type) => {
              const isSelected = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterPill, isSelected && styles.filterPillSelected]}
                  onPress={() => setSelectedType(type)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isSelected && styles.filterTextSelected,
                    ]}
                  >
                    {type === 'ALL' ? 'All Types' : type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[brandColors.blue]}
            tintColor={brandColors.blue}
          />
        }
      >
        {filteredMaterials.length === 0 ? (
          <Card style={styles.emptyCard}>
            <BookOpen size={40} color={brandColors.textMuted} />
            <Text style={styles.emptyTitle}>No Materials Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedType === 'ALL'
                ? 'Your instructors have not published any learning materials for your enrolled classes yet.'
                : `No materials matching type "${selectedType}".`}
            </Text>
          </Card>
        ) : (
          filteredMaterials.map((material) => (
            <Card key={material.id} style={styles.materialCard}>
              <View style={styles.materialHeader}>
                <View style={styles.typeBadgeRow}>
                  <Badge text={material.type || 'DOCUMENT'} variant="student" />
                  {material.subject && (
                    <Text style={styles.subjectText}>{material.subject}</Text>
                  )}
                </View>
                <Text style={styles.dateText}>
                  {new Date(material.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>

              <Text style={styles.materialTitle}>{material.title}</Text>
              {material.description ? (
                <Text style={styles.materialDesc}>{material.description}</Text>
              ) : null}

              <View style={styles.materialFooter}>
                <View style={styles.metaRow}>
                  <FileText size={14} color={brandColors.textMuted} />
                  <Text style={styles.metaText}>
                    {material.mimeType ? material.mimeType.split('/')[1]?.toUpperCase() : 'PDF'}
                    {material.fileSize ? ` • ${formatFileSize(material.fileSize)}` : ''}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.openButton}
                  onPress={() => handleOpenMaterial(material)}
                  activeOpacity={0.8}
                >
                  <ExternalLink size={14} color={brandColors.white} />
                  <Text style={styles.openButtonText}>Open Document</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: brandColors.textSecondary,
  },
  errorTitle: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  errorSubtitle: {
    fontSize: theme.typography.caption.fontSize,
    color: brandColors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: brandColors.blue,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: brandColors.white,
    fontWeight: '600',
  },
  filterContainer: {
    backgroundColor: brandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.borderLight,
    paddingVertical: theme.spacing.xs,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.md,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: brandColors.surfaceMuted,
  },
  filterPillSelected: {
    backgroundColor: brandColors.blue,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  filterTextSelected: {
    color: brandColors.white,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: brandColors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: brandColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  materialCard: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  dateText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  materialTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginBottom: 4,
  },
  materialDesc: {
    fontSize: 13,
    color: brandColors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  materialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: brandColors.borderLight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: brandColors.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openButtonText: {
    color: brandColors.white,
    fontSize: 11,
    fontWeight: '600',
  },
});
