import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
// قمنا هنا باستدعاء جميع أدوات قاعدة البيانات (Firestore) اللازمة للعمل
import { 
    getFirestore, 
    collection, 
    getDocs, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// إعدادات مشروعك كما هي لم تتغير
const firebaseConfig = {
    apiKey: "AIzaSyD7cxvC6x1i0t4T45EmPeDuEec2tWWr44E",
    authDomain: "assmk-1fd46.firebaseapp.com",
    projectId: "assmk-1fd46",
    storageBucket: "assmk-1fd46.firebasestorage.app",
    messagingSenderId: "982227752477",
    appId: "1:982227752477:web:e7dc8502871df5f19098f4"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// الاتصال بقاعدة البيانات
const db = getFirestore(app);

// هذه الخطوة مهمة جداً: نجعل أدوات قاعدة البيانات متاحة لملف script.js لكي يستخدمها
window.db = db;
window.firestore = {
    collection,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp
};

// إطلاق إشارة لباقي ملفات المشروع أن الاتصال بقاعدة البيانات جاهز ويمكنهم البدء
const event = new Event('firebaseReady');
window.dispatchEvent(event);
