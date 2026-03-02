import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handlePress = async (notif) => {
    if (!notif.read) {
      updateDoc(doc(db, 'notifications', notif.id), { read: true }).catch(console.log);
    }
    if (notif.type === 'order_received') {
      navigation.navigate('OrderDetails', { orderId: notif.orderId });
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
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>{item.body}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </Pressable>
        )}
      />
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
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginLeft: 12 }
});
