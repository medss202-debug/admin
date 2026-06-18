document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSidebar();
  loadOrders();
  loadAcceptedOrders();
  initProductsTab();
  initCategoriesTab();
  initBannersTab();
  initSettingsTab();

  const startFirebase = () => {
    listenForOrders();
    syncAllDataFromFirestore();
  };

  if (window.db && window.firestore) {
    startFirebase();
  } else {
    window.addEventListener("firebaseReady", startFirebase);
  }
});

// ------------------------------------
// دالة الرفع الاحترافية إلى Bunny.net
// ------------------------------------
async function uploadToBunnyNET(file) {
  const storageZoneName = "basm";
  const accessKey = "8b38dd52-babf-4828-b0d216172735-6a18-4706";
  const pullZoneUrl = "https://basm.b-cdn.net";

  // توليد اسم فريد للصورة باستخدام الوقت الحالي لمنع تداخل الأسماء
  const uniqueFileName = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.]/g, "");
  const uploadUrl = `https://storage.bunnycdn.com/${storageZoneName}/${uniqueFileName}`;

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": accessKey,
        "Content-Type": "application/octet-stream",
      },
      body: file,
    });

    if (response.ok) {
      // إرجاع الرابط المباشر الجاهز للاستخدام في المتجر
      return `${pullZoneUrl}/${uniqueFileName}`;
    } else {
      console.error("خطأ في الرفع إلى Bunny.net:", response.statusText);
      return null;
    }
  } catch (error) {
    console.error("فشل الاتصال بخادم Bunny.net:", error);
    return null;
  }
}

// ------------------------------------
// عمليات Firebase اللحظية والمزامنة
// ------------------------------------

async function updateAdminCacheVersion() {
  if (window.db && window.firestore) {
    try {
      await window.firestore.setDoc(
        window.firestore.doc(window.db, "meta", "version"),
        {
          updatedAt: window.firestore.serverTimestamp(),
        },
      );
    } catch (e) {
      console.error("Error updating meta version:", e);
    }
  }
}

async function syncItemToFirestore(collectionName, itemData, action) {
  if (window.db && window.firestore) {
    try {
      if (action === "delete") {
        if (itemData.firestoreId) {
          await window.firestore.deleteDoc(
            window.firestore.doc(
              window.db,
              collectionName,
              itemData.firestoreId,
            ),
          );
        } else {
          const querySnap = await window.firestore.getDocs(
            window.firestore.collection(window.db, collectionName),
          );
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) {
              await window.firestore.deleteDoc(docSnap.ref);
            }
          });
        }
      } else if (action === "add") {
        await window.firestore.addDoc(
          window.firestore.collection(window.db, collectionName),
          itemData,
        );
      } else if (action === "update") {
        if (itemData.firestoreId) {
          await window.firestore.updateDoc(
            window.firestore.doc(
              window.db,
              collectionName,
              itemData.firestoreId,
            ),
            itemData,
          );
        } else {
          const querySnap = await window.firestore.getDocs(
            window.firestore.collection(window.db, collectionName),
          );
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) {
              await window.firestore.updateDoc(docSnap.ref, itemData);
            }
          });
        }
      }
      await updateAdminCacheVersion();
    } catch (e) {
      console.error(`Firebase error on ${collectionName}:`, e);
    }
  }
}

function listenForOrders() {
  if (window.db && window.firestore) {
    window.firestore.onSnapshot(
      window.firestore.collection(window.db, "orders"),
      (snapshot) => {
        let firestoreOrders = [];
        snapshot.forEach((doc) => {
          firestoreOrders.push({ firestoreId: doc.id, ...doc.data() });
        });
        const pendingOrders = firestoreOrders.filter(
          (o) => o.status === "pending",
        );
        const acceptedOrders = firestoreOrders.filter(
          (o) => o.status === "accepted",
        );
        localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));
        localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
        loadOrders();
        if (typeof loadAcceptedOrders === "function") loadAcceptedOrders();
      },
    );
  }
}

