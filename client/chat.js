const saltSize = 16;        // recommended size for salt used in password derivation functions
const ivSize = 12;          // size for initial value array per AES GCM specification
const iterationNum = 10000; // lowest recommendable number of iterations for password derivation
const sigSize = 4096;       // recommended size for digital signatures

// conversion functions
function arrayBufferToArray(buf) {
  return new Uint8Array(buf);
}
function arrayToBase64(arr) {
  return btoa(String.fromCharCode.apply(null, arr));
};
function arrayToArrayBuffer(arr) {
  return arr.buffer;
}
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
async function ephemeralKeyPair() {
  return window.crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: sigSize, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, false, ["sign", "verify"]);
};
async function pgpKeyPair(privateKey) {
  return window.crypto.subtle.importKey("pkcs8", base64ToArray(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign", "verify"]);
};
async function encrypt(str) {
  const salt = window.crypto.getRandomValues(new Uint8Array(saltSize));
  const iv = window.crypto.getRandomValues(new Uint8Array(ivSize));
  const arr = arrayToArrayBuffer(stringToArray(str));

  try {
    const key = await derive(passkey, salt);
    const buf = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, arr);
    return [salt, iv, buf];
  } catch (e) {
    console.log("encryption failed");
    return [new Uint8Array(saltSize), new ArrayBuffer(ivSize), arr];
  }
};
async function sign(arr) {
  try {
    return await window.crypto.subtle.sign("RSASSA-PKCS1-v1_5", keypair.privateKey, arr);
  } catch(e) {
    console.log("signing failed");
    return new ArrayBuffer(sigSize / 8);
  }
}
async function justSign(str) {
  const arr = arrayToArrayBuffer(stringToArray(str));
  const sig = await sign(arr);

  let msg = new Uint8Array(saltSize+ivSize+(sigSize/8)+arr.byteLength);
  msg.set(arrayBufferToArray(sig), saltSize+ivSize);
  msg.set(arrayBufferToArray(arr), saltSize+ivSize+(sigSize/8));

  return arrayToBase64(msg);
}
async function encryptAndSign(str) {
  const [salt, iv, arr] = await encrypt(str);
  const sig = await sign(arr);

  let msg = new Uint8Array(saltSize+ivSize+(sigSize/8)+arr.byteLength);
  msg.set(arrayBufferToArray(salt), 0);
  msg.set(arrayBufferToArray(iv), saltSize);
  msg.set(arrayBufferToArray(sig), saltSize+ivSize);
  msg.set(arrayBufferToArray(arr), saltSize+ivSize+(sigSize/8));

  return arrayToBase64(msg);
};
async function verify(sig, arr) {
  try {
    for (let i = 0; i < keychain.length; i++) {
      let trust = await window.crypto.subtle.verify("RSASSA-PKCS1-v1_5", keychain[i], sig, arr);
      if (trust === true) { return true; }
    }

    console.log("could not verify signature");
    return false;
  } catch(e) {
    console.log("verification failed")
    return false;
  }
}
async function decrypt(passkey, salt, iv, arr) {
  try {
    const key = await derive(passkey, salt);
    const buf = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, arr);
    return arrayToString(arrayBufferToArray(buf));
  } catch (e) {
    console.log("decryption failed");
    return arrayToString(arr);
  }
};
async function justVerify(blob) {
  const arr = base64ToArray(blob);
  const sig = arr.slice(saltSize+ivSize, saltSize+ivSize+(sigSize/8));
  const msg = arr.slice(saltSize+ivSize+(sigSize/8));

  await verify(arrayToArrayBuffer(sig), arrayToArrayBuffer(msg));
  return arrayToString(msg);
}
async function verifyAndDecrypt(blob) {
  const arr = base64ToArray(blob);
  const salt = arr.slice(0, saltSize);
  const iv = arr.slice(saltSize, saltSize+ivSize);
  const sig = arr.slice(saltSize+ivSize, saltSize+ivSize+(sigSize/8));
  const msg = arr.slice(saltSize+ivSize+(sigSize/8));

  await verify(sig, msg);
  return await decrypt(passkey, salt, iv, msg);
}
function escapeHTML(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
};

// initialize passkey to null
var passkey;

async function initializeKeyChain(el) {
  try {
    keypair = await ephemeralKeyPair();
    keychain = [keypair.publicKey];

    const pubkey = await window.crypto.subtle.exportKey("spki", keychain[0]);
    el.innerHTML = arrayToBase64(arrayBufferToArray(pubkey));
  } catch(e) {
    console.log("failed to create ephemeral keypair");
    el.innerHTML = "n/a";
  }
}

// initialize keypair to null
var keypair;

// initialize empty keychain
var keychain = [];

function connect() {
  socket = new WebSocket('wss://api.dominic-ricottone.com/chat');

  // On close, reconnect after 1s (=1000ms)
  socket.onclose = () => {
    setTimeout(connect, 1000);
  };

  socket.onmessage = async (m) => {
    const el = document.createElement('li');
    if (passkey == null) {
      const msg = await justVerify(m.data);
      el.innerHTML = escapeHTML(msg);
    } else {
      const decrypted = await verifyAndDecrypt(m.data);
      el.innerHTML = escapeHTML(decrypted);
    }
    document.getElementById('chat-room').appendChild(el);
  };
};

// try to initialize socket to a connection
var socket;
connect();

document.addEventListener("DOMContentLoaded", () => {
  //key interface
  const pubkeyShown = document.getElementById('pubkey-shown');
  initializeKeyChain(pubkeyShown);

  // chat interface
  const chatInput = document.getElementById('chat-input');
  const chatButton = document.getElementById('chat-button');

  chatButton.onclick = async () => {
    const msg = chatInput.value;
    if (passkey == null) {
      const signed = await justSign(msg);
      socket.send(signed);
    } else {
      const encrypted = await encryptAndSign(msg);
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

