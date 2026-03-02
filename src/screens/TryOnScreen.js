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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
const FAL_KEY = "ebcbcd17-6b6e-4093-b344-bc64edd3591e:52775e23c3e5c4dc9934179e5bcafc15";
import { auth, storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const { width } = Dimensions.get("window");

export default function TryOnScreen({ route, navigation }) {
  const { tryOnPngUrl } = route.params; 
  
  const [bodyImage, setBodyImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

    try {
      // 1. Upload the body image to Firebase Storage so Fal can access it
      const response = await fetch(bodyImage.uri);
      const blob = await response.blob();
      const filename = `tryon_temp/${auth.currentUser?.uid || "guest"}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, blob);
      const bodyImageUrl = await getDownloadURL(storageRef);

      console.log("SENDING REQUEST WITH FAL KEY:", FAL_KEY ? FAL_KEY.slice(0, 8) + "..." : "UNDEFINED");

      // 2. Submit job to the Fal.ai asynchronous queue endpoint
      const submitRes = await fetch("https://queue.fal.run/fal-ai/idm-vton", {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          human_image_url: bodyImageUrl,
          garment_image_url: tryOnPngUrl,
          category: "upper_body", 
          description: "A piece of clothing", 
          crop: false,
          seed: Math.floor(Math.random() * 100000), 
        }),
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text();
        throw new Error(`Submission Failed (${submitRes.status}): ${errText}`);
      }

      const { request_id } = await submitRes.json();
      if (!request_id) throw new Error("No request_id returned from Fal.ai");

      // 3. Poll for the result
      let generatedUrl = null;
      let isCompleted = false;

      while (!isCompleted) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before checking

        const statusRes = await fetch(`https://queue.fal.run/fal-ai/idm-vton/requests/${request_id}/status`, {
          headers: {
            "Authorization": `Key ${FAL_KEY}`,
          },
        });

        if (!statusRes.ok) {
          const errText = await statusRes.text();
          throw new Error(`Polling Failed (${statusRes.status}): ${errText}`);
        }

        const statusData = await statusRes.json();
        
        if (statusData.status === "COMPLETED") {
          isCompleted = true;
          console.log("Fal Generation Completed!", statusData);

          // Fal queue system offloads heavy IDM-VTON results to a response_url
          if (statusData.response_url) {
             const finalRes = await fetch(statusData.response_url, {
                headers: { "Authorization": `Key ${FAL_KEY}` }
             });
             const finalData = await finalRes.json();
             console.log("Final Fetch Payload:", finalData);
             
             // Extract the physical image URL from the nested JSON
             generatedUrl = finalData.image?.url || finalData.image_url || finalData.url;
             
          } else if (statusData.response) {
             generatedUrl = statusData.response.image?.url || statusData.response.image_url;
          }
        } else if (statusData.status === "FAILED") {
          throw new Error("Fal.ai processing failed on their backend servers.");
        }
      }

      if (generatedUrl) {
        setResultImage(generatedUrl);
      } else {
        throw new Error("The AI finished but did not return a valid image URL.");
      }
    } catch (error) {
      console.error("Fal AI Fetch Error:", error);
      Alert.alert("Generation Failed", "Could not generate the try-on. " + error.message);
    } finally {
      setIsGenerating(false);
    }
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
        Alert.alert("Success!", "Your AI Try-On photo has been saved to your gallery!");
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
              <Text style={styles.generatingSubText}>This takes about 10-15 seconds</Text>
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
});