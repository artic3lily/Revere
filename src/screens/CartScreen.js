import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, ActivityIndicator } from 'react-native';
import { auth, db } from '../config/firebase';
import { collection, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

export default function CartScreen({ navigation }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

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
      if (ids.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      // fetch posts for ids
      try {
        const posts = await Promise.all(ids.map(async (id) => {
          const pSnap = await getDoc(doc(db, 'posts', id));
          if (!pSnap.exists()) return null;
          return { id: pSnap.id, ...pSnap.data() };
        }));
        setItems(posts.filter(Boolean));
      } catch (e) {
        console.log('Cart fetch posts error', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, (e) => { console.log('Cart onSnapshot error', e); setLoading(false); });

    return () => unsub && unsub();
  }, []);

  const remove = async (postId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await deleteDoc(doc(db, 'users', uid, 'cart', postId));
    } catch (e) {
      console.log('Cart remove error', e);
    }
  };

  const Header = () => (
    <View style={[styles.header, { backgroundColor: theme.header, borderColor: theme.border }]}>
      <Text style={[styles.brand, { color: theme.text }]}>Revere</Text>
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

  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
            <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.caption}</Text>
              <Text style={[styles.price, { color: theme.textSecondary }]}>Rs. {item.price}</Text>
            </View>
            <Pressable style={styles.removeBtn} onPress={() => remove(item.id)}>
              <Feather name="trash" size={18} color={theme.text} />
            </Pressable>
          </Pressable>
        )}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.footer}>
              <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.totalLabel, { color: theme.text }]}>Total:</Text>
                <Text style={[styles.totalPrice, { color: theme.text }]}>Rs. {total}</Text>
              </View>
              <Pressable style={[styles.checkoutBtn, { backgroundColor: theme.buttonBg }]}>
                <Text style={[styles.checkoutText, { color: theme.buttonText }]}>Proceed to Checkout</Text>
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
  row: { flexDirection:'row', alignItems:'center', marginBottom:12, borderWidth:1, borderColor:'#eee', borderRadius:12, padding:10, backgroundColor:'#fff' },
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