async function syncAllDataFromFirestore() {
  if (window.db && window.firestore) {
    try {
      const productsSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "products"));
      let fetchedProducts = [];
      productsSnap.forEach((doc) => {
        fetchedProducts.push({ firestoreId: doc.id, ...doc.data() });
      });
      localStorage.setItem("products", JSON.stringify(fetchedProducts));

      const categoriesSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "categories"));
      let fetchedCategories = [];
      categoriesSnap.forEach((doc) => {
        fetchedCategories.push({ firestoreId: doc.id, ...doc.data() });
      });
      localStorage.setItem("categories", JSON.stringify(fetchedCategories));

      if (window.firestore.getDoc) {
        const bannersDoc = await window.firestore.getDoc(window.firestore.doc(window.db, "meta", "banners"));
        if (bannersDoc.exists && bannersDoc.exists()) {
          localStorage.setItem("banners", JSON.stringify(bannersDoc.data().data || []));
        }
      }

      populateCategorySelects();
      loadAdminProducts();
      loadAdminCategories();
      loadAdminBanners();
    } catch (e) {
      console.error("Error syncing data from Firestore:", e);
    }
  }
}

// ------------------------------------
// وظائف واجهة المستخدم للآدمن
// ------------------------------------

function initTabs() {
  const tabs = document.querySelectorAll(".sidebar-menu li");
  const contents = document.querySelectorAll(".tab-content");
  const headerTitle = document.querySelector(".top-header h3");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const targetId = tab.dataset.tab + "-tab";
      document.getElementById(targetId).classList.add("active");

      if (headerTitle) {
        headerTitle.innerText = tab.innerText;
      }

      const sidebar = document.getElementById("sidebar");
      if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.remove("open");
      }
    });
  });
}

function initSidebar() {
  const toggleBtn = document.getElementById("toggle-sidebar");
  const sidebar = document.getElementById("sidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

function loadOrders() {
  const container = document.getElementById("orders-container");
  if (!container) return;

  let pendingOrders = [];
  try {
    pendingOrders = JSON.parse(localStorage.getItem("pendingOrders") || "[]");
  } catch (e) {}

  if (pendingOrders.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1; font-size: 1.1rem;">لا توجد طلبات معلقة حالياً...</div>';
    return;
  }

  pendingOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = "";

  const cName = localStorage.getItem("checkoutName") || "غير مدخل";
  const cAddress = localStorage.getItem("checkoutAddress") || "غير مدخل";
  const cPhone = localStorage.getItem("checkoutPhone") || "غير مدخل";
  const shippingFee = 3000;

  const colors = ["#e0f2fe", "#dcfce7", "#fef3c7", "#fee2e2", "#f3e8ff", "#ffedd5"];

  pendingOrders.forEach((order, index) => {
    const orderDateObj = new Date(order.date);
    const dateOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const orderDate = orderDateObj.toLocaleDateString("ar-IQ", dateOptions);

    let subtotal = 0;
    let itemsHtml = "";
    order.items.forEach((item) => {
      const priceNum = parseInt(item.price.replace(/[^\d]/g, ""));
      subtotal += priceNum * item.quantity;
      itemsHtml += `
            <div class="order-item">
                <span>${item.name} (${item.quantity}x)</span>
                <span>${(priceNum * item.quantity).toLocaleString("en-US")} د.ع</span>
            </div>`;
    });
    const total = subtotal + shippingFee;

    const card = document.createElement("div");
    card.className = "order-card";
    card.style.backgroundColor = colors[index % colors.length];
    card.innerHTML = `
            <div class="order-header">
                <span class="order-id">طلب #${order.id.toString().slice(-5)}</span>
                <span class="order-date">${orderDate}</span>
            </div>
            <div class="order-customer">
                <div><strong>الاسم:</strong> ${order.customerName || cName}</div>
                <div><strong>العنوان:</strong> ${order.customerAddress || cAddress}</div>
                <div><strong>الهاتف:</strong> <span dir="ltr">${order.customerPhone || cPhone}</span></div>
            </div>
            <div class="order-items">
                ${itemsHtml}
            </div>
            <div class="order-total">
                المجموع الكلي: ${total.toLocaleString("en-US")} د.ع
            </div>
            <div class="order-actions">
                <button class="btn btn-accept process-order-btn" data-id="${order.id}" data-action="accept">قبول</button>
                <button class="btn btn-reject process-order-btn" data-id="${order.id}" data-action="reject">رفض</button>
            </div>
        `;
    container.appendChild(card);
  });

  const processBtns = container.querySelectorAll(".process-order-btn");
  processBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      const action = e.currentTarget.getAttribute("data-action");
      if (typeof window.processOrder === "function") {
        window.processOrder(id, action);
      }
    });
  });
}

