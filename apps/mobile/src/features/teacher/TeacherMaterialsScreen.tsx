import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { BatchSelectorCard } from '../../components/teacher/BatchSelectorCard';
import { useTeacherStore } from '../../store/teacherStore';
import { getTeacherMaterialsApi, deleteTeacherMaterialApi } from '../../api/teacher.api';
import { TeacherMaterialItem } from '../../types/teacher';
import { brandColors, theme } from '../../theme';
import {
  FolderOpen,
  FileText,
  File,
  Image as ImageIcon,
  Download,
  Trash2,
  Plus,
  Search,
  AlertCircle,
  ExternalLink,
} from 'lucide-react-native';

export const TeacherMaterialsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { selectedBatch } = useTeacherStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const {
    data: materials = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-materials', selectedBatch?.id],
    queryFn: () => getTeacherMaterialsApi(selectedBatch?.id),
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTeacherMaterialApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-materials'] });
      Alert.alert('Material Deleted', 'The study resource has been removed.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete material.');
    },
  });

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete Material',
      `Are you sure you want to delete "${title}"? Students will no longer be able to access it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]
    );
  };

  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (selectedType !== 'ALL') {
      list = list.filter((m) => m.fileType?.toUpperCase() === selectedType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.subject?.name?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [materials, selectedType, searchQuery]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'PDF':
        return <FileText size={20} color="#DC2626" />;
      case 'IMAGE':
        return <ImageIcon size={20} color="#0284C7" />;
      default:
        return <File size={20} color="#64748B" />;
    }
  };

  return (
    <ScreenContainer>
      <Header
        title="Learning Materials"
        subtitle={selectedBatch ? selectedBatch.name : 'Class Resources'}
        rightElement={
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => navigation.navigate('UploadMaterial')}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor="#FE4D01"
            colors={['#FE4D01']}
          />
        }
      >
        <BatchSelectorCard />

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents or subjects..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* File Type Filter Tabs */}
        <View style={styles.typeRow}>
          {['ALL', 'PDF', 'DOCUMENT', 'IMAGE'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typePill, selectedType === t && styles.typePillActive]}
              onPress={() => setSelectedType(t)}
            >
              <Text style={[styles.typeText, selectedType === t && styles.typeTextActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Loading study materials...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Failed to Load Materials</Text>
            <Button title="Retry" onPress={() => refetch()} variant="outline" size="sm" />
          </Card>
        ) : filteredMaterials.length === 0 ? (
          <Card style={styles.emptyCard}>
            <FolderOpen size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Materials Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'No materials matched your search criteria.'
                : 'No course materials uploaded for this class yet.'}
            </Text>
            <Button
              title="Upload First Document"
              onPress={() => navigation.navigate('UploadMaterial')}
              style={styles.emptyBtn}
            />
          </Card>
        ) : (
          filteredMaterials.map((item) => {
            const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <Card key={item.id} style={styles.materialCard}>
                <View style={styles.materialHeader}>
                  <View style={styles.iconCircle}>{getTypeIcon(item.fileType)}</View>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialTitle}>{item.title}</Text>
                    <View style={styles.metaRow}>
                      <Badge
                        label={item.subject?.name || 'General'}
                        variant="info"
                        size="sm"
                      />
                      <Text style={styles.metaText}>{formattedDate}</Text>
                      {item.fileSize ? (
                        <Text style={styles.metaText}>{formatFileSize(item.fileSize)}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.materialDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {/* Actions row */}
                <View style={styles.actionRow}>
                  {item.fileUrl ? (
                    <TouchableOpacity
                      style={styles.openBtn}
                      onPress={() => Linking.openURL(item.fileUrl)}
                    >
                      <Download size={15} color="#0A2540" />
                      <Text style={styles.openBtnText}>Open Document</Text>
                      <ExternalLink size={13} color="#0A2540" />
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id, item.title)}
                  >
                    <Trash2 size={16} color="#DC2626" />
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
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE4D01',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 44,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  typePillActive: {
    backgroundColor: '#0A2540',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  errorCard: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyBtn: {
    marginTop: 4,
  },
  materialCard: {
    marginBottom: 12,
    padding: 14,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  materialDesc: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  openBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A2540',
  },
  deleteBtn: {
    padding: 7,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
});
