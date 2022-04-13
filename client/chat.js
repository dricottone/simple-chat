const saltSize = 16;        // recommended size for salt used in password derivation functions
const ivSize = 12;          // size for initial value array per AES GCM specification
const iterationNum = 10000; // lowest recommendable number of iterations for password derivation

// conversion functions
function arrayBufferToArray(buf) {
  return new Uint8Array(buf);
}
function arrayToBase64(arr) {
  return btoa(String.fromCharCode.apply(null, arr));
};
function base64ToArray(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(null));
};
function stringToArray(str) {
  return new TextEncoder().encode(str);
};
function arrayToString(arr) {
  return new TextDecoder().decode(arr);
};

// cryptography
async function password(passwd) {
  return window.crypto.subtle.importKey("raw", stringToArray(passwd), "PBKDF2", false, ["deriveKey"]);
};
async function derive(key, salt) {
  return window.crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iterationNum, hash: "SHA-256" }, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};
function buildMessage(salt, iv, arr) {
  let msg = new Uint8Array(saltSize+ivSize+arr.byteLength);
  msg.set(salt, 0);
  msg.set(iv, saltSize);
  msg.set(arr, saltSize+ivSize);
  return arrayToBase64(msg);
};
async function encrypt(str) {
  const salt = window.crypto.getRandomValues(new Uint8Array(saltSize));
  const iv = window.crypto.getRandomValues(new Uint8Array(ivSize));

  try {
    const key = await derive(passkey, salt);
    const buf = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, stringToArray(str));
    return buildMessage(salt, iv, arrayBufferToArray(buf));
  } catch (e) {
    console.log("encryption failed");
    return str;
  }
};
async function decrypt(blob) {
  const arr = base64ToArray(blob);
  const salt = arr.slice(0, saltSize);
  const iv = arr.slice(saltSize, saltSize+ivSize);
  const msg = arr.slice(saltSize+ivSize);

  try {
    const key = await derive(passkey, salt);
    const buf = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, msg);
    return arrayToString(arrayBufferToArray(buf));
  } catch (e) {
    console.log("decryption failed");
    return blob;
  }
};

function escapeHTML(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
};

// initialize passkey to null
var passkey;

function connect() {
  socket = new WebSocket('wss://api.dominic-ricottone.com/chat');

  // On close, reconnect after 1s (=1000ms)
  socket.onclose = () => {
    setTimeout(connect, 1000);
  };

  socket.onmessage = async (m) => {
    const el = document.createElement('li');
    if (passkey == null) {
      el.innerHTML = escapeHTML(m.data);
    } else {
      const decrypted = await decrypt(m.data);
      el.innerHTML = escapeHTML(decrypted);
    }
    document.getElementById('chat-room').appendChild(el);
  };
};

// try to initialize socket to a connection
var socket;
connect();

document.addEventListener("DOMContentLoaded", () => {
  // chat interface
  const chatInput = document.getElementById('chat-input');
  const chatButton = document.getElementById('chat-button');

  chatButton.onclick = async () => {
    if (passkey == null) {
      socket.send(chatInput.value);
    } else {
      const encrypted = await encrypt(chatInput.value);
      socket.send(encrypted);
    }
  };

  chatInput.addEventListener('keyup', (event) => {
    if (event.keyCode === 13) {
      event.preventDefault();
      chatButton.click();
    }
  });

  // password interface
  const passwdInput = document.getElementById('passwd-input');
  const passwdButton = document.getElementById('passwd-button');

  passwdButton.onclick = async () => {
    const key = await password(passwdInput.value);
    passkey = key
  };
});

