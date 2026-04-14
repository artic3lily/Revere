import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

import { auth, db, storage } from "../config/firebase";
import { registerListener } from "../services/listenerRegistry";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  getCountFromServer,
  getDocs,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import BottomNav from "../components/BottomNav";
import { useTheme } from "../context/ThemeContext";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

const CATEGORIES = ["Grunge", "Casual", "Elegant", "Chic", "Y2k", "Vintage", "Minimalistic", "Street Wear", "Bohemian", "Sporty", "Cottage Core", "Preppy"];

function formatJoined(ts) {
  try {
    if (!ts) return "Joined recently";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return `Joined ${d.toLocaleString(undefined, { month: "short", year: "numeric" })}`;
  } catch {
    return "Joined recently";
  }
}

export default function ProfileScreen({ navigation }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const user = auth.currentUser;
  const uid = user?.uid;

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All");
  const [tagQuery, setTagQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);

  // counts
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [postError, setPostError] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [newImage, setNewImage] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newCategoryDropdownOpen, setNewCategoryDropdownOpen] = useState(false);

  // Edit Profile modal
  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editAbout, setEditAbout] = useState("");

  // Post Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [ownerCache, setOwnerCache] = useState({}); // { [uid]: { photoURL, username, fullName } }
  const detailScrollRef = useRef(null);

  // Edit within profile modal
  const [editPostModal, setEditPostModal] = useState(false);
  const [editCapt, setEditCapt] = useState("");
  const [editPri, setEditPri] = useState("");
  const [editTgs, setEditTgs] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const onOpenEdit = () => {
    setEditCapt(activePost?.caption || "");
    setEditPri(activePost?.price != null ? String(activePost.price) : "");
    setEditTgs((activePost?.tags || []).join(", "));
    setEditPostModal(true);
  };

  const onSaveEdit = async () => {
    if (!editCapt.trim()) return Alert.alert("Caption is required");
    const pNum = parseFloat(editPri);
    if (isNaN(pNum) || pNum < 0) return Alert.alert("Enter a valid price");
    const tArr = editTgs.split(",").map(t => t.trim()).filter(Boolean);
    try {
      setSavingEdit(true);
      await updateDoc(doc(db, "posts", activePost.id), {
        caption: editCapt.trim(),
        price: pNum,
        tags: tArr,
      });
      // Update local state in posts list
      setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, caption: editCapt.trim(), price: pNum, tags: tArr } : p));
      // Update active post
      setActivePost(prev => ({ ...prev, caption: editCapt.trim(), price: pNum, tags: tArr }));
      setEditPostModal(false);
    } catch (e) {
      Alert.alert("Error saving", e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const ratingAvg = useMemo(() => {
    const avg = profile?.ratingAvg ?? 0;
    return Math.round(avg * 10) / 10;
  }, [profile]);

  const { width } = Dimensions.get("window");
  const gridGap = 8;
  const tileSize = Math.floor((width - 16 * 2 - gridGap * 2) / 3);
  const numCols = 3;

  // filtered logic
  const filteredPosts = useMemo(() => {
    let list = Array.isArray(posts) ? posts : [];

    // Category filter
    if (activeCategoryFilter !== "All") {
      list = list.filter(
        (p) =>
          (p?.category || "").toLowerCase() ===
          activeCategoryFilter.toLowerCase()
      );
    }

    // Tag search filter
    const q = tagQuery.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((p) => {
        const tags = Array.isArray(p?.tags) ? p.tags : [];
        return tags.some((t) => String(t).toLowerCase().includes(q));
      });
    }

    return list;
  }, [posts, activeCategoryFilter, tagQuery]);

  const ensureUserDoc = async () => {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const email = auth.currentUser?.email ?? "";
      await setDoc(userRef, {
        email,
        fullName: "",
        username: email ? email.split("@")[0] : "",
        about: "",
        photoURL: "",
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  useEffect(() => {
    if (!uid) return;
    let unsubPosts = null;

    (async () => {
      try {
        await ensureUserDoc();

        // profile
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data() : null;
        setProfile(data);

        // counts
        const [followersSnap, followingSnap] = await Promise.all([
          getCountFromServer(collection(db, "followers", uid, "users")),
          getCountFromServer(collection(db, "following", uid, "users")),
        ]);
        setFollowersCount(followersSnap.data().count);
        setFollowingCount(followingSnap.data().count);

        // posts query (whatever that has  already indexed)
        const q = query(
          collection(db, "posts"),
          where("ownerId", "==", uid),
          orderBy("createdAt", "desc")
        );

        unsubPosts = onSnapshot(
          q,
          (snap2) => {
            const list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
            setPosts(list);
            setLoadingPosts(false);
          },
          (err) => {
            setLoadingPosts(false);
            // Don't show alert for permission-denied (happens briefly on logout)
            if (err?.code !== 'permission-denied') Alert.alert("Error", err?.message ?? "Could not load posts");
          }
        );
        registerListener(unsubPosts);
      } catch (e) {
        Alert.alert("Error", e?.message ?? "Could not load profile");
      } finally {
        setLoadingProfile(false);
      }
    })();

    return () => {
      if (unsubPosts) unsubPosts();
    };
  }, [uid]);

  const pickImage = async (aspect = [1, 1]) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow gallery permission to upload.");
      return null;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect,
      quality: 0.85,
    });

    if (res.canceled) return null;
    return res.assets?.[0]?.uri ?? null;
  };

  const uploadImageToStorage = async ({ uri, storagePath, onProgress }) => {
    const resp = await fetch(uri);
    const blob = await resp.blob();

    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: "image/jpeg",
    });

    await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct =
            snap.totalBytes > 0
              ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
              : 0;
          onProgress?.(pct);
        },
        (err) => reject(err),
        () => resolve()
      );
    });

    const url = await getDownloadURL(storageRef);
    return { url, storagePath };
  };

  // profile edits
  const openEditProfile = () => {
    setEditFullName(profile?.fullName ?? "");
    setEditAbout(profile?.about ?? "");
    setEditOpen(true);
  };

  const saveProfileEdits = async () => {
    if (!uid) return;
    try {
      setUploading(true);
      await updateDoc(doc(db, "users", uid), {
        fullName: editFullName.trim(),
        about: editAbout.trim(),
        updatedAt: serverTimestamp(),
      });

      setProfile((p) => ({
        ...(p ?? {}),
        fullName: editFullName.trim(),
        about: editAbout.trim(),
      }));

      setEditOpen(false);
    } catch (e) {
      Alert.alert("Error", e?.message ?? "Could not save profile");
    } finally {
      setUploading(false);
    }
  };

  const onChangeProfilePhoto = async () => {
    if (!uid) return;

    try {
      const uri = await pickImage([1, 1]);
      if (!uri) return;

      setUploading(true);
      setUploadPct(0);

      const storagePath = `users/${uid}/avatar_${Date.now()}.jpg`;
      const { url } = await uploadImageToStorage({
        uri,
        storagePath,
        onProgress: setUploadPct,
      });

      await updateDoc(doc(db, "users", uid), {
        photoURL: url,
        updatedAt: serverTimestamp(),
      });

      setProfile((p) => ({ ...(p ?? {}), photoURL: url }));
    } catch (e) {
      Alert.alert("Error", e?.message ?? "Could not update photo");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  // POSTS edits
  const openAddPost = () => {
    setNewCaption("");
    setNewImage(null);
    setNewPrice("");
    setNewTags("");
    setNewCategory(CATEGORIES[0]);
    setModalOpen(true);
  };

  const pickPostImage = async () => {
    const uri = await pickImage([1, 1]);
    if (uri) setNewImage(uri);
  };

  const onCreatePost = async () => {
    if (!uid) return;
    setPostError("");

    if (!newImage || !newCaption.trim() || !newPrice.trim() || !newTags.trim() || !newCategory) {
      setPostError("Please add necessary info");
      return;
    }

    const priceNumber =
      newPrice.trim().length === 0 ? null : Number(newPrice.trim());
    if (priceNumber !== null && Number.isNaN(priceNumber)) {
      setPostError("Invalid price format");
      return;
    }

    const tagsArr = newTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);

    try {
      setUploading(true);
      setUploadPct(0);

      // 1. Upload Original Image to Firebase Storage
      const storagePath = `posts/${uid}/${Date.now()}.jpg`;
      const { url, storagePath: savedPath } = await uploadImageToStorage({
        uri: newImage,
        storagePath,
        onProgress: setUploadPct,
      });

      // 2. Upload to Cloudinary for Background Removal (Transparent PNG)
      const cloudName = "ddvwuw1xq";
      const uploadPreset = "ml_default"; // You usually need an unsigned upload preset, but we will use the API key approach to be safe if they didn't make one

      let tryOnPngUrl = "";
      let tryOnWhiteUrl = "";

      try {
        const formData = new FormData();
        formData.append("file", {
          uri: newImage,
          type: "image/jpeg",
          name: "upload.jpg",
        });
        formData.append("upload_preset", uploadPreset); 

        // Standard Upload
        const cl_res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });
        const cl_data = await cl_res.json();
        console.log("Cloudinary Upload Response:", cl_data);

        if (cl_data.public_id) {
          // Construct the generative background removal URLs
          tryOnPngUrl = `https://res.cloudinary.com/${cloudName}/image/upload/e_background_removal/${cl_data.public_id}.png`;
          tryOnWhiteUrl = `https://res.cloudinary.com/${cloudName}/image/upload/e_gen_background_replace:prompt_solid%20white%20background/${cl_data.public_id}.jpg`;
          console.log("Generated PNG:", tryOnPngUrl);
          console.log("Generated White:", tryOnWhiteUrl);
        } else {
             console.warn("Cloudinary upload failed:", cl_data);
             // fallback to original if it fails
             tryOnPngUrl = url;
             tryOnWhiteUrl = url;
        }

      } catch (e) {
        console.error("Cloudinary processing error:", e);
        tryOnPngUrl = url;
        tryOnWhiteUrl = url;
      }

      // 3. Save all URLs to Firestore
      await addDoc(collection(db, "posts"), {
        ownerId: uid,
        ownerName: profile?.fullName || "User",
        ownerUsername:
          profile?.username || (auth.currentUser?.email?.split("@")[0] ?? ""),
        ownerPhotoURL: profile?.photoURL || "",
        caption: newCaption.trim(),
        imageUrl: url, // Original
        tryOnPngUrl: tryOnPngUrl, // Transparent Cutout
        tryOnWhiteUrl: tryOnWhiteUrl, // Solid White Background
        storagePath: savedPath,
        price: priceNumber,
        category: newCategory,
        tags: tagsArr,
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now(),
      });

      setModalOpen(false);

      // reshow new posts
      setActiveCategoryFilter("All");
      setTagQuery("");

      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (e) {
      Alert.alert("Error", e?.message ?? "Could not create post");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const onDeletePost = (post) => {
    setPostToDelete(post);
    setDeleteModalVisible(true);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    try {
      await deleteDoc(doc(db, "posts", postToDelete.id));
      if (postToDelete.storagePath) {
        await deleteObject(ref(storage, postToDelete.storagePath));
      }
      setDetailOpen(false);
      setActivePost(null);
    } catch (e) {
      Alert.alert(
        "Delete failed",
        e?.message ??
          "Delete blocked by rules. (You can delete only your own uploads)"
      );
    } finally {
      setDeleteModalVisible(false);
      setPostToDelete(null);
    }
  };

  // post detail helpers
  const openPostDetail = async (post) => {
    setActivePost(post);
    setDetailOpen(true);

    if (post?.id) {
      updateDoc(doc(db, "posts", post.id), { views: increment(1) }).catch(() => {});
    }

    setTimeout(
      () =>
        detailScrollRef.current?.scrollToOffset?.({
          offset: 0,
          animated: false,
        }),
      0
    );

    const ownerId = post?.ownerId;
    if (!ownerId) return;

    if (!ownerCache[ownerId]) {
      try {
        const s = await getDoc(doc(db, "users", ownerId));
        if (s.exists()) {
          const u = s.data();
          setOwnerCache((prev) => ({
            ...prev,
            [ownerId]: {
              photoURL: u.photoURL || "",
              username: u.username || "",
              fullName: u.fullName || "",
            },
          }));
        }
      } catch {
        // ignore
      }
    }
  };

  const closePostDetail = () => {
    setDetailOpen(false);
    setActivePost(null);
  };

  const renderGridItem = ({ item }) => (
    <Pressable
      onPress={() => openPostDetail(item)}
      onLongPress={() => onDeletePost(item)}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.tile,
        { width: tileSize, height: tileSize, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Image source={{ uri: item.tryOnWhiteUrl || item.imageUrl }} style={styles.tileImg} />
      {item.sold && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 2 }}>Sold</Text>
        </View>
      )}
      {typeof item.price === "number" && (
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>Rs. {item.price}</Text>
        </View>
      )}
    </Pressable>
  );

  if (loadingProfile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const joinedText = formatJoined(profile?.createdAt);

  const detailOwner =
    activePost?.ownerId === uid
      ? {
          photoURL: profile?.photoURL || activePost?.ownerPhotoURL || "",
          username: profile?.username || activePost?.ownerUsername || "",
          fullName: profile?.fullName || activePost?.ownerName || "",
        }
      : ownerCache[activePost?.ownerId] || {
          photoURL: activePost?.ownerPhotoURL || "",
          username: activePost?.ownerUsername || "",
          fullName: activePost?.ownerName || "",
        };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.text }]} numberOfLines={1}>
          𝓡𝓮𝓿𝓮𝓻𝓮
        </Text>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          Profile
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border, flexDirection: 'column' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          {/* Left: avatar */}
          <Pressable onPress={onChangeProfilePhoto} style={styles.avatarWrap}>
            {profile?.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.placeholder }]}>
                <Feather name="user" size={22} color={theme.icon} />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="edit-2" size={12} color={theme.icon} />
            </View>
          </Pressable>

          {/* Middle: Name/User */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.name, { color: theme.text }]}>{profile?.fullName ?? "Your Name"}</Text>
            <Text style={[styles.username, { color: theme.textSecondary }]}>@{profile?.username ?? "username"}</Text>
            <Text style={[styles.joined, { color: theme.textSecondary }]} numberOfLines={1}>
              {joinedText}
            </Text>
          </View>

          {/* Right: Edit Btn */}
          <Pressable onPress={openEditProfile} style={[styles.editBtnRight, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Feather name="edit-3" size={14} color={theme.icon} />
            <Text style={[styles.editBtnRightText, { color: theme.text }]}>Edit</Text>
          </Pressable>
        </View>

        {/* Divider Line */}
        <View style={{ height: 1.2, backgroundColor: isDark ? "#333" : "#dcdcdc", marginTop: 4, marginBottom: 0, width: '100%' }} />

        {/* Bio Section - Now full width below */}
        <View style={{ marginTop: 0 }}>
          <Text style={[styles.about, { color: theme.textSecondary, fontStyle: 'italic', marginTop: 0 }]}>
            {profile?.about?.trim()?.length
              ? profile.about
              : "Add bio"}
          </Text>
        </View>
      </View>

      {/* Follow stats */}
      <View style={styles.followRow}>
        <Pressable 
          style={[styles.followPill, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => navigation.navigate("FollowList", { userId: uid, title: "Following", type: "following" })}
        >
          <Text style={[styles.followNum, { color: theme.text }]}>{followingCount}</Text>
          <Text style={[styles.followLbl, { color: theme.textSecondary }]}>Following</Text>
        </Pressable>

        <Pressable 
          style={[styles.followPill, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => navigation.navigate("FollowList", { userId: uid, title: "Followers", type: "followers" })}
        >
          <Text style={[styles.followNum, { color: theme.text }]}>{followersCount}</Text>
          <Text style={[styles.followLbl, { color: theme.textSecondary }]}>Followers</Text>
        </Pressable>

        <View style={[styles.followPill, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Text style={[styles.followNum, { color: theme.text }]}>{posts.length}</Text>
          <Text style={[styles.followLbl, { color: theme.textSecondary }]}>Posts</Text>
        </View>
      </View>

      {/* Rating */}
      <View style={styles.ratingRow}>
        <Pressable onPress={() => navigation.navigate("RatingList", { userId: uid, title: "Ratings" })}>
          <Text style={[styles.ratingText, { color: theme.text }]}>Rating</Text>
        </Pressable>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Feather
              key={i}
              name="star"
              size={16}
              color={i <= Math.round(ratingAvg) ? "#fbc02d" : (isDark ? "#555" : "#ddd")}
              style={{ opacity: i <= Math.round(ratingAvg) ? 1 : 0.5 }}
            />
          ))}
          <Text style={[styles.ratingNumber, { color: theme.text }]}>{ratingAvg || "0.0"}</Text>
        </View>
      </View>

      {/* Add Post */}
      <Pressable style={[styles.addPostBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={openAddPost}>
        <Feather name="plus" size={16} color={theme.icon} />
        <Text style={[styles.addPostText, { color: theme.text }]}>Add Post</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Posts</Text>

      {/* Filters UI */}
      <View style={styles.filtersWrap}>
        <TextInput
          value={tagQuery}
          onChangeText={setTagQuery}
          placeholder="Search tags… (e.g. denim, y2k)"
          placeholderTextColor={theme.textSecondary}
          style={[styles.filterInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        />

        <View style={[styles.filterChipsRow, { alignItems: 'center' }]}>
          <Pressable
            style={[styles.filterChip, { backgroundColor: theme.card, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
            onPress={() => setDropdownOpen(true)}
          >
            <Text style={[styles.filterChipText, { color: theme.text, opacity: 1 }]}>
              Category: {activeCategoryFilter}
            </Text>
            <Feather name="chevron-down" size={14} color={theme.text} />
          </Pressable>
        </View>

        {/* little helper text */}
        <Text style={[styles.filterHint, { color: theme.textSecondary }]}>
          Showing {filteredPosts.length} / {posts.length}
        </Text>
      </View>

      {loadingPosts ? (
        <View style={styles.loadingSmall}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          key={`posts-${numCols}`}
          data={filteredPosts}
          numColumns={numCols}
          renderItem={renderGridItem}
          keyExtractor={(it) => it.id}
          columnWrapperStyle={{ gap: 8 }}
          contentContainerStyle={{ paddingBottom: 110, gap: 8 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      )}

      </ScrollView>

      {/* upload progress */}
      {uploading && (
        <View style={styles.progressBarWrap} pointerEvents="none">
          <View style={[styles.progressBar, { width: `${uploadPct}%` }]} />
        </View>
      )}

 {/*post detail model*/}
      <Modal visible={detailOpen} animationType="slide">
        <View style={[styles.detailScreen, { backgroundColor: theme.bg }]}>
          {/* Top bar */}
          <View style={[styles.detailTopbar, { borderColor: theme.border, backgroundColor: theme.bg }]}>
            <Pressable
              onPress={closePostDetail}
              hitSlop={12}
              style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Feather name="arrow-left" size={20} color={theme.icon} />
            </Pressable>

            <Text style={[styles.detailTitle, { color: theme.text }]} numberOfLines={1}>
              Post
            </Text>

            {/* edit/delete own post */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {activePost?.ownerId === uid ? (
                <>
                  {!activePost?.sold && (
                    <Pressable
                      onPress={onOpenEdit}
                      hitSlop={12}
                      style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                    >
                      <Feather name="edit-2" size={18} color={theme.icon} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => onDeletePost(activePost)}
                    hitSlop={12}
                    style={[styles.trashBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                  >
                    <Feather name="trash-2" size={18} color={theme.icon} />
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          {/* Content */}
          <FlatList
            ref={detailScrollRef}
            data={[activePost].filter(Boolean)}
            keyExtractor={() => "only"}
            renderItem={() => (
              <View style={styles.detailCard}>
                {/* user row */}
                <View style={styles.detailUserRow}>
                  {detailOwner?.photoURL ? (
                    <Image
                      source={{ uri: detailOwner.photoURL }}
                      style={styles.detailAvatar}
                    />
                  ) : (
                    <View style={[styles.detailAvatarPlaceholder, { backgroundColor: theme.placeholder, borderColor: theme.border }]}>
                      <Feather name="user" size={16} color={theme.icon} />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailName, { color: theme.text }]} numberOfLines={1}>
                      {detailOwner?.fullName || activePost?.ownerName || "User"}
                    </Text>
                    <Text style={[styles.detailUsername, { color: theme.textSecondary }]} numberOfLines={1}>
                      @
                      {detailOwner?.username ||
                        activePost?.ownerUsername ||
                        "username"}
                    </Text>
                  </View>
                </View>

                {/* image */}
                <View style={styles.detailImgWrap}>
                  <Image
                    source={{ uri: activePost?.tryOnWhiteUrl || activePost?.imageUrl }}
                    style={styles.detailImg}
                  />
                </View>

                {/* meta */}
                <View style={styles.detailMeta}>
                  {/* price + category */}
                  <View style={styles.detailPillsRow}>
                    {typeof activePost?.price === "number" ? (
                      <View style={styles.detailPillDark}>
                        <Text style={styles.detailPillDarkText}>
                          Rs. {activePost.price}
                        </Text>
                      </View>
                    ) : null}

                    {activePost?.category ? (
                      <View style={styles.detailPill}>
                        <Text style={styles.detailPillText}>
                          {activePost.category}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* caption */}
                  {activePost?.caption ? (
                    <Text style={styles.detailCaption}>{activePost.caption}</Text>
                  ) : (
                    <Text style={[styles.detailCaption, { opacity: 0.5 }]}>
                      No caption
                    </Text>
                  )}

                  {/* tags */}
                  {Array.isArray(activePost?.tags) &&
                  activePost.tags.length > 0 ? (
                    <View style={styles.tagsRow}>
                      {activePost.tags.slice(0, 12).map((t) => (
                        <View key={t} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>#{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.tagsEmpty}>No tags</Text>
                  )}
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* ── Sub-Modal for Editing ── */}
        <Modal visible={editPostModal} animationType="fade" transparent onRequestClose={() => setEditPostModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Details</Text>

                <Text style={[styles.label, { color: theme.textSecondary }]}>Caption</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={editCapt}
                  onChangeText={setEditCapt}
                  multiline
                  placeholder="Caption..."
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={[styles.label, { color: theme.textSecondary }]}>Price (Rs.)</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={editPri}
                  onChangeText={setEditPri}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={[styles.label, { color: theme.textSecondary }]}>Tags (comma separated)</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={editTgs}
                  onChangeText={setEditTgs}
                  placeholder="vintage, y2k..."
                  placeholderTextColor={theme.textSecondary}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable onPress={() => setEditPostModal(false)} style={[styles.modalBtn, { flex: 1, borderColor: theme.border, backgroundColor: theme.bg }]}>
                    <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={onSaveEdit} disabled={savingEdit} style={[styles.modalBtn, { flex: 1, backgroundColor: theme.text, borderColor: theme.text }]}>
                    <Text style={[styles.modalBtnText, { color: theme.bg }]}>{savingEdit ? "Saving..." : "Save"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Modal>

      {/* Add Post Modal */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <TouchableWithoutFeedback
            onPress={() => {
              if (!uploading) setModalOpen(false);
            }}
          >
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={{ 
              backgroundColor: theme.card, 
              borderTopLeftRadius: 30, 
              borderTopRightRadius: 30,
              paddingTop: 24,
              paddingHorizontal: 20,
              paddingBottom: Platform.OS === 'ios' ? 40 : 20,
              maxHeight: Dimensions.get('window').height * 0.9,
              width: '100%',
              borderWidth: 1,
              borderColor: theme.border
            }}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text, marginBottom: 16 }}>New Post</Text>

                <Pressable
                  style={{
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: "center",
                    backgroundColor: theme.card,
                    marginBottom: 12
                  }}
                  onPress={pickPostImage}
                  disabled={uploading}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
                    {newImage ? "Change Photo" : "Pick Photo"}
                  </Text>
                </Pressable>

                {newImage ? (
                  <Image source={{ uri: newImage }} style={{ width: '100%', height: 280, borderRadius: 16, marginBottom: 12 }} />
                ) : (
                  <View style={{ 
                    width: '100%', 
                    height: 280, 
                    borderRadius: 16, 
                    backgroundColor: isDark ? '#222' : '#f5f5f5', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginBottom: 12
                  }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '600' }}>
                      No photo selected
                    </Text>
                  </View>
                )}

                <TextInput
                  value={newPrice}
                  onChangeText={setNewPrice}
                  placeholder="Price (e.g. 1200)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    fontSize: 14,
                    backgroundColor: theme.bg,
                    color: theme.text,
                    marginBottom: 12
                  }}
                  editable={!uploading}
                />

                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text, marginBottom: 8, marginLeft: 4 }}>Category</Text>
                <Pressable
                  style={{
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: theme.bg,
                    marginBottom: 12
                  }}
                  onPress={() => setNewCategoryDropdownOpen(true)}
                  disabled={uploading}
                >
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                    {newCategory || "Select Category"}
                  </Text>
                  <Feather name="chevron-down" size={16} color={theme.text} />
                </Pressable>

                <TextInput
                  value={newTags}
                  onChangeText={setNewTags}
                  placeholder="Tags (comma separated) e.g. denim, y2k,"
                  placeholderTextColor={theme.textSecondary}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    fontSize: 14,
                    backgroundColor: theme.bg,
                    color: theme.text,
                    marginBottom: 12
                  }}
                  editable={!uploading}
                />

                <TextInput
                  value={newCaption}
                  onChangeText={setNewCaption}
                  placeholder="Caption..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    fontSize: 14,
                    backgroundColor: theme.bg,
                    color: theme.text,
                    minHeight: 60,
                    textAlignVertical: 'top',
                    marginBottom: 20
                  }}
                  editable={!uploading}
                />

                {postError ? (
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "800", textAlign: "center", marginBottom: 12 }}>
                    {postError}
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                  <Pressable
                    onPress={() => {
                      if (uploading) return;
                      setModalOpen(false);
                    }}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 14,
                      paddingVertical: 16,
                      alignItems: 'center',
                      backgroundColor: theme.card
                    }}
                    disabled={uploading}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "800", color: theme.text }}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={onCreatePost}
                    style={{
                      flex: 1,
                      backgroundColor: theme.text,
                      borderRadius: 14,
                      paddingVertical: 16,
                      alignItems: 'center'
                    }}
                    disabled={uploading}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "800", color: theme.bg }}>
                      {uploading ? `Posting ${uploadPct}%` : "Post"}
                    </Text>
                  </Pressable>
                </View>

                <Text style={{ 
                  fontSize: 11, 
                  color: theme.textSecondary, 
                  textAlign: 'center', 
                  marginTop: 4,
                  fontWeight: '600'
                }}>
                  Tip: tap a post to open • long-press to delete
                </Text>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Category Dropdown for Add Post Modal */}
      <Modal visible={newCategoryDropdownOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setNewCategoryDropdownOpen(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border, width: '100%', maxHeight: 400 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>Select Category</Text>
              <Pressable onPress={() => setNewCategoryDropdownOpen(false)} hitSlop={8}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORIES.map((c) => {
                const active = newCategory === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setNewCategory(c);
                      setNewCategoryDropdownOpen(false);
                    }}
                    style={{
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: theme.text, fontSize: 13 },
                        active && { opacity: 1 },
                      ]}
                    >
                      {c}
                    </Text>
                    {active && <Feather name="check" size={16} color={theme.text} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal*/}
      <Modal visible={editOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <TouchableWithoutFeedback onPress={() => setEditOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <View style={[styles.modalWrap, { justifyContent: 'center' }]}>
              <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border, width: '100%', padding: 20 }]}>
                <Text style={[styles.modalTitle, { color: theme.text, fontSize: 18, marginBottom: 15 }]}>Edit Profile</Text>

                <TextInput
                  value={editFullName}
                  onChangeText={setEditFullName}
                  placeholder="Your real name"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.captionInput, { borderColor: theme.border, backgroundColor: theme.bg, color: theme.text, paddingVertical: 12 }]}
                  editable={!uploading}
                />
                
                <View style={{ marginTop: 12 }}>
                  <TextInput
                    value={editAbout}
                    onChangeText={setEditAbout}
                    placeholder="Bio (Max 80 chars) ✨"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={80}
                    multiline
                    style={[styles.captionInput, { 
                      borderColor: theme.border, 
                      backgroundColor: theme.bg, 
                      color: theme.text, 
                      marginTop: 0, 
                      minHeight: 80, 
                      textAlignVertical: 'top',
                      paddingTop: 12
                    }]}
                    editable={!uploading}
                  />
                  <Text style={{ alignSelf: 'flex-end', fontSize: 11, fontWeight: '800', color: theme.textSecondary, marginTop: 6 }}>
                    {editAbout.length}/80
                  </Text>
                </View>

                <View style={[styles.modalRow, { marginTop: 20, gap: 12 }]}>
                  <Pressable
                    onPress={() => setEditOpen(false)}
                    style={[styles.modalBtn, styles.modalBtnGhost, { flex: 1, paddingVertical: 12, borderRadius: 12 }]}
                    disabled={uploading}
                  >
                    <Text style={[styles.modalBtnGhostText, { fontSize: 12, fontWeight: '900' }]}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={saveProfileEdits}
                    style={[styles.modalBtn, { flex: 1, backgroundColor: theme.text, borderColor: theme.text, paddingVertical: 12, borderRadius: 12 }]}
                    disabled={uploading}
                  >
                    <Text style={[styles.modalBtnText, { color: theme.bg, fontSize: 12, fontWeight: '900' }]}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Categories Dropdown Modal */}
      <Modal visible={dropdownOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setDropdownOpen(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border, width: '100%', maxHeight: 400 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>Select Category</Text>
              <Pressable onPress={() => setDropdownOpen(false)} hitSlop={8}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {["All", ...CATEGORIES].map((c) => {
                const active = activeCategoryFilter === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setActiveCategoryFilter(c);
                      setDropdownOpen(false);
                    }}
                    style={{
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: theme.text, fontSize: 13 },
                        active && { opacity: 1 },
                      ]}
                    >
                      {c}
                    </Text>
                    {active && <Feather name="check" size={16} color={theme.text} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal transparent visible={showSuccessModal} animationType="fade">
        <BlurView intensity={60} tint="dark" style={styles.blurOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successText}>item posted sucessfully (,,&#62;ヮ&#60;,,)!</Text>
          </View>
        </BlurView>
      </Modal>

      <DeleteConfirmModal 
        visible={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setPostToDelete(null);
        }}
        onConfirm={confirmDeletePost}
        message="Are you sure you want to delete this post from your profile?"
      />

      {/* Spacer + BottomNav like HomeScreen */}
      <View style={{ height: 0 }} />
      <BottomNav navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  blurOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  successCard: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 16,
    overflow: "hidden",
  },
  successText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  screen: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 44,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brand: { fontSize: 14, fontWeight: "900", color: "#111", maxWidth: 120 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111" },

  profileCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#fff",
    alignItems: "flex-start",
  },

  avatarWrap: { width: 72, height: 72 },
  avatar: { width: 72, height: 72, borderRadius: 18 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  editBadge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 28,
    height: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  editBtnRight: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  editBtnRightText: { fontSize: 12, fontWeight: "900", color: "#111" },

  name: { fontSize: 16, fontWeight: "900", color: "#111" },
  username: {
    marginTop: 2,
    fontSize: 12,
    color: "#111",
    opacity: 0.65,
    fontWeight: "800",
  },
  joined: {
    marginTop: 6,
    fontSize: 12,
    color: "#111",
    opacity: 0.75,
    fontWeight: "800",
  },
  about: {
    marginTop: 4,
    fontSize: 13,
    color: "#111",
    opacity: 0.85,
    fontWeight: "700",
    fontStyle: 'italic',
  },

  followRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  followPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    paddingVertical: 14,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  followNum: { fontSize: 14, fontWeight: "900", color: "#111" },
  followLbl: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
    color: "#111",
    opacity: 0.6,
  },

  ratingRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  ratingText: { fontSize: 13, fontWeight: "900", color: "#111" },
  stars: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingNumber: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
    opacity: 0.8,
  },

  addPostBtn: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.4,
    borderColor: "#111",
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  addPostText: { fontSize: 13, fontWeight: "900", color: "#111" },

  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "900",
    color: "#111",
  },

  // filter styles
  filtersWrap: { marginTop: 12, marginBottom: 8 },
  filterInput: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: "#111",
    fontWeight: "800",
  },
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  filterChipActive: { borderColor: "#111" },
  filterChipText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
    opacity: 0.7,
  },
  filterChipTextActive: { opacity: 1 },
  filterHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#111",
    opacity: 0.55,
  },

  tile: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
  },
  tileImg: { width: "100%", height: "100%" },
  priceBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  priceBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },

  // Modals
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 14,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111",
    marginBottom: 10,
  },

  pickBtn: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  pickBtnText: { fontSize: 12, fontWeight: "900", color: "#111" },

  previewImg: { marginTop: 10, width: "100%", height: 220, borderRadius: 16 },
  previewEmpty: {
    marginTop: 10,
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },

  captionInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: "#111",
    fontWeight: "800",
  },

  smallLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
    opacity: 0.8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: "#111" },
  chipText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
    opacity: 0.75,
  },
  chipTextActive: { opacity: 1 },

  modalRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: "#111",
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  modalBtnGhost: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#111",
  },
  modalBtnGhostText: { color: "#111", fontSize: 12, fontWeight: "900" },
  hint: {
    marginTop: 10,
    fontSize: 11,
    color: "#111",
    opacity: 0.6,
    fontWeight: "800",
  },

  // Progress bar
  progressBarWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 10,
    height: 4,
    borderRadius: 99,
    backgroundColor: "#111",
    opacity: 0.08,
    overflow: "hidden",
  },
  progressBar: { height: "100%", backgroundColor: "#111", opacity: 0.8 },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  loadingSmall: { paddingVertical: 20 },

  // ===== Post Detail =====
  detailScreen: { flex: 1, backgroundColor: "#fff" },
  detailTopbar: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  detailTitle: { fontSize: 14, fontWeight: "900", color: "#111" },
  trashBtn: {
    width: 40,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    alignSelf: "flex-end",
  },

  detailCard: { padding: 16 },
  detailUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  detailAvatar: { width: 38, height: 38, borderRadius: 14 },
  detailAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  detailName: { fontSize: 13, fontWeight: "900" },
  detailUsername: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    opacity: 0.6,
  },

  detailImgWrap: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f2f2f2",
  },
  detailImg: { width: "100%", height: 320, resizeMode: "cover" },

  detailMeta: { marginTop: 12 },
  detailPillsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  detailPillText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111",
    opacity: 0.75,
  },
  detailPillDark: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#111",
  },
  detailPillDarkText: { fontSize: 12, fontWeight: "900", color: "#fff" },

  detailCaption: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "900",
    opacity: 0.9,
  },

  tagsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "700",
    fontStyle: "italic",
    opacity: 0.7,
  },
  tagsEmpty: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "800",
    color: "#111",
    opacity: 0.5,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 24, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: '600' },
  modalBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  modalBtnText: { fontSize: 13, fontWeight: '900' },
});
