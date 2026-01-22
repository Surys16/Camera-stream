// ======================
// 🔥 Firebase (ES Module)
// ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ⛔ Firebase config kamu
const firebaseConfig = {
  apiKey: "AIzaSyCMD_qYKFZQZveZQL1NX7oj3oFuTsRxaYI",
  authDomain: "camera-stream-15427.firebaseapp.com",
  databaseURL: "https://camera-stream-15427-default-rtdb.firebaseio.com",
  projectId: "camera-stream-15427",
  storageBucket: "camera-stream-15427.firebasestorage.app",
  messagingSenderId: "437543558160",
  appId: "1:437543558160:web:32a8d80fdcd95b0568fe95"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ======================
// 🖥 WebRTC Setup
// ======================
const room = "room1";
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

// ---------- ICE Candidate ----------
pc.onicecandidate = e => {
  if (e.candidate) push(ref(db, room + "/candidates"), e.candidate.toJSON());
};

// ---------- Remote Video ----------
pc.ontrack = e => {
  const remote = document.getElementById("remoteVideo");
  if (remote) remote.srcObject = e.streams[0];
};

// ======================
// 📱 HP 1 — SENDER
// ======================
const startBtn = document.getElementById("start");
if (startBtn) {
  startBtn.onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      document.getElementById("localVideo").srcObject = stream; // preview hidden
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      set(ref(db, room + "/offer"), { type: offer.type, sdp: offer.sdp });

      onValue(ref(db, room + "/answer"), snap => {
        if (snap.exists()) pc.setRemoteDescription(snap.val()).catch(err => console.error(err));
      });

      console.log("Camera streaming started!");
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };
}

// ======================
// 📺 HP 2 — VIEWER
// ======================
if (document.getElementById("remoteVideo")) {
  onValue(ref(db, room + "/offer"), async snap => {
    if (!snap.exists()) return;
    try {
      const offer = snap.val();
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      set(ref(db, room + "/answer"), { type: answer.type, sdp: answer.sdp });
      console.log("Viewer connected!");
    } catch (err) {
      console.error("Error setting remote description:", err);
    }
  });
}

// ======================
// 🔄 Listen ICE Candidates
// ======================
onValue(ref(db, room + "/candidates"), snap => {
  snap.forEach(c => {
    const candidate = c.val();
    if (candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  });
});
