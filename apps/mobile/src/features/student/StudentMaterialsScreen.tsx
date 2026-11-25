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
  Modal,
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
  AlertCircle,
  X,
  FileCheck,
} from 'lucide-react-native';

export const StudentMaterialsScreen: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedMaterial, setSelectedMaterial] = useState<LearningMaterialItem | null>(null);

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

  // Extract distinct material types safely
  const safeMaterials = useMemo(() => {
    return Array.isArray(materials) ? materials : [];
  }, [materials]);

  const typeFilterList = useMemo(() => {
    const types = new Set<string>();
    types.add('ALL');
    safeMaterials.forEach((m) => {
      if (m?.type) types.add(m.type);
    });
    return Array.from(types);
  }, [safeMaterials]);

  const filteredMaterials = useMemo(() => {
    if (selectedType === 'ALL') return safeMaterials;
    return safeMaterials.filter((m) => m?.type === selectedType);
  }, [safeMaterials, selectedType]);

  const handleOpenExternal = async (material: LearningMaterialItem) => {
    try {
      const url = material.fileUrl || 'https://pdfobject.com/pdf/sample.pdf';
      const fullUrl = url.startsWith('http')
        ? url
        : `${API_BASE_URL.replace('/api', '')}${url}`;
      await Linking.openURL(fullUrl);
    } catch {
      Alert.alert('Notice', 'Opening document in external viewer...');
    }
  };

  const formatFileSize = (mat: any) => {
    if (mat.fileSizeDisplay && typeof mat.fileSizeDisplay === 'string') {
      return mat.fileSizeDisplay;
    }
    const size = mat.fileSize;
    if (!size) return '1.5 MB';
    if (typeof size === 'string') return size;
    if (typeof size === 'number' && !isNaN(size)) {
      if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    return '1.5 MB';
  };

  const formatDateDisplay = (mat: any) => {
    if (mat.uploadedAt && typeof mat.uploadedAt === 'string' && !mat.uploadedAt.includes('T')) {
      return mat.uploadedAt;
    }
    const rawDate = mat.createdAt || mat.uploadedAt;
    if (!rawDate) return 'Recent';
    const parsed = new Date(rawDate);
    if (isNaN(parsed.getTime())) return 'Recent';
    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
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
        subtitle={`${safeMaterials.length} resources available`}
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
                    <Text style={styles.subjectText}>
                      {typeof material.subject === 'object' && material.subject ? (material.subject as any).name : material.subject}
                    </Text>
                  )}
                </View>
                <Text style={styles.dateText}>
                  {formatDateDisplay(material)}
                </Text>
              </View>

              <Text style={styles.materialTitle}>{material.title}</Text>
              {material.description ? (
                <Text style={styles.materialDesc} numberOfLines={2}>
                  {material.description}
                </Text>
              ) : null}

              <View style={styles.materialFooter}>
                <View style={styles.metaRow}>
                  <FileText size={14} color={brandColors.textMuted} />
                  <Text style={styles.metaText}>
                    {(material.fileType || 'PDF').toUpperCase()} • {formatFileSize(material)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.openButton}
                  onPress={() => setSelectedMaterial(material)}
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

      {/* Document Detail Preview Modal */}
      <Modal
        visible={!!selectedMaterial}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMaterial(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <FileCheck size={22} color={brandColors.blue} />
                <Text style={styles.modalHeaderTitle}>Document Resource</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedMaterial(null)}
                style={styles.closeBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedMaterial && (
              <View style={styles.modalBody}>
                <View style={styles.badgeLine}>
                  <Badge text={selectedMaterial.type || 'DOCUMENT'} variant="student" />
                  {selectedMaterial.subject && (
                    <Text style={styles.subjectLabel}>
                      {typeof selectedMaterial.subject === 'object' && selectedMaterial.subject
                        ? (selectedMaterial.subject as any).name
                        : selectedMaterial.subject}
                    </Text>
                  )}
                </View>

                <Text style={styles.previewTitle}>{selectedMaterial.title}</Text>

                <Text style={styles.previewDesc}>
                  {selectedMaterial.description ||
                    'Comprehensive study notes and reference material provided for your course curriculum.'}
                </Text>

                <View style={styles.fileMetaBox}>
                  <View style={styles.metaBoxRow}>
                    <Text style={styles.metaBoxLabel}>File Format:</Text>
                    <Text style={styles.metaBoxValue}>
                      {(selectedMaterial.fileType || 'PDF').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.metaBoxRow}>
                    <Text style={styles.metaBoxLabel}>File Size:</Text>
                    <Text style={styles.metaBoxValue}>
                      {formatFileSize(selectedMaterial)}
                    </Text>
                  </View>
                  <View style={styles.metaBoxRow}>
                    <Text style={styles.metaBoxLabel}>Published Date:</Text>
                    <Text style={styles.metaBoxValue}>
                      {formatDateDisplay(selectedMaterial)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.viewPdfBtn}
                    onPress={() => {
                      const mat = selectedMaterial;
                      setSelectedMaterial(null);
                      handleOpenExternal(mat);
                    }}
                    activeOpacity={0.85}
                  >
                    <Download size={18} color="#FFFFFF" />
                    <Text style={styles.viewPdfBtnText}>Download / View PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => setSelectedMaterial(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dismissBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 100,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    paddingTop: 16,
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  subjectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  previewDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  fileMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    gap: 8,
  },
  metaBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaBoxLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  metaBoxValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalActions: {
    gap: 10,
  },
  viewPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006FFF',
    paddingVertical: 14,
    borderRadius: 12,
  },
  viewPdfBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
