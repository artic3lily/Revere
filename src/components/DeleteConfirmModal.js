import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function DeleteConfirmModal({ visible, onCancel, onConfirm, message }) {
  const { theme, isDark } = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]}>
            <Feather name="trash-2" size={24} color={isDark ? '#ff5252' : '#d32f2f'} />
          </View>
          
          <Text style={[styles.message, { color: theme.text }]}>
            {message || "Are you sure you want to delete this item?"}
          </Text>

          <View style={styles.buttonRow}>
            {/* Cancel Button (Cross Mark) */}
            <Pressable 
              style={[styles.btn, styles.cancelBtn, { borderColor: theme.text }]} 
              onPress={onCancel}
              android_ripple={{ color: '#00000010' }}
            >
              <Text style={[styles.btnText, { color: theme.text, fontWeight: '900' }]}>✕</Text>
            </Pressable>

            {/* Confirm Button (Tick Mark) */}
            <Pressable 
              style={[styles.btn, styles.confirmBtn, { backgroundColor: theme.text }]} 
              onPress={onConfirm}
              android_ripple={{ color: '#ffffff20' }}
            >
              <Text style={[styles.btnText, { color: theme.card, fontWeight: '900' }]}>✓</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  modalCard: {
    width: width * 0.8,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  message: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'center'
  },
  btn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2
  },
  cancelBtn: {
    backgroundColor: 'transparent'
  },
  confirmBtn: {
    // text color background
  },
  btnText: {
    fontSize: 24
  }
});
