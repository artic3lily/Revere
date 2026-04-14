import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { auth, db, functions } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export default function OrderDetailsScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { orderId } = route.params;
  
  const [order, setOrder] = useState(null);
  const [seller, setSeller] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) {
          const orderData = { id: snap.id, ...snap.data() };
          setOrder(orderData);
          
          // Fetch seller details
          if (orderData.sellerId) {
            const sellerSnap = await getDoc(doc(db, 'users', orderData.sellerId));
            if (sellerSnap.exists()) setSeller({ id: sellerSnap.id, ...sellerSnap.data() });
          }
          
          // Fetch buyer details
          if (orderData.buyerId) {
            const buyerSnap = await getDoc(doc(db, 'users', orderData.buyerId));
            if (buyerSnap.exists()) setBuyer({ id: buyerSnap.id, ...buyerSnap.data() });
          }
        }
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const confirmOrder = async () => {
    try {
      setConfirming(true);
      const confirmFunc = httpsCallable(functions, 'confirmOrder');
      await confirmFunc({ orderId });
      
      // Refresh order
      const snap = await getDoc(doc(db, 'orders', orderId));
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() });
      }
      
      Alert.alert('Success', 'Order confirmed! Items marked as sold. Buyer notified.');
    } catch (e) {
      console.log('Error confirming:', e);
      Alert.alert('Error', e.message || 'Failed to confirm order');
    } finally {
      setConfirming(false);
    }
  };

  const isSellerView = auth.currentUser?.uid === order?.sellerId;
  const isBuyerView = auth.currentUser?.uid === order?.buyerId;

  if (loading) return <View style={[styles.screen, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={theme.text} /></View>;
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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        
        {/* Status */}
        <View style={[styles.statusBox, { backgroundColor: order.status === 'shipped' ? '#E8F5E9' : '#FFF3E0', borderColor: order.status === 'shipped' ? '#4CAF50' : '#FF9800' }]}>
          <Feather 
            name={order.status === 'shipped' ? 'check-circle' : 'loader'} 
            size={20} 
            color={order.status === 'shipped' ? '#4CAF50' : '#FF9800'} 
          />
          <Text style={[styles.statusText, { color: order.status === 'shipped' ? '#2E7D32' : '#E65100' }]}>
            {order.status === 'shipped' ? 'Order Shipped ✓' : 'Order Processing ⏳'}
          </Text>
        </View>

        {/* Buyer View: Show Seller */}
        {isBuyerView && seller && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>Seller</Text>
            <Pressable 
              style={[styles.personCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.navigate('UserProfile', { userId: seller.id })}
            >
              {seller.photoURL ? (
                <Image source={{ uri: seller.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPh, { backgroundColor: theme.placeholder }]}>
                  <Feather name="user" size={20} color={theme.text} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.personName, { color: theme.text }]}>{seller.fullName || 'Seller'}</Text>
                <Text style={[styles.personUsername, { color: theme.textSecondary }]}>@{seller.username}</Text>
              </View>
              <Feather name="arrow-right" size={18} color={theme.textSecondary} />
            </Pressable>
          </>
        )}

        {/* Seller View: Show Buyer */}
        {isSellerView && buyer && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>Buyer</Text>
            <Pressable 
              style={[styles.personCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.navigate('UserProfile', { userId: buyer.id })}
            >
              {buyer.photoURL ? (
                <Image source={{ uri: buyer.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPh, { backgroundColor: theme.placeholder }]}>
                  <Feather name="user" size={20} color={theme.text} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.personName, { color: theme.text }]}>{buyer.fullName || 'Buyer'}</Text>
                <Text style={[styles.personUsername, { color: theme.textSecondary }]}>@{buyer.username}</Text>
              </View>
              <Feather name="arrow-right" size={18} color={theme.textSecondary} />
            </Pressable>
          </>
        )}

        {/* Shipping Details */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>Shipping Details</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.shipName, { color: theme.text }]}>{order.shipping?.fullName}</Text>
          <Text style={[styles.shipDetail, { color: theme.textSecondary }]}>📞 {order.shipping?.phone}</Text>
          <Text style={[styles.shipDetail, { color: theme.textSecondary }]}>🏙️ {order.shipping?.city}</Text>
          <Text style={[styles.shipDetail, { color: theme.textSecondary, marginTop: 8 }]}>{order.shipping?.address}</Text>
        </View>

        {/* Items */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>Items Ordered</Text>
        {order.items?.map(it => (
          <View key={it.id} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {it.image && <Image source={{ uri: it.image }} style={styles.thumb} />}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={2}>{it.title}</Text>
              <Text style={[styles.itemPrice, { color: theme.primary || '#111' }]}>Rs. {it.price}</Text>
            </View>
          </View>
        ))}

        {/* Summary */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 20 }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Payment Method:</Text>
            <Text style={[styles.value, { color: theme.text, textTransform: 'uppercase' }]}>{order.paymentMethod}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 10 }]} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Total Amount:</Text>
            <Text style={[styles.value, { color: theme.primary || '#111', fontWeight: '900', fontSize: 16 }]}>Rs. {order.totalAmount}</Text>
          </View>
        </View>

        {/* Seller Confirm Button */}
        {isSellerView && order.status === 'pending' && (
          <Pressable 
            style={[styles.confirmBtn, { backgroundColor: theme.text, marginTop: 20 }]}
            onPress={confirmOrder}
            disabled={confirming}
          >
            <Feather name="check-circle" size={18} color={theme.bg} />
            <Text style={[styles.confirmBtnText, { color: theme.bg }]}>
              {confirming ? 'Confirming...' : 'Confirm & Ship Order'}
            </Text>
          </Pressable>
        )}

        {order.status === 'shipped' && isSellerView && (
          <View style={[styles.confirmedBox, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50', marginTop: 20 }]}>
            <Feather name="check-circle" size={20} color="#4CAF50" />
            <Text style={[styles.confirmedText, { color: '#2E7D32', marginLeft: 10 }]}>Order Confirmed & Shipped</Text>
          </View>
        )}

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
  
  statusBox: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusText: { fontSize: 14, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  
  personCard: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPh: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 14, fontWeight: '800' },
  personUsername: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, marginVertical: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '800' },
  
  shipName: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  shipDetail: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  
  itemCard: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  itemPrice: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  
  confirmBtn: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnText: { fontSize: 14, fontWeight: '800' },
  
  confirmedBox: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  confirmedText: { fontSize: 13, fontWeight: '700' }
});
