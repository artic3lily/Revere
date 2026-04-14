import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Alert, Modal, ActivityIndicator, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import CryptoJS from 'crypto-js';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc, runTransaction } from 'firebase/firestore';

export default function CheckoutScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { items, total } = route.params || { items: [], total: 0 };
  
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    city: '',
    address: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod', 'esewa'
  const [processing, setProcessing] = useState(false);
  
  // WebView States
  const [esewaHtml, setEsewaHtml] = useState(null);
  
  const [activePaymentType, setActivePaymentType] = useState(null);

  // Success Modal
  const [showSuccess, setShowSuccess] = useState(false);

  // Fallback
  if (!items || items.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.text }}>No items to checkout.</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: theme.primary || '#111', fontWeight: 'bold' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const processOrder = async (methodUsed) => {
    try {
      setProcessing(true);
      const uid = auth.currentUser?.uid;
      const sellerId = items[0].ownerId;

      await runTransaction(db, async (transaction) => {
        // 1. Fetch latest post docs to check if they are already sold
        const postRefs = items.map(item => doc(db, 'posts', item.id));
        const postSnaps = await Promise.all(postRefs.map(ref => transaction.get(ref)));

        // 2. Availability Check
        for (const snap of postSnaps) {
          if (!snap.exists()) {
            throw new Error(`Item "${snap.id}" no longer exists.`);
          }
          if (snap.data().sold) {
            throw new Error(`Item "${snap.data().caption || snap.id}" is already sold.`);
          }
        }

        // 3. Create the order document reference
        const orderRef = doc(collection(db, 'orders'));
        transaction.set(orderRef, {
          buyerId: uid,
          sellerId: sellerId,
          items: items.map(i => ({ 
            id: i.id, 
            title: i.caption, 
            price: i.price, 
            image: i.imageUrl || i.tryOnWhiteUrl || null 
          })),
          totalAmount: total,
          shipping: form,
          paymentMethod: methodUsed,
          status: 'pending',
          createdAt: serverTimestamp()
        });

        // 4. Mark items as sold immediately
        items.forEach(item => {
          transaction.update(doc(db, 'posts', item.id), { sold: true });
        });

        // 5. Delete from shopping cart
        items.forEach(item => {
          transaction.delete(doc(db, 'users', uid, 'cart', item.id));
        });

        // 6. Seller Notification: New Order
        const sellerNotifRef = doc(collection(db, 'notifications'));
        transaction.set(sellerNotifRef, {
          targetUserId: sellerId,
          type: 'order_received',
          title: 'New Order Received! 🛍️',
          body: `${form.fullName} ordered ${items.length} item(s) via ${methodUsed.toUpperCase()}.\nTap the checkmark to confirm shipment!`,
          orderId: orderRef.id,
          itemIds: items.map(i => i.id),
          buyerId: uid,
          isShipped: false,
          read: false,
          createdAt: serverTimestamp()
        });

        // 7. Buyer Notification: Order History Record
        const buyerNotifRef = doc(collection(db, 'notifications'));
        transaction.set(buyerNotifRef, {
          targetUserId: uid,
          type: 'order_processing',
          title: 'Order Confirmed! 👍',
          body: `Your order from @${items[0]?.ownerUsername} is being processed.\nItems: ${items.map(i => i.caption).join(', ')}\nTotal: Rs. ${total}`,
          orderId: orderRef.id,
          read: false,
          createdAt: serverTimestamp()
        });
      });

      setShowSuccess(true);
      
    } catch (e) {
      console.log('Checkout Error', e);
      Alert.alert('Checkout Failed', e.message || 'One or more items are no longer available.');
    } finally {
      setProcessing(false);
      setEsewaHtml(null);
      setActivePaymentType(null);
    }
  };

  const handleCheckout = async () => {
    if (!form.fullName || !form.phone || !form.city || !form.address) {
      Alert.alert('Missing Details', 'Please fill out all shipping details.');
      return;
    }

    const uuid = `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (paymentMethod === 'esewa') {
      const message = `total_amount=${total},transaction_uuid=${uuid},product_code=EPAYTEST`;
      const secret = '8gBm/:&EnhH.1/q'; 
      const hash = CryptoJS.HmacSHA256(message, secret);
      const signature = CryptoJS.enc.Base64.stringify(hash);

      const htmlContent = `
        <html>
          <body onload="document.forms[0].submit()">
            <form action="https://rc-epay.esewa.com.np/api/epay/main/v2/form" method="POST">
              <input type="hidden" name="amount" value="${total}" />
              <input type="hidden" name="tax_amount" value="0" />
              <input type="hidden" name="total_amount" value="${total}" />
              <input type="hidden" name="transaction_uuid" value="${uuid}" />
              <input type="hidden" name="product_code" value="EPAYTEST" />
              <input type="hidden" name="product_service_charge" value="0" />
              <input type="hidden" name="product_delivery_charge" value="0" />
              <input type="hidden" name="success_url" value="https://revere-success.com" />
              <input type="hidden" name="failure_url" value="https://revere-failure.com" />
              <input type="hidden" name="signed_field_names" value="total_amount,transaction_uuid,product_code" />
              <input type="hidden" name="signature" value="${signature}" />
            </form>
          </body>
        </html>
      `;
      setEsewaHtml(htmlContent);
      setActivePaymentType('esewa');
      return;
    }



    // Process COD Order
    processOrder('cod');
  };

  const onNavigationStateChange = (navState) => {
    if (activePaymentType === 'esewa') {
      if (navState.url.includes('revere-success.com')) {
        processOrder('esewa');
      } else if (navState.url.includes('revere-failure.com')) {
        Alert.alert('Payment Failed', 'eSewa transaction was cancelled.');
        setEsewaHtml(null);
        setActivePaymentType(null);
      }
    }
  };

  const PaymentCard = ({ method, label, icon }) => {
    const isSelected = paymentMethod === method;
    return (
      <Pressable 
        style={[styles.payCard, { 
          backgroundColor: isSelected ? (theme.primary ? theme.primary + '20' : '#f0f0f0') : theme.card,
          borderColor: isSelected ? (theme.primary || '#111') : theme.border 
        }]}
        onPress={() => setPaymentMethod(method)}
      >
        <Feather name={isSelected ? "check-circle" : "circle"} size={20} color={isSelected ? (theme.primary || '#111') : theme.textSecondary} style={{ marginRight: 12 }} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        
        {/* Order Summary */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>
        <View style={[styles.summaryBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary, fontWeight: '600', marginBottom: 6 }}>
            {items.length} Item(s) from Seller: @{items[0]?.ownerUsername}
          </Text>
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.text }}>Total to Pay:</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.primary || '#111' }}>Rs. {total}</Text>
          </View>
        </View>

        {/* Shipping Form */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Shipping Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="John Doe"
            placeholderTextColor={theme.textSecondary}
            value={form.fullName}
            onChangeText={(t) => setForm({...form, fullName: t})}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Phone Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="98XXXXXXXX"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => setForm({...form, phone: t})}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>City</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Kathmandu"
            placeholderTextColor={theme.textSecondary}
            value={form.city}
            onChangeText={(t) => setForm({...form, city: t})}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Specific Address / Landmark</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text, height: 80 }]}
            placeholder="Baneshwor, near Big Mart"
            placeholderTextColor={theme.textSecondary}
            multiline
            value={form.address}
            onChangeText={(t) => setForm({...form, address: t})}
          />
        </View>

        {/* Payment Methods */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Payment Method</Text>
        
        <PaymentCard method="cod" label="Cash on Delivery (COD)" />
        <PaymentCard method="esewa" label="Pay with eSewa" />

      </ScrollView>

      {/* Footer Confirm */}
      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
        <Pressable 
          style={[styles.confirmBtn, { backgroundColor: theme.buttonBg, opacity: processing ? 0.6 : 1 }]} 
          onPress={handleCheckout}
          disabled={processing}
        >
          <Text style={[styles.confirmText, { color: theme.buttonText }]}>
            {processing ? 'Processing...' : `Place Order (Rs. ${total})`}
          </Text>
        </Pressable>
      </View>

      {/* Payment WebView Modal */}
      <Modal visible={activePaymentType !== null} animationType="slide" transparent={false}>
         <View style={[styles.header, { backgroundColor: theme.header, paddingTop: 40, borderBottomWidth: 1, borderColor: '#eee' }]}>
            <Pressable onPress={() => { setEsewaHtml(null); setActivePaymentType(null); }} style={{ padding: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary || '#000' }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '800' }}>eSewa Secure</Text>
            <View style={{ width: 60 }} />
         </View>
         {activePaymentType === 'esewa' && esewaHtml && (
           <WebView 
             source={{ html: esewaHtml }} 
             onNavigationStateChange={onNavigationStateChange} 
             startInLoadingState={true}
           />
         )}
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>
              Order Confirmed! 👍
            </Text>

            <Image
              source={require('../../assets/images/thumps.gif')}
              style={styles.kittyGif}
              resizeMode="contain"
            />

            <Text style={[styles.fullBodyText, { color: theme.textSecondary, textAlign: 'center', marginBottom: 20 }]}>
              Your order is being processed! Check your notifications for details.
            </Text>

            <Pressable 
              onPress={() => {
                setShowSuccess(false);
                navigation.navigate('Home');
              }} 
              style={[styles.confirmBtn, { width: '100%', backgroundColor: theme.text }]}
            >
              <Text style={[styles.confirmText, { color: theme.bg }]}>Return Home</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  summaryBox: { padding: 16, borderRadius: 12, borderWidth: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '600'
  },
  payCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 2, marginBottom: 12
  },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1, paddingBottom: 32
  },
  confirmBtn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  confirmText: { fontSize: 16, fontWeight: '900' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24
  },
  modalContent: {
    width: '100%', padding: 24, borderRadius: 28, borderWidth: 1,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    alignItems: 'center'
  },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 16 },
  kittyGif: { width: 160, height: 160, marginBottom: 16 },
  fullBodyText: { fontSize: 14, lineHeight: 22, fontWeight: '600', paddingHorizontal: 10 },
});
