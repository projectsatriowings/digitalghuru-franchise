import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { brandColors, theme } from '../../theme';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';

export interface DateTimeSelectorProps {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  mode?: 'date' | 'time' | 'datetime';
  title?: string;
  style?: StyleProp<ViewStyle>;
}

export const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  visible,
  value,
  onSelect,
  onClose,
  title = 'Select Date',
  style,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(value || new Date());

  // Generate 7 days around current
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -3; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const dates = generateDates();

  const handleConfirm = () => {
    onSelect(selectedDate);
    onClose();
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <GlassCard style={[styles.card, style]} padding="lg">
          <Text style={styles.title}>{title}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScroll}
          >
            {dates.map((date, idx) => {
              const selected = isSameDay(date, selectedDate);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = date.getDate();
              const month = date.toLocaleDateString('en-US', { month: 'short' });

              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.datePill,
                    selected && styles.datePillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayName,
                      selected && styles.dayNameSelected,
                    ]}
                  >
                    {dayName}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      selected && styles.dayNumSelected,
                    ]}
                  >
                    {dayNum}
                  </Text>
                  <Text
                    style={[
                      styles.month,
                      selected && styles.monthSelected,
                    ]}
                  >
                    {month}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.buttonRow}>
            <GlassButton
              label="Cancel"
              onPress={onClose}
              variant="outline"
              size="md"
              style={styles.cancelBtn}
            />
            <GlassButton
              label="Select"
              onPress={handleConfirm}
              variant="primary"
              size="md"
              style={styles.confirmBtn}
            />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginBottom: 16,
  },
  dateScroll: {
    paddingVertical: 8,
    gap: 8,
  },
  datePill: {
    width: 60,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: brandColors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  datePillSelected: {
    backgroundColor: brandColors.blue,
    borderColor: brandColors.blue,
    ...theme.shadows.sm,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  dayNameSelected: {
    color: '#FFFFFF',
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '800',
    color: brandColors.textPrimary,
    marginVertical: 2,
  },
  dayNumSelected: {
    color: '#FFFFFF',
  },
  month: {
    fontSize: 10,
    color: brandColors.textMuted,
  },
  monthSelected: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 1,
  },
});
