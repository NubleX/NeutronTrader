// src/services/binanceDiagnostic.js - Debugging version
// Base URL for Binance Testnet
const BASE_URL = 'https://testnet.binance.vision';

// Function to log API requests and responses
function logRequest(method, url, headers = {}, body = null) {
  console.group(`API Request: ${method} ${url}`);
  console.log('Headers:', headers);
  if (body) console.log('Body:', body);
  console.groupEnd();
}

// Function to log API responses
function logResponse(method, url, response, data) {
  console.group(`API Response: ${method} ${url}`);
  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);
  console.log('Headers:', Object.fromEntries([...response.headers.entries()]));
  console.log('Data:', data);
  console.groupEnd();
}

// Function to log errors
function logError(method, url, error) {
  console.group(`API Error: ${method} ${url}`);
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Response Status:', error.response.status);
    console.error('Response Data:', error.response.data);
  }
  console.groupEnd();
}

/**
 * Handle response from fetch request
 */
async function handleResponse(response, method, url) {
  let data;
  try {
    // Try to parse as JSON
    data = await response.json();
  } catch (e) {
    // If not JSON, get as text
    data = await response.text();
  }
  
  logResponse(method, url, response, data);
  
  if (!response.ok) {
    const error = new Error(
      data.msg || `API request failed with status ${response.status}`
    );
    error.status = response.status;
    error.code = data.code;
    error.response = { data };
    throw error;
  }
  
  return data;
}

// Diagnostic ping to test connectivity to different endpoints
export async function testConnectivity() {
  console.log("--- Testing Binance Testnet Connectivity ---");
  
  try {
    // 1. Testing public ping endpoint
    console.log("1. Testing public ping endpoint...");
    const pingUrl = `${BASE_URL}/api/v3/ping`;
    logRequest('GET', pingUrl);
    
    try {
      const pingResponse = await fetch(pingUrl);
      await handleResponse(pingResponse, 'GET', pingUrl);
      console.log("✓ Ping successful");
    } catch (err) {
      console.error("✗ Ping failed:", err.message);
    }
    
    // 2. Testing CORS with options request
    console.log("\n2. Testing CORS with options request...");
    const corsUrl = `${BASE_URL}/api/v3/time`;
    logRequest('OPTIONS', corsUrl);
    
    try {
      const corsResponse = await fetch(corsUrl, { method: 'OPTIONS' });
      console.log("CORS Headers:", Object.fromEntries([...corsResponse.headers.entries()]));
      console.log(corsResponse.status === 204 || corsResponse.ok ? "✓ CORS preflight successful" : "✗ CORS preflight failed");
    } catch (err) {
      console.error("✗ CORS preflight failed:", err.message);
    }
    
    // 3. Testing server time endpoint
    console.log("\n3. Testing server time endpoint...");
    const timeUrl = `${BASE_URL}/api/v3/time`;
    logRequest('GET', timeUrl);
    
    try {
      const timeResponse = await fetch(timeUrl);
      const timeData = await handleResponse(timeResponse, 'GET', timeUrl);
      console.log("✓ Server time successful:", new Date(timeData.serverTime));
    } catch (err) {
      console.error("✗ Server time failed:", err.message);
    }
    
    // 4. Testing browser proxy issues
    console.log("\n4. Testing potential browser proxy/CORS issues...");
    const proxyCheckUrl = "https://httpbin.org/get";
    logRequest('GET', proxyCheckUrl);
    
    try {
      const proxyResponse = await fetch(proxyCheckUrl);
      await handleResponse(proxyResponse, 'GET', proxyCheckUrl);
      console.log("✓ External API call successful");
    } catch (err) {
      console.error("✗ External API call failed:", err.message);
    }
    
    console.log("\n--- Connectivity Tests Complete ---");
  } catch (error) {
    console.error("Connectivity test error:", error);
  }
}

// Testing signed requests
export async function testSignedRequest(apiConfig) {
  console.log("--- Testing Signed Request ---");
  
  if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
    console.error("Cannot test signed request: Missing API credentials");
    return;
  }
  
  // Use Web Crypto API to create signature
  async function createSignature(queryString, apiSecret) {
    console.log("Creating signature for:", queryString);
    
    try {
      const encoder = new TextEncoder();
      const key = encoder.encode(apiSecret);
      const data = encoder.encode(queryString);
      
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw', key,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
      );
      
      const signature = await window.crypto.subtle.sign(
        'HMAC', cryptoKey, data
      );
      
      // Convert to hex string
      const hexSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      console.log("Signature created:", hexSignature);
      return hexSignature;
    } catch (err) {
      console.error("Error creating signature:", err);
      throw err;
    }
  }
  
  try {
    // Prepare a simple account info request
    const params = {
      timestamp: Date.now(),
      recvWindow: 5000 // Adding a receive window to allow for time differences
    };
    
    // Create query string
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    // Sign the request
    const signature = await createSignature(queryString, apiConfig.apiSecret);
    
    // Create the full URL
    const url = `${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`;
    
    // Log the request details (omitting the actual secret)
    console.log("Request URL:", url);
    console.log("API Key:", apiConfig.apiKey);
    console.log("API Secret:", "******" + apiConfig.apiSecret.slice(-4));
    
    // Make the request
    const requestInit = {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiConfig.apiKey
      }
    };
    
    logRequest('GET', url, requestInit.headers);
    
    // Execute the request
    const response = await fetch(url, requestInit);
    
    // Handle the response
    if (response.ok) {
      const data = await response.json();
      console.log("✓ Signed request successful");
      console.log("Response:", data);
      return data;
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text();
      }
      
      console.error("✗ Signed request failed");
      console.error("Status:", response.status);
      console.error("Error data:", errorData);
      
      if (errorData && errorData.code === -1022) {
        console.error("This is a signature error. Check your API secret or system clock.");
      } else if (errorData && errorData.code === -2015) {
        console.error("Invalid API-key, IP, or permissions for action.");
      }
      
      throw new Error(errorData.msg || `API request failed with status ${response.status}`);
    }
  } catch (error) {
    console.error("Signed request test error:", error);
    throw error;
  }
}

// Test with a simpler URL to check browser restrictions
export async function testSimpleRequest() {
  console.log("--- Testing Simple Requests ---");
  
  const urls = [
    "https://testnet.binance.vision/api/v3/ping",
    "https://api.binance.com/api/v3/ping",    // Main Binance API (no auth)
    "https://httpbin.org/get",                // General test service
    "https://api.coindesk.com/v1/bpi/currentprice.json" // Bitcoin price API
  ];
  
  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    
    try {
      const response = await fetch(url);
      let data;
      
      try {
        data = await response.json();
      } catch (e) {
        data = await response.text();
      }
      
      console.log("Status:", response.status);
      console.log("Response:", data);
      console.log("✓ Request successful");
    } catch (error) {
      console.error("✗ Request failed:", error.message);
    }
  }
}