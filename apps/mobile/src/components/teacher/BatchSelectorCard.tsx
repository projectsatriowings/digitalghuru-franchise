import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useTeacherStore } from '../../store/teacherStore';
import { TeacherBatchItem } from '../../types/teacher';
import { brandColors, theme } from '../../theme';
import {
  BookOpen,
  ChevronDown,
  Check,
  Users,
  GraduationCap,
  Layers,
} from 'lucide-react-native';

interface BatchSelectorCardProps {
  onBatchChange?: (batch: TeacherBatchItem) => void;
}

export const BatchSelectorCard: React.FC<BatchSelectorCardProps> = ({ onBatchChange }) => {
  const { batches, selectedBatch, setSelectedBatch } = useTeacherStore();
  const [modalVisible, setModalVisible] = useState(false);

  if (!selectedBatch && batches.length === 0) {
    return null;
  }

  const handleSelect = (batch: TeacherBatchItem) => {
    setSelectedBatch(batch);
    setModalVisible(false);
    if (onBatchChange) {
      onBatchChange(batch);
    }
  };

  const hasMultiple = batches.length > 1;

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={hasMultiple ? 0.7 : 1}
        onPress={() => hasMultiple && setModalVisible(true)}
      >
        <View style={styles.contentRow}>
          <View style={styles.iconContainer}>
            <Layers size={22} color="#FE4D01" />
          </View>

          <View style={styles.infoCol}>
            <View style={styles.labelRow}>
              <Text style={styles.monitoringLabel}>ACTIVE CLASS BATCH</Text>
              {hasMultiple && (
                <View style={styles.multiBadge}>
                  <Text style={styles.multiBadgeText}>{batches.length} Assigned</Text>
                </View>
              )}
            </View>
            <Text style={styles.batchName} numberOfLines={1}>
              {selectedBatch?.name || 'Select Batch'}
            </Text>
            <Text style={styles.subDetails} numberOfLines={1}>
              Code: {selectedBatch?.code || '—'} {selectedBatch?.academicYear ? `• ${selectedBatch.academicYear}` : ''}
            </Text>
          </View>

          {hasMultiple ? (
            <View style={styles.switchButton}>
              <Text style={styles.switchText}>Switch</Text>
              <ChevronDown size={14} color="#FE4D01" />
            </View>
          ) : (
            <View style={styles.singleBadge}>
              <GraduationCap size={16} color="#64748B" />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Switch Batch Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Assigned Batch</Text>
                <Text style={styles.modalSubtitle}>
                  Choose which class roster and homework you wish to manage
                </Text>
              </View>
            </View>

            <FlatList
              data={batches}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedBatch?.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.batchOption,
                      isSelected && styles.batchOptionSelected,
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <View
                      style={[
                        styles.optionIconBox,
                        isSelected && styles.optionIconBoxSelected,
                      ]}
                    >
                      <Layers size={18} color={isSelected ? '#FE4D01' : '#64748B'} />
                    </View>

                    <View style={styles.optionDetails}>
                      <Text style={styles.optionName}>{item.name}</Text>
                      <Text style={styles.optionCode}>
                        Code: {item.code} {item.academicYear ? `• Year: ${item.academicYear}` : ''}
                      </Text>
                      {item.schedule && (
                        <Text style={styles.optionSchedule} numberOfLines={1}>
                          {item.schedule}
                        </Text>
                      )}
                    </View>

                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Check size={18} color="#FE4D01" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  infoCol: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  monitoringLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  multiBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  multiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FE4D01',
  },
  batchName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subDetails: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  switchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FE4D01',
  },
  singleBadge: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  batchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  batchOptionSelected: {
    borderColor: '#FE4D01',
    backgroundColor: '#FFF7ED',
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconBoxSelected: {
    backgroundColor: '#FFEDD5',
  },
  optionDetails: {
    flex: 1,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionCode: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  optionSchedule: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  checkIcon: {
    marginLeft: 8,
  },
  closeButton: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
