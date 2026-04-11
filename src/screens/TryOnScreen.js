import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { HF_TOKEN } from "@env";
import { auth, db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

const HF_SPACE_URL = "https://yisol-idm-vton.hf.space";

// Upload an image to the HuggingFace Space and return the file path
const uploadToHFSpace = async (uri, token) => {
  const formData = new FormData();
  formData.append("files", { uri, name: "image.jpg", type: "image/jpeg" });
  const uploadRes = await fetch(`${HF_SPACE_URL}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`HF Upload Failed (${uploadRes.status}): ${err}`);
  }
  const result = await uploadRes.json();
  // Returns array of paths e.g. ["/tmp/gradio/xxx/image.jpg"]
  return Array.isArray(result) ? result[0] : result;
};

const { width } = Dimensions.get("window");

export default function TryOnScreen({ route, navigation }) {
  const { tryOnPngUrl } = route.params; 
  
  const [bodyImage, setBodyImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const pickBodyImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "We need camera roll permissions to upload your photo."
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setBodyImage(result.assets[0]);
    }
  };

  const takeBodyPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "We need camera permissions to take a photo."
      );
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setBodyImage(result.assets[0]);
    }
  };

  const generateTryOn = async () => {
    if (!bodyImage) {
      Alert.alert("Missing Photo", "Please upload a photo of yourself first!");
      return;
    }

    setIsGenerating(true);

    let tokens = [HF_TOKEN];
    try {
      const docSnap = await getDoc(doc(db, "config", "api_keys"));
      if (docSnap.exists() && docSnap.data().hf_tokens) {
         const dbTokens = docSnap.data().hf_tokens;
         if (Array.isArray(dbTokens) && dbTokens.length > 0) {
            tokens = dbTokens;
         }
      }
    } catch(err) {
      console.log("Failed to fetch dynamic tokens", err);
    }

    let success = false;
    let lastError = null;

    for (let i = 0; i < tokens.length; i++) {
      const currentToken = tokens[i];
      try {
        console.log(`Trying Token ${i + 1}/${tokens.length}...`);
        
        // 1. Upload both images to the HF Space in parallel
        const [humanFilePath, garmentFilePath] = await Promise.all([
          uploadToHFSpace(bodyImage.uri, currentToken),
          uploadToHFSpace(tryOnPngUrl, currentToken),
        ]);

        // 2. Call the named /tryon endpoint directly (Gradio 4.x named API)
        const callRes = await fetch(`${HF_SPACE_URL}/call/tryon`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            data: [
              {
                background: { path: humanFilePath, meta: { _type: "gradio.FileData" } },
                layers: [],
                composite: null,
              },
              { path: garmentFilePath, meta: { _type: "gradio.FileData" } },
              "A piece of clothing", // garment_des
              true,  // is_checked (auto-masking)
              true,  // is_checked_crop
              30,    // denoise_steps
              42,    // seed
            ],
          }),
        });

        if (!callRes.ok) {
          const err = await callRes.text();
          throw new Error(`Call Failed (${callRes.status}): ${err}`);
        }

        const { event_id } = await callRes.json();
        if (!event_id) throw new Error("No event_id returned from HuggingFace.");

        // 3. Stream the result via XHR SSE on the event endpoint
        let generatedUrl = null;

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", `${HF_SPACE_URL}/call/tryon/${event_id}`);
          xhr.setRequestHeader("Authorization", `Bearer ${currentToken}`);

          let lastIndex = 0;

          const timeout = setTimeout(() => {
            xhr.abort();
            reject(new Error("Timed out after 5 minutes. The HF Space may be overloaded."));
          }, 5 * 60 * 1000);

          xhr.onprogress = () => {
            const chunk = xhr.responseText.slice(lastIndex);
            lastIndex = xhr.responseText.length;

            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("event: error")) {
                clearTimeout(timeout);
                reject(new Error("CPU/GPU Quota exceeded or Server Overloaded"));
                xhr.abort();
                return;
              }
              
              if (!line.startsWith("data:")) continue;
              try {
                const data = JSON.parse(line.slice(5).trim());
                if (Array.isArray(data) && data.length > 0) {
                  const imgData = data[0];
                  if (imgData && (imgData.url || imgData.path)) {
                    generatedUrl = imgData.url || `${HF_SPACE_URL}/file=${imgData.path}`;
                    clearTimeout(timeout);
                    resolve();
                    xhr.abort();
                    return;
                  }
                }
              } catch (_) {}
            }
          };

          xhr.onload = () => {
            clearTimeout(timeout);
            if (!generatedUrl) reject(new Error("SSE stream ended without a result."));
            else resolve();
          };

          xhr.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("SSE connection error."));
          };

          xhr.send();
        });

        if (!generatedUrl) {
          throw new Error("No image URL in result. Please try again.");
        }

        setResultImage(generatedUrl);
        success = true;
        break; // Successfully generated, break loop!
        
      } catch (error) {
        console.warn(`HuggingFace Try-On Error (Token ${i + 1}):`, error.message);
        lastError = error;
        // Wait 2.5 seconds before trying the next token to avoid IP spam ban!
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    if (!success) {
      console.error("All tokens failed. Last error:", lastError?.message);
      Alert.alert(
        "Generation Failed", 
        "All AI servers are currently overloaded or out of daily limits. Please try again later."
      );
    }

    setIsGenerating(false);
  };

  const shareImage = async () => {
    if (!resultImage) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device.");
        return;
      }
      const fileUri = FileSystem.cacheDirectory + `tryon_${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync(resultImage, fileUri);
      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share your fit',
        UTI: 'public.jpeg'
      });
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Could not share photo. " + error.message);
    }
  };

  const saveToGallery = async () => {
    if (!resultImage) return;

    try {
      // 1. Download the remote image strictly to the app's local cache
      const fileUri = FileSystem.cacheDirectory + `tryon_${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync(resultImage, fileUri);

      // 2. Attempt to request permissions, but IGNORE crashes caused by the Expo Go AUDIO bug
      try {
        await MediaLibrary.requestPermissionsAsync(true); // Attempt write-only
      } catch (permError) {
        console.warn("Expected Expo Go Audio Manifest bug occurred. Bypassing.", permError);
        // Do not return here. Android 13+ scoped storage allows createAssetAsync implicitly.
      }

      // 3. Force-save the local file to the camera roll
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      if (asset) {
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 2500);
      } else {
        throw new Error("Failed to create media asset.");
      }
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Could not save photo. " + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Try On</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Step 1: Show the Item */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. The Item</Text>
          <View style={styles.itemContainer}>
            <Image source={{ uri: tryOnPngUrl }} style={styles.itemImage} />
          </View>
        </View>

        {/* Step 2: User Photo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Your Photo</Text>
          <Text style={styles.sectionSubtitle}>
            Stand straight, facing the camera. Wear tight clothes for the best fit.
          </Text>
          
          {bodyImage ? (
            <View>
              <View style={styles.uploadBox}>
                <Image source={{ uri: bodyImage.uri }} style={styles.uploadedImage} />
              </View>
              <View style={styles.photoActionsRow}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={takeBodyPhoto}>
                  <Ionicons name="camera-outline" size={18} color="#000" />
                  <Text style={styles.photoActionBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoActionBtn} onPress={pickBodyImage}>
                  <Ionicons name="image-outline" size={18} color="#000" />
                  <Text style={styles.photoActionBtnText}>Choose Other</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoActionsRow}>
              <TouchableOpacity style={styles.uploadBoxSplit} onPress={takeBodyPhoto}>
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color="#666" />
                  <Text style={styles.uploadText}>Take Photo</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadBoxSplit} onPress={pickBodyImage}>
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#666" />
                  <Text style={styles.uploadText}>Upload</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Step 3: Magic Button or Result */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. The Result</Text>
          
          {isGenerating ? (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.generatingText}>Fitting your clothes...</Text>
              <Text style={styles.generatingSubText}>This may take 1-2 minutes, please wait 
                   ✧｡٩(ˊᗜˋ )و✧</Text>
            </View>
          ) : resultImage ? (
            <View style={styles.resultContainer}>
              <Image source={{ uri: resultImage }} style={styles.resultImage} />
              
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.saveActionBtn} onPress={saveToGallery}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.saveActionBtnText}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareActionBtn} onPress={shareImage}>
                  <Ionicons name="share-outline" size={20} color="#000" />
                  <Text style={styles.shareActionBtnText}>Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.resetButton} onPress={() => setResultImage(null)}>
                <Text style={styles.resetButtonText}>Try Another Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.generateButton, !bodyImage && styles.generateButtonDisabled]} 
              onPress={generateTryOn}
              disabled={!bodyImage}
            >
              <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.generateButtonText}>Generate Fit</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      <Modal transparent visible={showSuccessModal} animationType="fade">
        <BlurView intensity={60} tint="dark" style={styles.blurOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successText}>Successfully saved to your gallery! (ᵔᗜᵔ)◜</Text>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 15,
  },
  itemContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  uploadBox: {
    width: "100%",
    height: width * 1.2, 
    backgroundColor: "#fafafa",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#eee",
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBoxSplit: {
    flex: 1,
    height: 120,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#eee",
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  photoActionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    marginHorizontal: -5,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  photoActionBtnText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  uploadPlaceholder: {
    alignItems: "center",
  },
  uploadText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  generateButton: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  generateButtonDisabled: {
    backgroundColor: "#ccc",
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  generatingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  generatingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  generatingSubText: {
    marginTop: 5,
    fontSize: 14,
    color: "#666",
  },
  resultContainer: {
    alignItems: "center",
  },
  resultImage: {
    width: "100%",
    height: width * 1.3,
    borderRadius: 16,
    resizeMode: "cover",
    marginBottom: 20,
  },
  saveButton: { // keeping purely for backwards compatibility if needed internally
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  saveActionBtn: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
  },
  saveActionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  shareActionBtn: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#000",
  },
  shareActionBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  resetButton: {
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
    marginTop: 5,
  },
  resetButtonText: {
    color: "#8E8E93", // Minimalistic iOS/modern gray
    fontSize: 14,
    fontWeight: "400",
    textDecorationLine: "underline",
  },
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
});