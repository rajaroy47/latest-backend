// src/script/test-payment.js

import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('📋 Environment Check:');
console.log(`   RAZORPAY_KEY_ID: ${process.env.RAZORPAY_KEY_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`   RAZORPAY_KEY_SECRET: ${process.env.RAZORPAY_KEY_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log('');

// Create Basic Auth header for Razorpay API
const credentials = Buffer.from(
  `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
).toString('base64');

// ==========================================================
// CONFIGURATION
// ==========================================================

const SERVICE_ID = "6a3112d7a90dc838c2de51f6"; // Replace with your actual service ID
const PLAN = "standard";
const AMOUNT = 899900; // ₹8,999 in paise
const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMmUzMTAyMDU4ZjM5NzhjZTlmYWZmZiIsImVtYWlsIjoiZm9ydGVzdGluZ3B1cnBvc2U2OThAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiZnVsbE5hbWUiOiJSYWphIFJveSIsImlhdCI6MTc4MTYxMjExNywiZXhwIjoxNzgxNjE1NDE3fQ.mJb_8rzvFrSiCV9xnnAtrDxBxRtK0c_qQf23gqOY0-E";

// ==========================================================
// MAIN FUNCTION
// ==========================================================

async function runPaymentTest() {
  try {
    console.log('🚀 Starting Razorpay payment test...\n');

    // Step 1: Create Razorpay order
    console.log('📝 Step 1: Creating Razorpay order...');
    const orderResponse = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: AMOUNT,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1,
        notes: {
          test: "true"
        }
      },
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const razorpayOrder = orderResponse.data;
    console.log('✅ Razorpay Order created:');
    console.log('   ID:', razorpayOrder.id);
    console.log('   Amount: ₹' + (razorpayOrder.amount / 100).toFixed(2));
    console.log('   Status:', razorpayOrder.status);

    // Step 2: Create order in your backend
    console.log('\n📝 Step 2: Creating order in backend...');
    const orderCreateResponse = await axios.post(
      'http://localhost:5000/api/orders',
      {
        serviceId: SERVICE_ID,
        plan: PLAN,
        amount: razorpayOrder.amount / 100,
        planFeatures: ['Feature 1', 'Feature 2', 'Feature 3'],
        customerDetails: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '9876543210',
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const dbOrder = orderCreateResponse.data.data.order;
    console.log('✅ Backend Order created:');
    console.log('   ID:', dbOrder._id);
    console.log('   Razorpay Order ID:', dbOrder.razorpayOrderId);
    console.log('   Status:', dbOrder.orderStatus);

    // Step 3: Create a payment using Razorpay API
    console.log('\n📝 Step 3: Creating payment...');
    const paymentResponse = await axios.post(
      'https://api.razorpay.com/v1/payments',
      {
        amount: AMOUNT,
        currency: "INR",
        payment_capture: 1,
      },
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = paymentResponse.data;
    console.log('✅ Payment created:');
    console.log('   ID:', payment.id);
    console.log('   Amount: ₹' + (payment.amount / 100).toFixed(2));
    console.log('   Status:', payment.status);

    // Step 4: Capture the payment (if not auto-captured)
    if (payment.status !== 'captured') {
      console.log('\n📝 Step 4: Capturing payment...');
      const captureResponse = await axios.post(
        `https://api.razorpay.com/v1/payments/${payment.id}/capture`,
        {
          amount: AMOUNT,
        },
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Payment captured:', captureResponse.data.id);
    }

    // Step 5: Generate signature
    console.log('\n📝 Step 5: Generating signature...');
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrder.id}|${payment.id}`)
      .digest('hex');
    console.log('✅ Signature:', signature);

    // Step 6: Verify payment on backend
    console.log('\n📝 Step 6: Verifying payment on backend...');
    const verifyResponse = await axios.post(
      'http://localhost:5000/api/payments/verify',
      {
        razorpay_order_id: razorpayOrder.id,
        razorpay_payment_id: payment.id,
        razorpay_signature: signature,
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Payment verified successfully!');
    console.log('Response:', JSON.stringify(verifyResponse.data, null, 2));

    // Step 7: Check order status
    console.log('\n📝 Step 7: Checking order status...');
    const orderCheck = await axios.get(
      'http://localhost:5000/api/orders/my-orders',
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      }
    );
    console.log('✅ Order Status:');
    console.log('   Total Orders:', orderCheck.data.data.length);
    if (orderCheck.data.data.length > 0) {
      const latestOrder = orderCheck.data.data[0];
      console.log('   Latest Order Status:', latestOrder.orderStatus);
      console.log('   Plan:', latestOrder.plan);
      console.log('   Amount: ₹' + latestOrder.amount);
    }

    console.log('\n🎉 Complete payment flow test passed!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

runPaymentTest();