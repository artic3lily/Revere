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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth, db, functions } from "../config/firebase";
import { doc, getDoc, setDoc, updateDoc, increment, deleteDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useTheme } from "../context/ThemeContext";

export default function PostDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const [editModal, setEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setEditCaption(post?.caption || "");
    setEditPrice(post?.price != null ? String(post.price) : "");
    setEditTags((post?.tags || []).join(", "));
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editCaption.trim()) return Alert.alert("Caption is required");
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum < 0) return Alert.alert("Enter a valid price");
    const tagsArr = editTags.split(",").map(t => t.trim()).filter(Boolean);
    
    try {
      setSaving(true);
      // Use secure Cloud Function for editing
      const editPostFunction = httpsCallable(functions, "editPost");
      await editPostFunction({
        postId,
        caption: editCaption.trim(),
        price: priceNum,
        tags: tagsArr,
      });
      
      // Update local state
      setPost(prev => ({ 
        ...prev, 
        caption: editCaption.trim(), 
        price: priceNum, 
        tags: tagsArr 
      }));
      setEditModal(false);
      Alert.alert("Success", "Post updated successfully");
    } catch (e) {
      let errorMsg = e.message || "Failed to save";
      
      // Handle specific error cases
      if (e.code === "failed-precondition") {
        errorMsg = "Cannot edit sold items. Items can only be edited before they're sold.";
      } else if (e.code === "permission-denied") {
        errorMsg = "You can only edit your own posts";
      } else if (e.code === "invalid-argument") {
        errorMsg = errorMsg;
      }
      
      Alert.alert("Failed to save", errorMsg);
    } finally {
      setSaving(false);
    }
  };
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

        // increment views asynchronously
        updateDoc(doc(db, "posts", postId), {
          views: increment(1)
        }).catch((e) => console.log("Failed to increment views:", e));

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

  const deletePost = async () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Delete",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", postId));
              Alert.alert("Success", "Post deleted successfully");
              navigation.goBack();
            } catch (e) {
              Alert.alert("Failed to delete", e.message);
            }
          },
          style: "destructive"
        }
      ]
    );
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
          <Image source={{ uri: post.tryOnWhiteUrl || post.imageUrl }} style={styles.image} />

          <View style={styles.heartWrap} pointerEvents="box-none">
            <Pressable style={[styles.heartBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={toggleSaved} hitSlop={10}>
              <Feather name="heart" size={22} color={saved ? 'red' : theme.icon} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.caption, { color: theme.text }]}>{post.caption || 'No caption'}</Text>
        
        {/* ── Sold Status Badge ── */}
        {post.sold && (
          <View style={[styles.soldBadge, { backgroundColor: '#d32f2f' }]}>
            <Feather name="check-circle" size={14} color="#fff" />
            <Text style={styles.soldBadgeText}>Item Sold</Text>
          </View>
        )}
        
        {/* ── Owner Edit Notice ── */}
        {post.ownerId === auth.currentUser?.uid && post.sold && (
          <View style={[styles.editNotice, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="lock" size={14} color={theme.textSecondary} />
            <Text style={[styles.editNoticeText, { color: theme.textSecondary }]}>
              This item has been sold and can no longer be edited
            </Text>
          </View>
        )}
        
        {typeof post.price === 'number' && <Text style={[styles.price, { color: theme.textSecondary }]}>Rs. {post.price}</Text>}

        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(post.tags || []).slice(0,12).map((t) => (
            <View key={t} style={[styles.tag, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={[styles.tagText, { color: theme.textSecondary }]}>#{t}</Text></View>
          ))}
        </View>

        {post.ownerId !== auth.currentUser?.uid && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <Pressable style={[styles.cartBtn, { flex: 1, marginTop: 0 }, inCart && styles.cartBtnActive, inCart ? { backgroundColor: theme.buttonBg } : { borderColor: theme.text, backgroundColor: theme.card }]} onPress={toggleCart}>
              <Text style={[styles.cartBtnText, inCart && styles.cartBtnTextActive, inCart ? { color: theme.buttonText } : { color: theme.text }]}>{inCart ? 'Remove from Cart' : 'Add to Cart'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const tryOnImg = post.tryOnWhiteUrl || post.imageUrl;
                if (!tryOnImg) {
                  Alert.alert("Not Available", "This post does not have an image to try on.");
                  return;
                }
                navigation.navigate("TryOn", {
                  postId: post.id,
                  tryOnPngUrl: tryOnImg, // Keep param name same for TryOnScreen
                });
              }}
              disabled={post.tryOnStatus === "processing"}
              style={[
                styles.cartBtn, 
                { 
                  flex: 1, 
                  marginTop: 0, 
                  backgroundColor: theme.text, 
                  borderColor: theme.text,
                  opacity: post.tryOnStatus === "processing" ? 0.5 : 1
                }
              ]}
            >
              <Text style={[styles.cartBtnText, { color: theme.bg, textAlign: "center" }]}>
                {post.tryOnStatus === "processing" ? "Preparing Try-On..." : "Try On"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Owner Action Buttons ── */}
        {post.ownerId === auth.currentUser?.uid && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, paddingBottom: 20 }}>
            <Pressable 
              onPress={openEdit}
              disabled={post.sold}
              style={[
                styles.actionBtn, 
                { 
                  flex: 1, 
                  backgroundColor: post.sold ? '#ccc' : theme.text,
                  borderColor: theme.text 
                }
              ]}
            >
              <Feather name="edit-2" size={16} color={post.sold ? '#999' : theme.bg} />
              <Text style={[styles.actionBtnText, { color: post.sold ? '#999' : theme.bg }]}>
                Edit
              </Text>
            </Pressable>

            <Pressable 
              onPress={deletePost}
              style={[
                styles.actionBtn, 
                { 
                  flex: 1, 
                  backgroundColor: '#d32f2f',
                  borderColor: '#d32f2f'
                }
              ]}
            >
              <Feather name="trash-2" size={16} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ── Edit Modal ── */}
      <Modal visible={editModal} animationType="slide" transparent onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Post</Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Caption</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                value={editCaption}
                onChangeText={setEditCaption}
                multiline
                numberOfLines={3}
                placeholder="Caption..."
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Price (Rs.)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Tags (comma separated)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                value={editTags}
                onChangeText={setEditTags}
                placeholder="vintage, grunge, ..."
                placeholderTextColor={theme.textSecondary}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <Pressable onPress={() => setEditModal(false)} style={[styles.modalBtn, { flex: 1, borderColor: theme.border, backgroundColor: theme.bg }]}>
                  <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEdit} disabled={saving} style={[styles.modalBtn, { flex: 1, backgroundColor: theme.text, borderColor: theme.text }]}>
                  <Text style={[styles.modalBtnText, { color: theme.bg }]}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  soldBadge: { marginTop: 10, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  soldBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  editNotice: { marginVertical: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  editNoticeText: { fontSize: 12, fontWeight: '600', flex: 1 },

  cartBtn: { marginTop:12, paddingVertical:12, paddingHorizontal:16, borderRadius:12, borderWidth:1, borderColor:'#111', backgroundColor:'#fff', alignItems:'center' },
  cartBtnActive: { backgroundColor:'#111' },
  cartBtnText: { fontWeight:'900', fontSize:13, color:'#111' },
  cartBtnTextActive: { color:'#fff' },

  actionBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  actionBtnText: { fontWeight: '700', fontSize: 13, textAlign: 'center' },

  loading: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, paddingBottom: 36 },
  modalTitle: { fontSize: 16, fontWeight: '900', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600' },
  modalBtn: { paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  modalBtnText: { fontSize: 13, fontWeight: '900' },
});
