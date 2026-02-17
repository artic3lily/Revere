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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

import { auth, db, storage } from "../config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
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

// ADDED (same BottomNav you use in HomeScreen)
import BottomNav from "../components/BottomNav";

const CATEGORIES = ["Grunge", "Casual", "Elegant", "Chic", "Y2k"];

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
  const user = auth.currentUser;
  const uid = user?.uid;

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All");
  const [tagQuery, setTagQuery] = useState("");

  // counts
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  // Add Post modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newCaption, setNewCaption] = useState("");
  const [newImage, setNewImage] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);

  // Edit Profile modal
  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editAbout, setEditAbout] = useState("");

  // Post Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [ownerCache, setOwnerCache] = useState({}); // { [uid]: { photoURL, username, fullName } }
  const detailScrollRef = useRef(null);

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
            Alert.alert("Error", err?.message ?? "Could not load posts");
          }
        );
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

    if (!newImage) {
      Alert.alert("Missing photo", "Please select a photo for your post.");
      return;
    }

    const priceNumber =
      newPrice.trim().length === 0 ? null : Number(newPrice.trim());
    if (priceNumber !== null && Number.isNaN(priceNumber)) {
      Alert.alert("Invalid price", "Please enter a number like 1200");
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

      const storagePath = `posts/${uid}/${Date.now()}.jpg`;
      const { url, storagePath: savedPath } = await uploadImageToStorage({
        uri: newImage,
        storagePath,
        onProgress: setUploadPct,
      });

      await addDoc(collection(db, "posts"), {
        ownerId: uid,
        ownerName: profile?.fullName || "User",
        ownerUsername:
          profile?.username || (auth.currentUser?.email?.split("@")[0] ?? ""),
        ownerPhotoURL: profile?.photoURL || "",
        caption: newCaption.trim(),
        imageUrl: url,
        storagePath: savedPath,
        price: priceNumber,
        category: newCategory,
        tags: tagsArr,
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now(),
      });

      setModalOpen(false);

      // op, reset refresh to show new posts in feed
      setActiveCategoryFilter("All");
      setTagQuery("");
    } catch (e) {
      Alert.alert("Error", e?.message ?? "Could not create post");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const onDeletePost = async (post) => {
    Alert.alert("Delete post?", "This will remove your post.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "posts", post.id));
            if (post.storagePath) {
              await deleteObject(ref(storage, post.storagePath));
            }
            setDetailOpen(false);
            setActivePost(null);
          } catch (e) {
            Alert.alert(
              "Delete failed",
              e?.message ??
                "Delete blocked by rules. (You can delete only your own uploads)"
            );
          }
        },
      },
    ]);
  };

  // post detail helpers
  const openPostDetail = async (post) => {
    setActivePost(post);
    setDetailOpen(true);

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
      <Image source={{ uri: item.imageUrl }} style={styles.tileImg} />
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
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand} numberOfLines={1}>
          Revere
        </Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Profile
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        {/* Left: avatar */}
        <Pressable onPress={onChangeProfilePhoto} style={styles.avatarWrap}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Feather name="user" size={22} color="#111" />
            </View>
          )}
          <View style={styles.editBadge}>
            <Feather name="edit-2" size={12} color="#111" />
          </View>
        </Pressable>

        {/* Middle */}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile?.fullName ?? "Your Name"}</Text>
          <Text style={styles.username}>@{profile?.username ?? "username"}</Text>

          <Text style={styles.joined} numberOfLines={1}>
            {joinedText}
          </Text>

          <Text style={styles.about} numberOfLines={2}>
            {profile?.about?.trim()?.length
              ? profile.about
              : "Add a cute one-line bio ✨"}
          </Text>
        </View>

        {/* Right */}
        <Pressable onPress={openEditProfile} style={styles.editBtnRight}>
          <Feather name="edit-3" size={14} color="#111" />
          <Text style={styles.editBtnRightText}>Edit</Text>
        </Pressable>
      </View>

      {/* Follow stats */}
      <View style={styles.followRow}>
        <View style={styles.followPill}>
          <Text style={styles.followNum}>{followingCount}</Text>
          <Text style={styles.followLbl}>Following</Text>
        </View>
        <View style={styles.followPill}>
          <Text style={styles.followNum}>{followersCount}</Text>
          <Text style={styles.followLbl}>Followers</Text>
        </View>
        <View style={styles.followPill}>
          <Text style={styles.followNum}>{posts.length}</Text>
          <Text style={styles.followLbl}>Posts</Text>
        </View>
      </View>

      {/* Rating */}
      <View style={styles.ratingRow}>
        <Text style={styles.ratingText}>Rating</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Feather
              key={i}
              name="star"
              size={16}
              color="#111"
              style={{ opacity: i <= Math.round(ratingAvg) ? 1 : 0.25 }}
            />
          ))}
          <Text style={styles.ratingNumber}>{ratingAvg || "0.0"}</Text>
        </View>
      </View>

      {/* Add Post */}
      <Pressable style={styles.addPostBtn} onPress={openAddPost}>
        <Feather name="plus" size={16} color="#111" />
        <Text style={styles.addPostText}>Add Post</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Your Posts</Text>

      {/* Filters UI */}
      <View style={styles.filtersWrap}>
        <TextInput
          value={tagQuery}
          onChangeText={setTagQuery}
          placeholder="Search tags… (e.g. denim, y2k)"
          placeholderTextColor="#444"
          style={styles.filterInput}
        />

        <View style={styles.filterChipsRow}>
          {["All", ...CATEGORIES].map((c) => {
            const active = activeCategoryFilter === c;
            return (
              <Pressable
                key={c}
                onPress={() => setActiveCategoryFilter(c)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* little helper text */}
        <Text style={styles.filterHint}>
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
        <View style={styles.detailScreen}>
          {/* Top bar */}
          <View style={styles.detailTopbar}>
            <Pressable
              onPress={closePostDetail}
              hitSlop={12}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={20} color="#111" />
            </Pressable>

            <Text style={styles.detailTitle} numberOfLines={1}>
              Post
            </Text>

            {/* delete only own post */}
            <View style={{ width: 40 }}>
              {activePost?.ownerId === uid ? (
                <Pressable
                  onPress={() => onDeletePost(activePost)}
                  hitSlop={12}
                  style={styles.trashBtn}
                >
                  <Feather name="trash-2" size={18} color="#111" />
                </Pressable>
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
                    <View style={styles.detailAvatarPlaceholder}>
                      <Feather name="user" size={16} color="#111" />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName} numberOfLines={1}>
                      {detailOwner?.fullName || activePost?.ownerName || "User"}
                    </Text>
                    <Text style={styles.detailUsername} numberOfLines={1}>
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
                    source={{ uri: activePost?.imageUrl }}
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
      </Modal>

      {/* Add Post Modal */}
      <Modal visible={modalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback
          onPress={() => {
            if (!uploading) setModalOpen(false);
          }}
        >
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Post</Text>

            <Pressable
              style={styles.pickBtn}
              onPress={pickPostImage}
              disabled={uploading}
            >
              <Text style={styles.pickBtnText}>
                {newImage ? "Change Photo" : "Pick Photo"}
              </Text>
            </Pressable>

            {newImage ? (
              <Image source={{ uri: newImage }} style={styles.previewImg} />
            ) : (
              <View style={styles.previewEmpty}>
                <Text style={{ color: "#111", opacity: 0.7, fontSize: 12 }}>
                  No photo selected
                </Text>
              </View>
            )}

            <TextInput
              value={newPrice}
              onChangeText={setNewPrice}
              placeholder="Price (e.g. 1200)"
              placeholderTextColor="#444"
              keyboardType="numeric"
              style={styles.captionInput}
              editable={!uploading}
            />

            <Text style={styles.smallLabel}>Category</Text>
            <View style={styles.chipsRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewCategory(c)}
                  style={[styles.chip, newCategory === c && styles.chipActive]}
                  disabled={uploading}
                >
                  <Text
                    style={[
                      styles.chipText,
                      newCategory === c && styles.chipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={newTags}
              onChangeText={setNewTags}
              placeholder="Tags (comma separated) e.g. denim, y2k, black"
              placeholderTextColor="#444"
              style={styles.captionInput}
              editable={!uploading}
            />

            <TextInput
              value={newCaption}
              onChangeText={setNewCaption}
              placeholder="Caption…"
              placeholderTextColor="#444"
              style={styles.captionInput}
              editable={!uploading}
            />

            <View style={styles.modalRow}>
              <Pressable
                onPress={() => {
                  if (uploading) return;
                  setModalOpen(false);
                }}
                style={[styles.modalBtn, styles.modalBtnGhost]}
                disabled={uploading}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onCreatePost}
                style={styles.modalBtn}
                disabled={uploading}
              >
                <Text style={styles.modalBtnText}>
                  {uploading ? `Posting ${uploadPct}%` : "Post"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.hint}>
              Tip: tap a post to open • long-press to delete
            </Text>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal*/}
      <Modal visible={editOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setEditOpen(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <TextInput
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Your real name"
              placeholderTextColor="#444"
              style={styles.captionInput}
              editable={!uploading}
            />
            <TextInput
              value={editAbout}
              onChangeText={setEditAbout}
              placeholder="Bio / about you ✨"
              placeholderTextColor="#444"
              style={styles.captionInput}
              editable={!uploading}
            />

            <View style={styles.modalRow}>
              <Pressable
                onPress={() => setEditOpen(false)}
                style={[styles.modalBtn, styles.modalBtnGhost]}
                disabled={uploading}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveProfileEdits}
                style={styles.modalBtn}
                disabled={uploading}
              >
                <Text style={styles.modalBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Spacer + BottomNav like HomeScreen */}
      <View style={{ height: 0 }} />
      <BottomNav navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 8,
    fontSize: 12,
    color: "#111",
    opacity: 0.85,
    fontWeight: "800",
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
    paddingVertical: 10,
    alignItems: "center",
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
  detailName: { fontSize: 13, fontWeight: "900", color: "#111" },
  detailUsername: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    color: "#111",
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
    marginTop: 12,
    fontSize: 12,
    fontWeight: "800",
    color: "#111",
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
    fontWeight: "900",
    color: "#111",
    opacity: 0.7,
  },
  tagsEmpty: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "800",
    color: "#111",
    opacity: 0.5,
  },
});
