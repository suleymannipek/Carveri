// --- DB.JS: INDEXEDDB VE BELGE / FİŞ YÖNETİMİ ---

const IDB_NAME = "OtoTakipProMax_DB";
const IDB_VERSION = 1;
let dbInstance = null;

function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

async function saveDocToDB(id, dataUri) {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction("documents", "readwrite");
    tx.objectStore("documents").put({ id, dataUri });
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

async function getDocFromDB(id) {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = dbInstance.transaction("documents", "readonly");
    const req = tx.objectStore("documents").get(id);
    req.onsuccess = () => resolve(req.result ? req.result.dataUri : null);
    req.onerror = () => resolve(null);
  });
}

async function deleteDocFromDB(id) {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = dbInstance.transaction("documents", "readwrite");
    tx.objectStore("documents").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function clearAllDocsFromDB() {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = dbInstance.transaction("documents", "readwrite");
    tx.objectStore("documents").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function getAllDocsFromDB() {
  if (!dbInstance) await initIndexedDB();
  return new Promise((resolve) => {
    const tx = dbInstance.transaction("documents", "readonly");
    const req = tx.objectStore("documents").getAll();
    req.onsuccess = () => {
      let map = {};
      (req.result || []).forEach(item => { map[item.id] = item.dataUri; });
      resolve(map);
    };
    req.onerror = () => resolve({});
  });
}

function handleDocUpload(event, idTargetId, thumbTargetId, previewBoxId) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUri = e.target.result;
    const docId = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    await saveDocToDB(docId, dataUri);
    document.getElementById(idTargetId).value = docId;
    const thumb = document.getElementById(thumbTargetId);
    if (thumb && !dataUri.startsWith("data:application/pdf")) {
      thumb.src = dataUri;
      thumb.classList.remove("hidden");
    }
    const prevBox = document.getElementById(previewBoxId);
    if (prevBox) {
      prevBox.classList.remove("hidden");
      prevBox.style.display = "flex";
    }
  };
  reader.readAsDataURL(file);
}

function removeLoadedDoc(idTargetId, thumbTargetId, previewBoxId) {
  const docId = document.getElementById(idTargetId).value;
  if (docId) deleteDocFromDB(docId);
  document.getElementById(idTargetId).value = "";
  const thumb = document.getElementById(thumbTargetId);
  if (thumb) {
    thumb.src = "";
    thumb.classList.add("hidden");
  }
  const prevBox = document.getElementById(previewBoxId);
  if (prevBox) {
    prevBox.classList.add("hidden");
    prevBox.style.display = "none";
  }
}

async function viewDocumentById(docId) {
  const uri = await getDocFromDB(docId);
  if (!uri) return alert("Belge bulunamadı.");
  const content = document.getElementById("docViewerContent");
  if (uri.startsWith("data:application/pdf")) {
    content.innerHTML = `<embed src="${uri}" type="application/pdf" class="w-full h-96" />`;
  } else {
    content.innerHTML = `<img src="${uri}" class="max-h-[70vh] rounded-lg object-contain shadow" />`;
  }
  openModalDirectly("docViewerModal");
}
