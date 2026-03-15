import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, Alert } from 'react-native';
import { auth, db } from '../config/firebase';
import BottomNav from '../components/BottomNav';
import { collection, onSnapshot, query, where, documentId, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { registerListener } from '../services/listenerRegistry';

export default function WishlistScreen({ navigation }) {
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

    const col = collection(db, 'users', uid, 'wishlist');
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
        // Restore the original order from the wishlist snapshot
        const resultMap = new Map(postResults.map(p => [p.id, p]));
        setItems(ids.map(id => resultMap.get(id)).filter(Boolean));
      } catch (e) {
        console.log('Wishlist fetch posts error', e);
        setItems([]);
      } finally { setLoading(false); }
    }, (e) => { if (e?.code !== 'permission-denied') console.log('Wishlist onSnapshot error', e?.message); });
    registerListener(unsub);

    return () => unsub && unsub();
  }, []);

  const remove = (postId) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to delete this item from your wishlist?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Delete", 
          style: "destructive",
          onPress: async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
              await deleteDoc(doc(db, 'users', uid, 'wishlist', postId));
            } catch (e) {
              console.log('Wishlist remove error', e);
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  if (loading) return (<View style={[styles.loading, { backgroundColor: theme.bg }]}><ActivityIndicator /></View>);

  if (!auth.currentUser) return (
    <View style={[styles.emptyWrap, { backgroundColor: theme.bg }]}><Text style={{ color: theme.textSecondary, fontWeight:'700' }}>Please log in to see your wishlist.</Text></View>
  );

  const Header = () => (
    <View style={[styles.header, { backgroundColor: theme.header, borderColor: theme.border }]}>
      <Text style={[styles.brand, { color: theme.text }]}>𝓡𝓮𝓿𝓮𝓻𝓮</Text>
      <Text style={[styles.headerTitle, { color: theme.text }]}>Wishlists</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (items.length === 0) return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Header />
      <View style={styles.emptyWrap}><Text style={{ color: theme.textSecondary, fontWeight:'700' }}>Your wishlist is empty.</Text></View>
      <BottomNav navigation={navigation} />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
            <Image source={{ uri: item.tryOnWhiteUrl || item.imageUrl }} style={styles.thumb} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.caption}</Text>
              <Text style={[styles.price, { color: theme.textSecondary }]}>Rs. {item.price}</Text>
            </View>
            <Pressable style={styles.removeBtn} onPress={() => remove(item.id)}>
              <Feather name="trash" size={18} color={theme.text} />
            </Pressable>
          </Pressable>
        )}
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
    backgroundColor: '#fff'
  },
  brand: { fontSize: 14, fontWeight: '900', color: '#111' },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#111' },
  row: { flexDirection:'row', alignItems:'center', marginBottom:12, borderWidth:1, borderColor:'#eee', borderRadius:12, padding:10, backgroundColor:'#fff' },
  thumb: { width: 96, height: 96, borderRadius: 10, backgroundColor:'#f2f2f2' },
  title: { fontSize:13, fontWeight:'800', color:'#111' },
  price: { marginTop:6, fontSize:12, fontWeight:'700', color:'#444' },
  removeBtn: { padding:8 }
});
