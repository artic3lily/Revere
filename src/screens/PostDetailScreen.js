import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "../config/firebase";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";

export default function PostDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { postId } = route.params || {};

  const [post, setPost] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!postId) return setLoading(false);
      try {
        const pSnap = await getDoc(doc(db, "posts", postId));
        if (!pSnap.exists()) {
          setLoading(false);
          return;
        }
        const p = { id: pSnap.id, ...pSnap.data() };
        if (!mounted) return;
        setPost(p);

        if (p.ownerId) {
          const uSnap = await getDoc(doc(db, "users", p.ownerId));
          if (uSnap.exists()) setOwner({ id: uSnap.id, ...uSnap.data() });
        }
        // check wishlist + cart for current user
        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const wSnap = await getDoc(doc(db, "users", uid, "wishlist", postId));
            if (wSnap.exists()) setSaved(true);
            const cSnap = await getDoc(doc(db, "users", uid, "cart", postId));
            if (cSnap.exists()) setInCart(true);
          }
        } catch (e) {
          console.log('Wishlist/Cart check error', e);
        }
      } catch (e) {
        console.log("PostDetail load error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [postId]);

  const toggleSaved = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Alert.alert('Please log in to save items to your wishlist.');

    const next = !saved;
    setSaved(next);

    const ref = doc(db, 'users', uid, 'wishlist', postId);
    try {
      if (next) {
        await setDoc(ref, { postId, createdAt: serverTimestamp() });
      } else {
        await deleteDoc(ref);
      }
    } catch (e) {
      console.log('Wishlist toggle error', e);
      setSaved(!next); // revert
    }
  };

  const toggleCart = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Alert.alert('Please log in to add items to your cart.');

    const next = !inCart;
    setInCart(next);

    const ref = doc(db, 'users', uid, 'cart', postId);
    try {
      if (next) {
        await setDoc(ref, { postId, createdAt: serverTimestamp() });
      } else {
        await deleteDoc(ref);
      }
    } catch (e) {
      console.log('Cart toggle error', e);
      setInCart(!next); // revert
    }
  };

  if (loading) return (
    <View style={[styles.loading, { backgroundColor: theme.bg }]}><ActivityIndicator /></View>
  );

  if (!post) return (
    <View style={[styles.loading, { backgroundColor: theme.bg }]}><Text style={{ color: theme.text }}>Post not found</Text></View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.topbar, { backgroundColor: theme.header, borderColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.card }]} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Item</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Pressable
          style={styles.userRow}
          onPress={() => {
            if (post.ownerId) navigation.navigate("UserProfile", { userId: post.ownerId });
          }}
        >
          {owner?.photoURL ? (
            <Image source={{ uri: owner.photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPh, { backgroundColor: theme.placeholder, borderColor: theme.border }]}><Feather name="user" size={16} color={theme.text} /></View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.name, { color: theme.text }]}>{owner?.fullName || post.ownerName || 'User'}</Text>
            <Text style={[styles.username, { color: theme.textSecondary }]}>@{owner?.username || post.ownerUsername || ''}</Text>
          </View>
        </Pressable>

        <View style={[styles.imgWrap, { backgroundColor: theme.placeholder, borderColor: theme.border }]}>
          <Image source={{ uri: post.imageUrl }} style={styles.image} />

          <View style={styles.heartWrap} pointerEvents="box-none">
            <Pressable style={[styles.heartBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={toggleSaved} hitSlop={10}>
              <Feather name="heart" size={22} color={saved ? 'red' : theme.icon} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.caption, { color: theme.text }]}>{post.caption || 'No caption'}</Text>
        {typeof post.price === 'number' && <Text style={[styles.price, { color: theme.textSecondary }]}>Rs. {post.price}</Text>}

        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(post.tags || []).slice(0,12).map((t) => (
            <View key={t} style={[styles.tag, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={[styles.tagText, { color: theme.textSecondary }]}>#{t}</Text></View>
          ))}
        </View>

        {post.ownerId !== auth.currentUser?.uid && (
          <Pressable style={[styles.cartBtn, inCart && styles.cartBtnActive, inCart ? { backgroundColor: theme.buttonBg } : { borderColor: theme.text }]} onPress={toggleCart}>
            <Text style={[styles.cartBtnText, inCart && styles.cartBtnTextActive, inCart ? { color: theme.buttonText } : { color: theme.text }]}>{inCart ? 'Remove from Cart' : 'Add to Cart'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  topbar: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth:1, borderColor:'#eee', flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  iconBtn: { width: 40, height: 36, borderRadius: 14, borderWidth:1, borderColor:'#eee', alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },
  title: { fontSize: 14, fontWeight: '900', color: '#111' },

  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12 },
  avatarPh: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center', borderWidth:1, borderColor:'#eee' },
  name: { fontSize: 14, fontWeight: '900', color: '#111' },
  username: { marginTop: 2, fontSize: 12, color: '#111', opacity: 0.6 },

  imgWrap: { borderRadius: 14, overflow: 'hidden', borderWidth:1, borderColor:'#eee', backgroundColor:'#f2f2f2' },
  image: { width: '100%', height: 320, resizeMode: 'cover' },

  caption: { marginTop: 12, fontSize: 13, fontWeight: '800', color: '#111' },
  price: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#444' },

  heartWrap: { position: 'absolute', top: 10, right: 10, zIndex: 3 },
  heartBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)', borderWidth:1, borderColor:'#eee' },

  tag: { borderWidth:1, borderColor:'#eee', borderRadius:999, paddingVertical:6, paddingHorizontal:10, marginRight:8, marginBottom:8 },
  tagText: { fontSize:12, fontWeight:'900', color:'#111', opacity:0.7 },

  cartBtn: { marginTop:12, paddingVertical:12, paddingHorizontal:16, borderRadius:12, borderWidth:1, borderColor:'#111', backgroundColor:'#fff', alignItems:'center' },
  cartBtnActive: { backgroundColor:'#111' },
  cartBtnText: { fontWeight:'900', fontSize:13, color:'#111' },
  cartBtnTextActive: { color:'#fff' },

  loading: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },
});
