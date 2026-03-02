import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Alert, Modal, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import CryptoJS from 'crypto-js';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';

export default function CheckoutScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { items, total } = route.params || { items: [], total: 0 };
  
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    city: '',
    address: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod', 'esewa', 'khalti'
  const [processing, setProcessing] = useState(false);
  
  // WebView States
  const [esewaHtml, setEsewaHtml] = useState(null);
  const [khaltiUrl, setKhaltiUrl] = useState(null);
  
  const [activePaymentType, setActivePaymentType] = useState(null);

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

      const orderRef = await addDoc(collection(db, 'orders'), {
        buyerId: uid,
        sellerId: sellerId,
        items: items.map(i => ({ id: i.id, title: i.caption, price: i.price, image: i.imageUrl || i.tryOnWhiteUrl || null })),
        totalAmount: total,
        shipping: form,
        paymentMethod: methodUsed,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      const batch = writeBatch(db);

      items.forEach(item => {
        const cartRef = doc(db, 'users', uid, 'cart', item.id);
        batch.delete(cartRef);
      });

      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        targetUserId: sellerId,
        type: 'order_received',
        title: 'New Order Received! 🛍️',
        body: `${form.fullName} ordered ${items.length} item(s) via ${methodUsed.toUpperCase()}.`,
        orderId: orderRef.id,
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      Alert.alert('Order Confirmed!', 'Your order has been placed successfully.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
      
    } catch (e) {
      console.log('Checkout Error', e);
      Alert.alert('Error', 'Could not process checkout.');
    } finally {
      setProcessing(false);
      setEsewaHtml(null);
      setKhaltiUrl(null);
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

    if (paymentMethod === 'khalti') {
      try {
        setProcessing(true);
        const res = await fetch('https://a.khalti.com/api/v2/epayment/initiate/', {
          method: 'POST',
          headers: {
            'Authorization': 'Key 3ff3ad9730c44ec9becd4220b8f1cdd7', // Test Key
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            return_url: "https://revere-khalti.com",
            website_url: "https://revere-khalti.com",
            amount: total * 100, // Requires paisa
            purchase_order_id: uuid,
            purchase_order_name: "Revere Items",
            customer_info: {
              name: form.fullName,
              email: "test@revere.com",
              phone: form.phone.replace(/[^0-9]/g, '').slice(0,10).padStart(10, '9') || "9800000000"
            }
          })
        });
        const data = await res.json();
        
        if (data.payment_url) {
          setKhaltiUrl(data.payment_url);
          setActivePaymentType('khalti');
        } else {
          Alert.alert('Khalti Error', JSON.stringify(data));
        }
      } catch (e) {
        Alert.alert('Khalti Request Failed', e?.message);
      } finally {
        setProcessing(false);
      }
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
    } else if (activePaymentType === 'khalti') {
      if (navState.url.includes('revere-khalti.com')) {
        // Technically Khalti appends ?pidx=...&status=Completed
        if (navState.url.includes('status=Completed')) {
          processOrder('khalti');
        } else if (navState.url.includes('User%20canceled')) {
          Alert.alert('Payment Cancelled', 'Khalti transaction cancelled.');
          setKhaltiUrl(null);
          setActivePaymentType(null);
        } else {
           processOrder('khalti'); // fallback success
        }
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
        <PaymentCard method="khalti" label="Pay with Khalti" />

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
            <Pressable onPress={() => { setEsewaHtml(null); setKhaltiUrl(null); setActivePaymentType(null); }} style={{ padding: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary || '#000' }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '800' }}>{activePaymentType === 'esewa' ? 'eSewa Secure' : 'Khalti Secure'}</Text>
            <View style={{ width: 60 }} />
         </View>
         {activePaymentType === 'esewa' && esewaHtml && (
           <WebView 
             source={{ html: esewaHtml }} 
             onNavigationStateChange={onNavigationStateChange} 
             startInLoadingState={true}
           />
         )}
         {activePaymentType === 'khalti' && khaltiUrl && (
           <WebView 
             source={{ uri: khaltiUrl }} 
             onNavigationStateChange={onNavigationStateChange} 
             startInLoadingState={true}
           />
         )}
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
  confirmText: { fontSize: 16, fontWeight: '900' }
});
