import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
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

// إعدادات قاعدة البيانات الجديدة للعميل الثاني
const firebaseConfig = {
    apiKey: "AIzaSyDH3oeKNrAcYA5VuYFA7YzdFELIu90tLh4",
    authDomain: "lklk-904dd.firebaseapp.com",
    projectId: "lklk-904dd",
    storageBucket: "lklk-904dd.firebasestorage.app",
    messagingSenderId: "116538688244",
    appId: "1:116538688244:web:481e3efc8b9fa685ac94a1"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// الاتصال بقاعدة البيانات
const db = getFirestore(app);

// جعل أدوات قاعدة البيانات متاحة لملفات المتجر والآدمن
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

// إطلاق إشارة لباقي ملفات المشروع أن الاتصال بقاعدة البيانات جاهز
const event = new Event('firebaseReady');
window.dispatchEvent(event);
