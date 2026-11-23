import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useParentStore } from '../../store/parentStore';
import { ParentChildSummary } from '../../types/parent';
import { brandColors, theme } from '../../theme';
import {
  UserCheck,
  ChevronDown,
  Check,
  Users,
  GraduationCap,
} from 'lucide-react-native';

interface ChildSelectorCardProps {
  onChildChange?: (child: ParentChildSummary) => void;
}

export const ChildSelectorCard: React.FC<ChildSelectorCardProps> = ({ onChildChange }) => {
  const { children, selectedChild, setSelectedChild } = useParentStore();
  const [modalVisible, setModalVisible] = useState(false);

  if (!selectedChild && children.length === 0) {
    return null;
  }

  const handleSelect = (child: ParentChildSummary) => {
    setSelectedChild(child);
    setModalVisible(false);
    if (onChildChange) {
      onChildChange(child);
    }
  };

  const hasMultiple = children.length > 1;

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={hasMultiple ? 0.7 : 1}
        onPress={() => hasMultiple && setModalVisible(true)}
      >
        <View style={styles.contentRow}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {(selectedChild?.fullName || 'S')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </Text>
          </View>

          <View style={styles.infoCol}>
            <View style={styles.labelRow}>
              <Text style={styles.monitoringLabel}>MONITORING STUDENT</Text>
              {hasMultiple && (
                <View style={styles.multiBadge}>
                  <Users size={10} color="#006FFF" />
                  <Text style={styles.multiBadgeText}>{children.length} Children</Text>
                </View>
              )}
            </View>
            <Text style={styles.childName} numberOfLines={1}>
              {selectedChild?.fullName || 'Select Child'}
            </Text>
            <Text style={styles.subDetails} numberOfLines={1}>
              {selectedChild?.batchName || 'Enrolled Batch'} • Roll: {selectedChild?.admissionNumber || 'N/A'}
            </Text>
          </View>

          {hasMultiple ? (
            <View style={styles.switchButton}>
              <Text style={styles.switchText}>Switch</Text>
              <ChevronDown size={14} color="#006FFF" />
            </View>
          ) : (
            <View style={styles.singleBadge}>
              <GraduationCap size={14} color="#64748B" />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Switch Child Modal */}
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
                <Text style={styles.modalTitle}>Select Child</Text>
                <Text style={styles.modalSubtitle}>
                  Choose which student's records and progress you wish to view
                </Text>
              </View>
            </View>

            <FlatList
              data={children}
              keyExtractor={(item) => item.studentId}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => {
                const isSelected = item.studentId === selectedChild?.studentId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.childOption,
                      isSelected && styles.childOptionSelected,
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <View
                      style={[
                        styles.optionAvatar,
                        isSelected && styles.optionAvatarSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionAvatarText,
                          isSelected && styles.optionAvatarTextSelected,
                        ]}
                      >
                        {item.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </Text>
                    </View>

                    <View style={styles.optionDetails}>
                      <Text style={styles.optionName}>{item.fullName}</Text>
                      <Text style={styles.optionBatch}>
                        {item.batchName} • {item.relationship}
                      </Text>
                      <Text style={styles.optionAdmission}>
                        Adm: {item.admissionNumber}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Check size={18} color="#006FFF" />
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
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FEDC32',
    fontSize: 15,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  multiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#006FFF',
  },
  childName: {
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  switchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006FFF',
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
  childOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  childOptionSelected: {
    borderColor: '#006FFF',
    backgroundColor: '#F8FAFC',
  },
  optionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionAvatarSelected: {
    backgroundColor: '#0F172A',
  },
  optionAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  optionAvatarTextSelected: {
    color: '#FEDC32',
  },
  optionDetails: {
    flex: 1,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionBatch: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  optionAdmission: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
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
