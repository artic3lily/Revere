import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Modal, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('targetUserId', '==', uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (e) => {
      console.log('Notif error', e);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const confirmShipment = async (notif) => {
    try {
      const batch = writeBatch(db);
      
      batch.update(doc(db, 'notifications', notif.id), { isShipped: true });
      
      if (notif.orderId) {
        batch.update(doc(db, 'orders', notif.orderId), { status: 'shipped' });
      }

      if (notif.buyerId) {
        const buyerNotifRef = doc(collection(db, 'notifications'));
        batch.set(buyerNotifRef, {
          targetUserId: notif.buyerId,
          type: 'order_shipped',
          title: 'Order Confirmed! 🚚',
          body: 'The seller has confirmed your order and it is now on the way!',
          orderId: notif.orderId,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
    } catch (e) {
      console.log('Error confirming shipment', e);
    }
  };

  const handlePress = async (notif) => {
    if (!notif.read) {
      updateDoc(doc(db, 'notifications', notif.id), { read: true }).catch(console.log);
    }
    if (notif.type === 'order_received' || notif.type === 'order_shipped') {
      navigation.navigate('OrderDetails', { orderId: notif.orderId });
    } else if (notif.type === 'welcome') {
      setSelectedNotif(notif);
    }
  };

  if (loading) return <View style={[styles.screen, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>No notifications yet.</Text>}
        renderItem={({ item }) => (
          <Pressable 
            style={[styles.card, { backgroundColor: item.read ? theme.bg : (theme.primary ? theme.primary + '11' : '#f0f0f0'), borderColor: theme.border }]}
            onPress={() => handlePress(item)}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.card }]}>
              <Feather name={item.type === 'order_received' ? "shopping-bag" : "bell"} size={20} color={theme.primary || '#111'} />
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              {item.type !== 'welcome' && <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>}
              <Text numberOfLines={2} style={[styles.body, { color: item.type === 'welcome' ? theme.text : theme.textSecondary, lineHeight: item.type === 'welcome' ? 16 : 18 }]}>{item.body}</Text>
            </View>
            
            {item.type === 'order_received' && !item.isShipped && (
               <Pressable 
                 style={styles.checkCirc}
                 onPress={() => confirmShipment(item)}
               >
                 <Feather name="check" size={16} color="#fff" />
               </Pressable>
            )}
            {item.type === 'order_received' && item.isShipped && (
               <View style={styles.checkCircDone}>
                 <Feather name="check" size={16} color="#bbb" />
               </View>
            )}

            {!item.read && item.type !== 'order_received' && <View style={styles.unreadDot} />}
          </Pressable>
        )}
      />

      {/* Welcome Message Modal */}
      <Modal visible={!!selectedNotif} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Close */}
            <Pressable onPress={() => setSelectedNotif(null)} style={[styles.closeBtn, { alignSelf: 'flex-end' }]}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>

            {/* Title */}
            <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center', marginBottom: 0 }]}>
              {selectedNotif?.title}
            </Text>

            {/* Bunny GIF */}
            <Image
              source={require('../../assets/images/kittyflowers.gif')}
              style={styles.bunnyGif}
              resizeMode="contain"
            />

            {/* Paragraph */}
            <Text style={[styles.fullBodyText, { color: theme.textSecondary, textAlign: 'center' }]}>
              {selectedNotif?.body}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 44, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1
  },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
  },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  body: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginLeft: 12 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24
  },
  modalContent: {
    width: '100%', padding: 24, borderRadius: 28, borderWidth: 1,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 20, fontWeight: '900'
  },
  closeBtn: {
    padding: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 20, marginBottom: 4
  },
  bunnyGif: {
    width: 200, height: 200, marginBottom: 0
  },
  fullBodyText: {
    fontSize: 14, lineHeight: 22, fontWeight: '500', paddingHorizontal: 4
  },
  checkCirc: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginLeft: 12
  },
  checkCircDone: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#eee', borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center', marginLeft: 12
  }
});
