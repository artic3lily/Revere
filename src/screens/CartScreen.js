import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, Alert } from 'react-native';
import { auth, db } from '../config/firebase';
import { collection, onSnapshot, doc, getDocs, query, where, documentId, deleteDoc } from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';
import { registerListener } from '../services/listenerRegistry';

export default function CartScreen({ navigation }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    let unsub = null;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const col = collection(db, 'users', uid, 'cart');
    unsub = onSnapshot(col, async (snap) => {
      const ids = snap.docs.map(d => d.id);
      if (ids.length === 0) { setItems([]); setLoading(false); return; }
      try {
        // Batch reads: split into chunks of 30 (Firestore 'in' query limit)
        // This replaces N individual getDoc calls with ceil(N/30) batch queries
        const chunks = [];
        for (let i = 0; i < ids.length; i += 30) {
          chunks.push(ids.slice(i, i + 30));
        }
        const postResults = [];
        for (const chunk of chunks) {
          const q = query(collection(db, 'posts'), where(documentId(), 'in', chunk));
          const batchSnap = await getDocs(q);
          batchSnap.docs.forEach(d => postResults.push({ id: d.id, ...d.data() }));
        }
        // Restore the original order from the cart snapshot
        const resultMap = new Map(postResults.map(p => [p.id, p]));
        setItems(ids.map(id => resultMap.get(id)).filter(Boolean));
      } catch (e) {
        console.log('Cart fetch posts error', e);
        setItems([]);
      } finally { setLoading(false); }
    }, (e) => { if (e?.code !== 'permission-denied') console.log('Cart onSnapshot error', e?.message); });
    registerListener(unsub);

    return () => unsub && unsub();
  }, []);

  // Sync selectedIds (in case an item gets removed while selected)
  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => items.some(i => i.id === id)));
  }, [items]);

  const remove = (postId) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to delete this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Delete", 
          style: "destructive",
          onPress: async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
              await deleteDoc(doc(db, 'users', uid, 'cart', postId));
            } catch (e) {
              console.log('Cart remove error', e);
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  const Header = () => (
    <View style={[styles.header, { backgroundColor: theme.header, borderColor: theme.border }]}>
      <Text style={[styles.brand, { color: theme.text }]}>𝓡𝓮𝓿𝓮𝓻𝓮</Text>
      <Text style={[styles.headerTitle, { color: theme.text }]}>Cart</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) return (<View style={[styles.loading, { backgroundColor: theme.bg }]}><ActivityIndicator /></View>);

  if (!auth.currentUser) return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Header />
      <View style={styles.emptyWrap}><Text style={{ color: theme.textSecondary, fontWeight:'700' }}>Please log in to view your cart.</Text></View>
      <BottomNav navigation={navigation} />
    </View>
  );

  if (items.length === 0) return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Header />
      <View style={styles.emptyWrap}><Text style={{ color: theme.textSecondary, fontWeight:'700' }}>Your cart is empty.</Text></View>
      <BottomNav navigation={navigation} />
    </View>
  );

  const selectedItems = items.filter(i => selectedIds.includes(i.id));
  const currentSellerId = selectedItems.length > 0 ? selectedItems[0].ownerId : null;
  const total = selectedItems.reduce((sum, item) => sum + (item.price || 0), 0);

  const toggleSelect = (item) => {
    if (selectedIds.includes(item.id)) {
      setSelectedIds(prev => prev.filter(id => id !== item.id));
    } else {
      if (currentSellerId && currentSellerId !== item.ownerId) {
        // Can optionally alert here, but the UI is disabled
        return;
      }
      setSelectedIds(prev => [...prev, item.id]);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
        ListHeaderComponent={Header}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          const isDisabled = currentSellerId != null && currentSellerId !== item.ownerId;
          const opacityStyle = isDisabled ? { opacity: 0.4 } : { opacity: 1 };
          
          return (
            <View style={[styles.row, opacityStyle, { backgroundColor: theme.card, borderColor: isSelected ? theme.primary || '#111' : theme.border }]}>
              <Pressable
                style={{ padding: 4, marginRight: 8 }}
                onPress={() => toggleSelect(item)}
                disabled={isDisabled}
              >
                <Feather name={isSelected ? "check-circle" : "circle"} size={22} color={isSelected ? (theme.primary || '#111') : theme.textSecondary} />
              </Pressable>

              <Pressable style={styles.contentWrap} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
                <Image source={{ uri: item.tryOnWhiteUrl || item.imageUrl }} style={styles.thumb} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.caption}</Text>
                  <Text style={[styles.price, { color: theme.textSecondary }]}>Rs. {item.price}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4, fontWeight: '700' }}>Seller: @{item.ownerUsername}</Text>
                </View>
              </Pressable>

              <Pressable style={styles.removeBtn} onPress={() => remove(item.id)}>
                <Feather name="trash" size={18} color={theme.text} />
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.footer}>
              {currentSellerId != null && (
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                  Select items from the same seller to checkout.
                </Text>
              )}
              <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.totalLabel, { color: theme.text }]}>Selected Total:</Text>
                <Text style={[styles.totalPrice, { color: theme.text }]}>Rs. {total}</Text>
              </View>
              <Pressable 
                style={[styles.checkoutBtn, { backgroundColor: selectedItems.length > 0 ? theme.buttonBg : theme.buttonDisabled || '#ccc' }]}
                disabled={selectedItems.length === 0}
                onPress={() => navigation.navigate('Checkout', { items: selectedItems, total })}
              >
                <Text style={[styles.checkoutText, { color: selectedItems.length > 0 ? theme.buttonText : '#666' }]}>Proceed to Checkout ({selectedItems.length})</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
      <BottomNav navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  loading: { flex:1, alignItems:'center', justifyContent:'center' },
  emptyWrap: { flex:1, alignItems:'center', justifyContent:'center' },
  empty: { color:'#666', fontWeight:'700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    marginBottom: 12
  },
  brand: { fontSize: 14, fontWeight: '900', color: '#111' },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#111' },
  row: { flexDirection:'row', alignItems:'center', marginBottom:12, borderWidth:2, borderRadius:12, padding:10, backgroundColor:'#fff' },
  contentWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 96, height: 96, borderRadius: 10, backgroundColor:'#f2f2f2' },
  title: { fontSize:13, fontWeight:'800', color:'#111' },
  price: { marginTop:6, fontSize:12, fontWeight:'700', color:'#444' },
  removeBtn: { padding:8 },
  footer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#eee' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 13, fontWeight: '900', color: '#111' },
  totalPrice: { fontSize: 13, fontWeight: '900', color: '#111' },
  checkoutBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#111', alignItems: 'center' },
  checkoutText: { color: '#fff', fontWeight: '900', fontSize: 13 }
});
