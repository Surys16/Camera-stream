// ======================
// 🔥 Firebase (ES Module)
// ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase config kamu
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

// ---------- ICE Candidate Queue ----------
let remoteDescSet = false;
let iceQueue = [];

pc.onicecandidate = e => {
  if (e.candidate) {
    push(ref(db, room + "/candidates"), e.candidate.toJSON());
    console.log("New ICE candidate pushed:", e.candidate);
  }
};

// ---------- Remote Video ----------
pc.ontrack = e => {
  const remote = document.getElementById("remoteVideo");
  if (remote) {
    remote.srcObject = e.streams[0];
    console.log("Remote video stream received!");
  }
};

// ======================
// 📱 HP 1 — SENDER
// ======================
const startBtn = document.getElementById("start");
if (startBtn) {
  startBtn.onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      document.getElementById("localVideo").srcObject = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      console.log("Local camera started");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      set(ref(db, room + "/offer"), { type: offer.type, sdp: offer.sdp });
      console.log("Offer sent to Firebase:", offer);

      // Listener answer dari HP 2
      onValue(ref(db, room + "/answer"), snap => {
        if (snap.exists()) {
          pc.setRemoteDescription(snap.val())
            .then(() => {
              console.log("Answer received and set!");
              remoteDescSet = true; // remoteDescription sudah ada → bisa add candidate
              // jalankan candidate queue
              iceQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
              iceQueue = [];
            })
            .catch(err => console.error("Error setting remote description:", err));
        }
      });
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };
}

// ======================
// 📺 HP 2 — VIEWER (Force Trigger Answer)
// ======================
const remoteVideo = document.getElementById("remoteVideo");
if (remoteVideo) {
  let answered = false;
  const offerRef = ref(db, room + "/offer");

  const checkOffer = async () => {
    try {
      const snap = await get(offerRef);
      if (snap.exists() && !answered) {
        const offer = snap.val();
        console.log("Offer received from Firebase:", offer);

        await pc.setRemoteDescription(offer);
        console.log("Offer set as remote description");

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("Answer created and local description set:", answer);

        set(ref(db, room + "/answer"), { type: answer.type, sdp: answer.sdp });
        console.log("Answer sent to Firebase");
        answered = true;

        remoteDescSet = true; // remoteDescription siap → bisa add candidate
        iceQueue.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
        iceQueue = [];
      }
    } catch (err) {
      console.error("Error creating or sending answer:", err);
    } finally {
      setTimeout(checkOffer, 1000); // retry tiap 1 detik
    }
  };

  checkOffer();
}

// ======================
// 🔄 Listen ICE Candidates
// ======================
onValue(ref(db, room + "/candidates"), snap => {
  snap.forEach(c => {
    const candidate = c.val();
    if (!candidate) return;

    if (remoteDescSet) {
      pc.addIceCandidate(new RTCIceCandidate(candidate))
        .then(() => console.log("ICE candidate added:", candidate))
        .catch(err => console.warn("ICE candidate add failed:", err));
    } else {
      iceQueue.push(candidate); // simpan sementara sampai remoteDescription siap
    }
  });
});
