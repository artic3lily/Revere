import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function OrderDetailsScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) setOrder({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  if (loading) return <View style={[styles.screen, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" /></View>;
  if (!order) return <View style={[styles.screen, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: theme.text }}>Order not found.</Text></View>;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Order #{order.id.slice(-6).toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        
        {/* Status & Payment */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.row}>
            <Feather name="info" size={20} color={theme.textSecondary} style={{ marginRight: 12 }} />
            <Text style={[styles.label, { color: theme.textSecondary }]}>Status:</Text>
            <Text style={[styles.value, { color: theme.text, marginLeft: 'auto', textTransform: 'uppercase' }]}>{order.status}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.row}>
            <Feather name="credit-card" size={20} color={theme.textSecondary} style={{ marginRight: 12 }} />
            <Text style={[styles.label, { color: theme.textSecondary }]}>Payment Method:</Text>
            <Text style={[styles.value, { color: theme.primary || '#111', marginLeft: 'auto', fontWeight: '900', textTransform: 'uppercase' }]}>{order.paymentMethod}</Text>
          </View>
        </View>

        {/* Shipping Details */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Shipping to</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.shipName, { color: theme.text }]}>{order.shipping?.fullName}</Text>
          <Text style={[styles.shipDetail, { color: theme.textSecondary }]}>📞 {order.shipping?.phone}</Text>
          <Text style={[styles.shipDetail, { color: theme.textSecondary }]}>🏙️ {order.shipping?.city}</Text>
          <Text style={[styles.shipDetail, { color: theme.textSecondary, marginTop: 8 }]}>{order.shipping?.address}</Text>
        </View>

        {/* Items */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Items Purchased</Text>
        {order.items?.map(it => (
          <View key={it.id} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Image source={{ uri: it.image }} style={styles.thumb} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={2}>{it.title}</Text>
              <Text style={[styles.itemPrice, { color: theme.textSecondary }]}>Rs. {it.price}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.totalRow, { backgroundColor: theme.primary ? theme.primary + '11' : '#f8f8f8', borderColor: theme.primary || '#eee' }]}>
          <Text style={[styles.totalText, { color: theme.text }]}>Total Expected Income</Text>
          <Text style={[styles.totalAmount, { color: theme.primary || '#111' }]}>Rs. {order.totalAmount}</Text>
        </View>

      </ScrollView>
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
  sectionTitle: { fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  divider: { height: 1, marginVertical: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '800' },
  shipName: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  shipDetail: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemCard: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  itemPrice: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 12 },
  totalText: { fontSize: 16, fontWeight: '700' },
  totalAmount: { fontSize: 18, fontWeight: '900' }
});