window.processOrder = async function (id, action) {
  let pendingOrders = JSON.parse(localStorage.getItem("pendingOrders") || "[]");
  const orderIndex = pendingOrders.findIndex((o) => o.id === id);

  if (orderIndex !== -1) {
    const order = pendingOrders[orderIndex];

    if (window.db && window.firestore && order.firestoreId) {
      try {
        if (action === "accept") {
          await window.firestore.updateDoc(
            window.firestore.doc(window.db, "orders", order.firestoreId),
            { status: "accepted" },
          );
        } else {
          await window.firestore.deleteDoc(
            window.firestore.doc(window.db, "orders", order.firestoreId),
          );
        }
      } catch (e) {
        console.error("Firestore update error: ", e);
      }
    } else {
      pendingOrders.splice(orderIndex, 1);
      localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));

      if (action === "accept") {
        let acceptedOrders = JSON.parse(
          localStorage.getItem("acceptedOrders") || "[]",
        );
        acceptedOrders.push(order);
        localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
      }
    }
  }

  loadOrders();
  if (typeof loadAcceptedOrders === "function") {
    loadAcceptedOrders();
  }
};

function loadAcceptedOrders() {
  const container = document.getElementById("accepted-orders-container");
  if (!container) return;

  let acceptedOrders = [];
  try {
    acceptedOrders = JSON.parse(localStorage.getItem("acceptedOrders") || "[]");
  } catch (e) {}

  if (acceptedOrders.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1; font-size: 1.1rem;">لا توجد طلبات مقبولة حالياً...</div>';
    return;
  }

  acceptedOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = "";

  const cName = localStorage.getItem("checkoutName") || "غير مدخل";
  const cAddress = localStorage.getItem("checkoutAddress") || "غير مدخل";
  const cPhone = localStorage.getItem("checkoutPhone") || "غير مدخل";
  const shippingFee = parseInt(localStorage.getItem("deliveryCost")) || 3000;

  acceptedOrders.forEach((order) => {
    const orderDateObj = new Date(order.date);
    const dateOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const orderDate = orderDateObj.toLocaleDateString("ar-IQ", dateOptions);

    let subtotal = 0;
    let itemsHtml = "";
    order.items.forEach((item) => {
      const priceNum = parseInt(item.price.replace(/[^\d]/g, ""));
      subtotal += priceNum * item.quantity;
      itemsHtml += `
            <div class="order-item">
                <span>${item.name} (${item.quantity}x)</span>
                <span>${(priceNum * item.quantity).toLocaleString("en-US")} د.ع</span>
            </div>`;
    });
    const total = subtotal + shippingFee;

    const card = document.createElement("div");
    card.className = "order-card";
    card.style.border = "1px solid #10b981";
    card.innerHTML = `
            <div class="order-header">
                <span class="order-id">طلب #${order.id.toString().slice(-5)}</span>
                <span class="order-date">${orderDate}</span>
            </div>
            <div class="order-customer">
                <div><strong>الاسم:</strong> ${order.customerName || cName}</div>
                <div><strong>العنوان:</strong> ${order.customerAddress || cAddress}</div>
                <div><strong>الهاتف:</strong> <span dir="ltr">${order.customerPhone || cPhone}</span></div>
            </div>
            <div class="order-items">
                ${itemsHtml}
            </div>
            <div class="order-total">
                المجموع الكلي: ${total.toLocaleString("en-US")} د.ع
            </div>
            <div class="order-actions">
                <button class="btn btn-reject delete-accepted-order-btn" data-id="${order.id}">حذف السجل</button>
            </div>
        `;
    container.appendChild(card);
  });

  const deleteBtns = container.querySelectorAll(".delete-accepted-order-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.deleteAcceptedOrder === "function") {
        window.deleteAcceptedOrder(id);
      }
    });
  });
}

window.deleteAcceptedOrder = async function (id) {
  let acceptedOrders = JSON.parse(
    localStorage.getItem("acceptedOrders") || "[]",
  );
  const orderIndex = acceptedOrders.findIndex((o) => o.id === id);
  if (orderIndex !== -1) {
    const order = acceptedOrders[orderIndex];
    if (window.db && window.firestore && order.firestoreId) {
      try {
        await window.firestore.deleteDoc(
          window.firestore.doc(window.db, "orders", order.firestoreId),
        );
      } catch (e) {
        console.error("Firestore delete error", e);
      }
    } else {
      acceptedOrders.splice(orderIndex, 1);
      localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
      loadAcceptedOrders();
    }
  }
};

// ------------------------------------
// قسم إدارة المنتجات
// ------------------------------------

function populateCategorySelects() {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  const newSelect = document.getElementById("new-product-category");
  const editSelect = document.getElementById("edit-product-category");

  let html = "";
  categories.forEach((cat) => {
    html += `<option value="${cat.id}">${cat.name}</option>`;
  });

  if (newSelect) newSelect.innerHTML = html;
  if (editSelect) editSelect.innerHTML = html;
}

function initProductsTab() {
  populateCategorySelects();
  loadAdminProducts();

  const addProductBtn = document.getElementById("add-product-btn");
  const formContainer = document.getElementById("add-product-form");
  const saveBtn = document.getElementById("save-product-btn");

  if (addProductBtn) {
    addProductBtn.addEventListener("click", () => {
      if (formContainer.style.display === "none") {
        formContainer.style.display = "block";
        addProductBtn.innerText = "إلغاء";
        addProductBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addProductBtn.innerText = "إضافة منتج جديد";
        addProductBtn.style.background = "#10b981";
      }
    });
  }

  if (saveBtn) {
    // تم تحويل هذه الدالة لتكون Async لكي تستخدم الرفع الجديد
    saveBtn.addEventListener("click", async () => {
      const name = document.getElementById("new-product-name").value;
      const price = document.getElementById("new-product-price").value;
      const category = document.getElementById("new-product-category").value;
      const imageInput = document.getElementById("new-product-image");
      const imageFile = imageInput.files[0];

      if (!name || !price || !category || !imageFile) {
        alert("يرجى ملء جميع الحقول واختيار صورة!");
        return;
      }

      saveBtn.innerText = "جاري رفع الصورة للمخدم...";
      saveBtn.disabled = true;

      // استخدام الدالة الجديدة للرفع بدلاً من الضغط المحلي
      const uploadedImageUrl = await uploadToBunnyNET(imageFile);

      if (!uploadedImageUrl) {
        alert("فشل رفع الصورة إلى المخدم. يرجى التأكد من الاتصال والمحاولة مجدداً.");
        saveBtn.innerText = "حفظ المنتج";
        saveBtn.disabled = false;
        return;
      }

      try {
        let products = JSON.parse(localStorage.getItem("products")) || [];

        const newId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;
        const formattedPrice = parseInt(price).toLocaleString("en-US") + " د.ع";

        const newProduct = {
          id: newId,
          name: name,
          price: formattedPrice,
          image: uploadedImageUrl,
          rating: 5,
          category: category,
        };

        products.push(newProduct);
        localStorage.setItem("products", JSON.stringify(products));
        syncItemToFirestore("products", newProduct, "add");

        document.getElementById("new-product-name").value = "";
        document.getElementById("new-product-price").value = "";
        document.getElementById("new-product-image").value = "";
        formContainer.style.display = "none";
        addProductBtn.innerText = "إضافة منتج جديد";
        addProductBtn.style.background = "#10b981";

        alert("تمت إضافة المنتج بنجاح!");
        loadAdminProducts();
      } catch (err) {
        console.error(err);
        alert("حدث خطأ غير متوقع!");
      } finally {
        saveBtn.innerText = "حفظ المنتج";
        saveBtn.disabled = false;
      }
    });
  }
}

function loadAdminProducts() {
  const container = document.getElementById("admin-products-container");
  if (!container) return;

  if (!window.editEventsAttached) {
    const cancelBtn = document.getElementById("cancel-edit-btn");
    const updateBtn = document.getElementById("update-product-btn");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        document.getElementById("edit-product-form").style.display = "none";
      });
    }

    if (updateBtn) {
      updateBtn.addEventListener("click", async () => {
        const id = parseInt(document.getElementById("edit-product-id").value);
        const name = document.getElementById("edit-product-name").value;
        const price = document.getElementById("edit-product-price").value;
        const category = document.getElementById("edit-product-category").value;
        const imageInput = document.getElementById("edit-product-image");
        const imageFile = imageInput.files[0];

        if (!name || !price || !category) {
          alert("يرجى ملء كافة الحقول الأساسية!");
          return;
        }

        let products = JSON.parse(localStorage.getItem("products")) || [];
        const formattedPrice = parseInt(price).toLocaleString("en-US") + " د.ع";
        const index = products.findIndex((p) => p.id === id);

        if (index !== -1) {
          products[index].name = name;
          products[index].price = formattedPrice;
          products[index].category = category;

          if (imageFile) {
            updateBtn.innerText = "جاري رفع الصورة وتحديث المنتج...";
            updateBtn.disabled = true;
            
            const uploadedImageUrl = await uploadToBunnyNET(imageFile);
            if(uploadedImageUrl) {
                products[index].image = uploadedImageUrl;
            } else {
                alert("فشل رفع الصورة الجديدة، سيتم الاحتفاظ بالصورة القديمة.");
            }
          }

          try {
            localStorage.setItem("products", JSON.stringify(products));
            syncItemToFirestore("products", products[index], "update");
            document.getElementById("edit-product-form").style.display = "none";
            loadAdminProducts();
            alert("تم التعديل بنجاح!");
          } catch (err) {
            console.error(err);
            alert("خطأ أثناء تحديث المنتج.");
          } finally {
            updateBtn.innerText = "حفظ التعديلات";
            updateBtn.disabled = false;
          }
        }
      });
    }
    window.editEventsAttached = true;
  }

  let products = JSON.parse(localStorage.getItem("products")) || [];

  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1;">لا توجد منتجات.</div>';
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
            <div style="display:flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <img src="${product.image}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                <div>
                    <h4 style="color: var(--primary); margin-bottom: 0.25rem;">${product.name}</h4>
                    <div style="color: var(--text-main); font-weight: 600;">${product.price}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top:0.25rem;">الفئة: ${getCategoryName(product.category)}</div>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-product-btn" data-id="${product.id}" style="background: var(--primary);">تعديل</button>
                <button class="btn btn-reject delete-product-btn" data-id="${product.id}">حذف</button>
            </div>
        `;
    container.appendChild(card);
  });

  const editBtns = container.querySelectorAll(".edit-product-btn");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.editProduct === "function") window.editProduct(id);
    });
  });

  const deleteBtns = container.querySelectorAll(".delete-product-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.deleteProduct === "function") window.deleteProduct(id);
    });
  });
}

function getCategoryName(id) {
  if (id === "all") return "الكل";
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  const cat = categories.find((c) => c.id === id);
  return cat ? cat.name : id;
}

window.deleteProduct = function (id) {
  let products = JSON.parse(localStorage.getItem("products")) || [];

  const productToDelete = products.find((p) => p.id === id);
  products = products.filter((p) => p.id !== id);
  localStorage.setItem("products", JSON.stringify(products));
  if (productToDelete) {
    syncItemToFirestore("products", productToDelete, "delete");
  }

  loadAdminProducts();
};

window.editProduct = function (id) {
  let products = JSON.parse(localStorage.getItem("products")) || [];

  const product = products.find((p) => p.id === id);
  if (!product) return;

  document.getElementById("edit-product-id").value = product.id;
  document.getElementById("edit-product-name").value = product.name;
  const priceNum = product.price.replace(/[^\d]/g, "");
  document.getElementById("edit-product-price").value = priceNum;
  document.getElementById("edit-product-category").value = product.category;
  document.getElementById("edit-product-image").value = "";

  document.getElementById("edit-product-form").style.display = "block";
  document
    .getElementById("edit-product-form")
    .scrollIntoView({ behavior: "smooth", block: "center" });
};

// ------------------------------------
// قسم إدارة البنرات
// ------------------------------------

function initBannersTab() {
  loadAdminBanners();

  const addBannerBtn = document.getElementById("add-banner-btn");
  const formContainer = document.getElementById("add-banner-form");
  const saveBtn = document.getElementById("save-banner-btn");

  if (addBannerBtn) {
    addBannerBtn.addEventListener("click", () => {
      if (formContainer.style.display === "none") {
        formContainer.style.display = "block";
        addBannerBtn.innerText = "إلغاء";
        addBannerBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addBannerBtn.innerText = "إضافة بنر جديد";
        addBannerBtn.style.background = "#10b981";
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const imageInput = document.getElementById("new-banner-image");
      const imageFile = imageInput.files[0];

      if (!imageFile) {
        alert("يرجى اختيار صورة للبنر!");
        return;
      }

      saveBtn.innerText = "جاري رفع البنر...";
      saveBtn.disabled = true;

      const uploadedImageUrl = await uploadToBunnyNET(imageFile);

      if (!uploadedImageUrl) {
        alert("فشل رفع البنر إلى المخدم.");
        saveBtn.innerText = "حفظ البنر";
        saveBtn.disabled = false;
        return;
      }

      try {
        let banners = JSON.parse(localStorage.getItem("banners")) || [];
        banners.push(uploadedImageUrl);
        localStorage.setItem("banners", JSON.stringify(banners));

        if (window.db && window.firestore) {
          window.firestore
            .setDoc(window.firestore.doc(window.db, "meta", "banners"), {
              data: banners,
            })
            .then(() => updateAdminCacheVersion())
            .catch((e) => console.error("Error saving banners:", e));
        }

        document.getElementById("new-banner-image").value = "";
        formContainer.style.display = "none";
        addBannerBtn.innerText = "إضافة بنر جديد";
        addBannerBtn.style.background = "#10b981";

        alert("تمت إضافة البنر بنجاح!");
        loadAdminBanners();
      } catch (error) {
        console.error(error);
        alert("خطأ أثناء الحفظ!");
      } finally {
        saveBtn.innerText = "حفظ البنر";
        saveBtn.disabled = false;
      }
    });
  }
}

function loadAdminBanners() {
  const container = document.getElementById("admin-banners-container");
  if (!container) return;

  let banners = JSON.parse(localStorage.getItem("banners")) || [];
  container.innerHTML = "";

  if (banners.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted);">لا توجد بنرات حالياً.</div>';
    return;
  }

  banners.forEach((bannerUrl, index) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.style.display = "flex";
    card.style.flexDirection = "row";
    card.style.alignItems = "center";
    card.style.justifyContent = "space-between";

    card.innerHTML = `
            <img src="${bannerUrl}" style="height: 100px; width: auto; max-width: 70%; object-fit: cover; border-radius: 8px;">
            <div class="order-actions" style="margin: 0; min-width: 100px;">
                <button class="btn btn-reject delete-banner-btn" data-index="${index}">حذف</button>
            </div>
        `;
    container.appendChild(card);
  });

  const deleteBtns = container.querySelectorAll(".delete-banner-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.currentTarget.getAttribute("data-index"));
      if (typeof window.deleteBanner === "function") {
        window.deleteBanner(index);
      }
    });
  });
}

window.deleteBanner = function (index) {
  try {
    let banners = JSON.parse(localStorage.getItem("banners")) || [];

    if (index >= 0 && index < banners.length) {
      banners.splice(index, 1);
      localStorage.setItem("banners", JSON.stringify(banners));
      if (window.db && window.firestore) {
        window.firestore
          .setDoc(window.firestore.doc(window.db, "meta", "banners"), {
            data: banners,
          })
          .then(() => updateAdminCacheVersion())
          .catch((e) => console.error("Error saving banners:", e));
      }
    }
    loadAdminBanners();
  } catch (error) {
    console.error("خطأ أثناء الحذف: ", error);
  }
};

// ------------------------------------
// قسم الفئات
// ------------------------------------

function initCategoriesTab() {
  const addCategoryBtn = document.getElementById("add-category-btn");
  const addCategoryForm = document.getElementById("add-category-form");
  const saveCategoryBtn = document.getElementById("save-category-btn");

  if (addCategoryBtn && addCategoryForm) {
    addCategoryBtn.addEventListener("click", () => {
      const isVisible = addCategoryForm.style.display === "block";
      addCategoryForm.style.display = isVisible ? "none" : "block";
      addCategoryBtn.innerText = isVisible ? "إضافة فئة جديدة" : "إلغاء الإضافة";
      if (!isVisible) {
        document.getElementById("edit-category-form").style.display = "none";
      }
    });
  }

  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener("click", async () => {
      const name = document.getElementById("new-category-name").value.trim();
      const imageFile = document.getElementById("new-category-image").files[0];

      if (!name) {
        alert("يرجى إدخال اسم الفئة.");
        return;
      }

      const id = "cat_" + Date.now();

      saveCategoryBtn.innerText = "جاري رفع الصورة...";
      saveCategoryBtn.disabled = true;

      let imgUrl = "https://cdn-icons-png.flaticon.com/512/149/149852.png"; // صورة افتراضية

      if (imageFile) {
        const uploaded = await uploadToBunnyNET(imageFile);
        if(uploaded) imgUrl = uploaded;
      }

      try {
        let categories = JSON.parse(localStorage.getItem("categories")) || [];
        const newCat = { id, name, image: imgUrl };
        categories.push(newCat);
        
        localStorage.setItem("categories", JSON.stringify(categories));
        syncItemToFirestore("categories", newCat, "add");

        document.getElementById("new-category-name").value = "";
        document.getElementById("new-category-image").value = "";
        addCategoryForm.style.display = "none";
        addCategoryBtn.innerText = "إضافة فئة جديدة";

        loadAdminCategories();
      } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء حفظ الفئة.");
      } finally {
        saveCategoryBtn.innerText = "حفظ الفئة";
        saveCategoryBtn.disabled = false;
      }
    });
  }

  const cancelEditBtn = document.getElementById("cancel-category-edit-btn");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      document.getElementById("edit-category-form").style.display = "none";
    });
  }

  const updateBtn = document.getElementById("update-category-btn");
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      const originalId = document.getElementById("edit-category-original-id").value;
      const name = document.getElementById("edit-category-name").value.trim();
      const imageFile = document.getElementById("edit-category-image").files[0];

      if (!name) {
        alert("يرجى إدخال اسم الفئة.");
        return;
      }

      let categories = JSON.parse(localStorage.getItem("categories")) || [];
      const catIndex = categories.findIndex((c) => c.id === originalId);
      if (catIndex === -1) return;

      updateBtn.innerText = "جاري التحديث...";
      updateBtn.disabled = true;

      categories[catIndex].name = name;

      if (imageFile) {
        const uploaded = await uploadToBunnyNET(imageFile);
        if(uploaded) categories[catIndex].image = uploaded;
      }

      try {
        localStorage.setItem("categories", JSON.stringify(categories));
        syncItemToFirestore("categories", categories[catIndex], "update");
        document.getElementById("edit-category-form").style.display = "none";
        loadAdminCategories();
      } catch (e) {
        alert("حدث خطأ أثناء التحديث.");
      } finally {
        updateBtn.innerText = "حفظ التعديلات";
        updateBtn.disabled = false;
      }
    });
  }

  loadAdminCategories();
}

function loadAdminCategories() {
  if (typeof populateCategorySelects === "function") populateCategorySelects();

  const container = document.getElementById("admin-categories-container");
  if (!container) return;

  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  container.innerHTML = "";

  if (categories.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">لا توجد فئات حالياً.</div>';
    return;
  }

  categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.style.display = "flex";
    card.style.flexDirection = "column";

    card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <img src="${cat.image}" style="width: 50px; height: 50px; object-fit: contain; background: #f8f9fa; border-radius: 8px; padding: 5px;">
                <div>
                    <h3 style="margin-bottom: 0.25rem;">${cat.name}</h3>
                    <span style="color: var(--text-muted); font-size: 0.9rem;">معرف: ${cat.id}</span>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-category-btn" data-id="${cat.id}" style="background: var(--primary);">تعديل</button>
                <button class="btn btn-reject delete-category-btn" data-id="${cat.id}">حذف</button>
            </div>
        `;
    container.appendChild(card);
  });

  const editBtns = container.querySelectorAll(".edit-category-btn");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (typeof window.editCategory === "function") window.editCategory(id);
    });
  });

  const deleteBtns = container.querySelectorAll(".delete-category-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (typeof window.deleteCategory === "function") window.deleteCategory(id);
    });
  });
}

window.editCategory = function (id) {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;

  document.getElementById("edit-category-original-id").value = cat.id;
  document.getElementById("edit-category-name").value = cat.name;
  document.getElementById("edit-category-image").value = "";

  document.getElementById("add-category-form").style.display = "none";
  document.getElementById("add-category-btn").innerText = "إضافة فئة جديدة";

  const editForm = document.getElementById("edit-category-form");
  editForm.style.display = "block";
  editForm.scrollIntoView({ behavior: "smooth" });
};

window.deleteCategory = function (id) {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  const categoryToDelete = categories.find((c) => c.id === id);
  categories = categories.filter((c) => c.id !== id);

  try {
    localStorage.setItem("categories", JSON.stringify(categories));
    if (categoryToDelete) {
      syncItemToFirestore("categories", categoryToDelete, "delete");
    }
    loadAdminCategories();
  } catch (e) {
    alert("خطأ أثناء الحذف!");
  }
};

function initSettingsTab() {
  const deliveryCostInput = document.getElementById("delivery-cost-input");
  const saveDeliveryCostBtn = document.getElementById("save-delivery-cost-btn");

  if (deliveryCostInput) {
    deliveryCostInput.value = localStorage.getItem("deliveryCost") || "3000";
  }
  if (saveDeliveryCostBtn) {
    saveDeliveryCostBtn.addEventListener("click", () => {
      const cost = deliveryCostInput.value;
      localStorage.setItem("deliveryCost", cost);
      alert("تم حفظ كلفة التوصيل بنجاح");
    });
  }
}
