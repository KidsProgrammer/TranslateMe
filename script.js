// Kamus Dasar: Bahasa Indonesia (id) dan Inggris (en)
const autocompleteDictionary = {
  id: [
    "halo", "halo, apa kabar?", "halo semuanya",
    "selamat pagi", "selamat siang", "selamat sore", "selamat malam", "selamat datang", "selamat ulang tahun",
    "terima kasih", "terima kasih banyak", "terima kasih atas bantuannya",
    "sama-sama", "kembali",
    "apa kabar?", "bagaimana kabarmu?", "bagaimana harimu hari ini?",
    "tolong bantu saya", "bisa tolong bantu saya?", "bisa tolong ulangi?",
    "permisi", "maaf", "maaf mengganggu", "mohon maaf",
    "berapa harganya?", "dimana kamar mandinya?", "dimana lokasinya?",
    "saya ingin memesan makanan", "saya tidak mengerti", "bisa bicara lebih pelan?",
    "sampai jumpa lagi", "sampai bertemu nanti", "hati-hati di jalan",
    "semoga harimu menyenangkan", "semoga sukses", "semoga beruntung",
    "tidak masalah", "tentu saja", "baiklah", "iya", "tidak",
    "siapa nama anda?", "nama saya", "senang bertemu denganmu",
    "kamu sedang apa?", "ada apa?", "kenapa?", "kapan kita berangkat?"
  ],
  en: [
    "hello", "hello, how are you?", "hello everyone",
    "good morning", "good afternoon", "good evening", "good night", "welcome", "happy birthday",
    "thank you", "thank you very much", "thank you for your help",
    "you're welcome",
    "how are you?", "how is your day?", "how can i help you?",
    "please help me", "could you help me?", "could you repeat that?",
    "excuse me", "i am sorry", "sorry to bother you",
    "how much does it cost?", "where is the restroom?", "where is the location?",
    "i would like to order food", "i don't understand", "could you speak slower?",
    "see you later", "see you soon", "take care",
    "have a nice day", "good luck", "best of luck",
    "no problem", "of course", "all right", "yes", "no",
    "what is your name?", "my name is", "nice to meet you",
    "what are you doing?", "what's going on?", "why?", "when are we leaving?"
  ]
};

// Daftar Bahasa
const languages = {
  "id": "Indonesian",
  "en": "English",
  "es": "Spanish",
  "fr": "French",
  "de": "German",
  "ja": "Japanese",
  "ko": "Korean",
  "zh-CN": "Chinese",
  "ar": "Arabic",
  "ru": "Russian",
  "pt": "Portuguese",
  "it": "Italian",
  "nl": "Dutch",
  "tr": "Turkish",
  "vi": "Vietnamese",
  "ms": "Malay",
  "hi": "Hindi"
};

// DOM Elements
const sourceLangSelect = document.getElementById("sourceLang");
const targetLangSelect = document.getElementById("targetLang");
const sourceText = document.getElementById("sourceText");
const targetText = document.getElementById("targetText");
const translateBtn = document.getElementById("translateBtn");
const swapBtn = document.getElementById("swapBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const speakSourceBtn = document.getElementById("speakSourceBtn");
const speakTargetBtn = document.getElementById("speakTargetBtn");
const charCount = document.getElementById("charCount");
const statusIndicator = document.getElementById("statusIndicator");
const autocompleteList = document.getElementById("autocompleteList");

// State Autocomplete
let currentSuggestions = [];
let activeSuggestionIndex = -1;
let activeMatchInfo = null; // Menyimpan info kata dan posisi yang sedang dicocokkan
const activeRequests = {};

// Inisialisasi Pilihan Bahasa
function populateLanguages() {
  for (const [code, name] of Object.entries(languages)) {
    sourceLangSelect.add(new Option(name, code));
    targetLangSelect.add(new Option(name, code));
  }
  sourceLangSelect.value = "id";
  targetLangSelect.value = "en";
}

// Auto-generate kamus untuk bahasa lain
async function getOrGenerateDictionary(lang) {
  if (autocompleteDictionary[lang] && autocompleteDictionary[lang].length > 0) {
    return autocompleteDictionary[lang];
  }

  try {
    const cached = localStorage.getItem(`translator_dict_${lang}`);
    if (cached) {
      autocompleteDictionary[lang] = JSON.parse(cached);
      return autocompleteDictionary[lang];
    }
  } catch (e) {}

  if (activeRequests[lang]) {
    return await activeRequests[lang];
  }

  activeRequests[lang] = (async () => {
    try {
      const basePhrases = autocompleteDictionary.en;
      const batchText = basePhrases.join("\n");
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&q=${encodeURIComponent(batchText)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          const fullResult = data[0].map(item => item[0]).join("");
          const generatedList = fullResult
            .split("\n")
            .map(s => s.trim().toLowerCase())
            .filter(s => s.length > 0);

          if (generatedList.length > 0) {
            autocompleteDictionary[lang] = [...new Set(generatedList)];
            try {
              localStorage.setItem(`translator_dict_${lang}`, JSON.stringify(autocompleteDictionary[lang]));
            } catch (e) {}
            return autocompleteDictionary[lang];
          }
        }
      }
    } catch (err) {
      console.warn(`Gagal generate kamus ${lang}:`, err);
    } finally {
      delete activeRequests[lang];
    }

    return autocompleteDictionary.en;
  })();

  return await activeRequests[lang];
}

// ==============================================================
// MESIN PENDETEKSI KATA KURSOR (MEMPERBAIKI BUG KATA SELANJUTNYA)
// ==============================================================

function findActiveQuery(textBeforeCursor, dict) {
  if (!textBeforeCursor) return null;

  // 1. Cari batas tanda baca terdekat sebelum kursor: . ? ! , ; : atau baris baru
  const lastDelim = Math.max(
    textBeforeCursor.lastIndexOf('.'),
    textBeforeCursor.lastIndexOf('?'),
    textBeforeCursor.lastIndexOf('!'),
    textBeforeCursor.lastIndexOf(','),
    textBeforeCursor.lastIndexOf(';'),
    textBeforeCursor.lastIndexOf(':'),
    textBeforeCursor.lastIndexOf('\n')
  );

  const segment = textBeforeCursor.slice(lastDelim + 1);
  const leadingSpaces = segment.match(/^\s*/)[0].length;
  const cleanSegment = segment.trimStart();

  if (!cleanSegment) return null;

  // 2. Buat kandidat pencarian dari frasa utuh hingga kata terakhir
  // Contoh: "halo, apa kabar? Hati-h" -> kandidat: "Hati-h"
  // Contoh: "saya ingin sel" -> kandidat: "saya ingin sel" lalu "ingin sel" lalu "sel"
  const words = cleanSegment.split(/\s+/);
  const candidates = [];

  for (let i = 0; i < words.length; i++) {
    const subQuery = words.slice(i).join(" ");
    const subQueryIndex = textBeforeCursor.lastIndexOf(subQuery);
    candidates.push({ query: subQuery, startIndex: subQueryIndex });
  }

  // 3. Cocokkan kandidat terpanjang ke dalam kamus
  for (const { query, startIndex } of candidates) {
    const qLower = query.toLowerCase();
    if (qLower.length < 1) continue;

    const matches = dict.filter(item => {
      const itemLower = item.toLowerCase();
      return itemLower.startsWith(qLower) && itemLower !== qLower;
    }).slice(0, 5);

    if (matches.length > 0) {
      return {
        query: query,
        startIndex: startIndex,
        matches: matches
      };
    }
  }

  return null;
}

// Menampilkan Autocomplete
async function updateAutocomplete() {
  const text = sourceText.value;
  const cursorPos = sourceText.selectionStart;
  const textBeforeCursor = text.slice(0, cursorPos);

  const currentLang = sourceLangSelect.value;
  const dict = await getOrGenerateDictionary(currentLang);

  // Cari saran berdasarkan kata/frasa aktif di kursor
  const matchResult = findActiveQuery(textBeforeCursor, dict);

  if (!matchResult) {
    closeAutocomplete();
    return;
  }

  activeMatchInfo = matchResult;
  currentSuggestions = matchResult.matches;

  autocompleteList.innerHTML = "";
  currentSuggestions.forEach((suggestion, index) => {
    const li = document.createElement("li");
    li.className = "autocomplete-item";
    if (index === 0) {
      li.classList.add("active");
      activeSuggestionIndex = 0;
    }

    const queryLen = activeMatchInfo.query.length;
    const matchedPart = suggestion.slice(0, queryLen);
    const restPart = suggestion.slice(queryLen);

    li.innerHTML = `
      <span><span class="match-text">${matchedPart}</span>${restPart}</span>
      <span class="enter-hint">↵ Enter</span>
    `;

    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      applySuggestion(suggestion);
    });

    autocompleteList.appendChild(li);
  });

  autocompleteList.style.display = "block";
}

// Terapkan kata autocomplete ke dalam textarea
function applySuggestion(suggestion) {
  if (!activeMatchInfo) return;

  const cursorPos = sourceText.selectionStart;
  const textBeforeMatch = sourceText.value.slice(0, activeMatchInfo.startIndex);
  const textAfterCursor = sourceText.value.slice(cursorPos);

  // Sesuaikan huruf kapital jika pengguna mengetik huruf depan kapital
  let finalSuggestion = suggestion;
  const typedQuery = activeMatchInfo.query;
  if (typedQuery && typedQuery[0] === typedQuery[0].toUpperCase()) {
    finalSuggestion = suggestion[0].toUpperCase() + suggestion.slice(1);
  }

  // Masukkan hanya di kata yang sedang diketik, teks sebelumnya tetap utuh!
  sourceText.value = textBeforeMatch + finalSuggestion + textAfterCursor;

  // Pindahkan kursor ke akhir kata yang baru di-insert
  const newCursorPos = textBeforeMatch.length + finalSuggestion.length;
  sourceText.setSelectionRange(newCursorPos, newCursorPos);

  closeAutocomplete();
  sourceText.focus();
  charCount.textContent = `${sourceText.value.length} / 1000`;
}

// Tutup popup
function closeAutocomplete() {
  autocompleteList.style.display = "none";
  autocompleteList.innerHTML = "";
  currentSuggestions = [];
  activeSuggestionIndex = -1;
  activeMatchInfo = null;
}

function updateActiveSuggestionItem() {
  const items = autocompleteList.querySelectorAll(".autocomplete-item");
  items.forEach((item, idx) => {
    item.classList.toggle("active", idx === activeSuggestionIndex);
    if (idx === activeSuggestionIndex) {
      item.scrollIntoView({ block: "nearest" });
    }
  });
}

// ==============================================================
// EVENT LISTENER KEYBOARD (ENTER SENSITIVITY)
// ==============================================================

sourceText.addEventListener("input", () => {
  charCount.textContent = `${sourceText.value.length} / 1000`;
  updateAutocomplete();
});

sourceText.addEventListener("keydown", (e) => {
  const isAutocompleteOpen = autocompleteList.style.display !== "none" && currentSuggestions.length > 0;

  // 1. KETIKA TEKAN ENTER (Logo Baris Baru di Keyboard)
  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (isAutocompleteOpen) {
      // JIKA AUTOCOMPLETE AKTIF: Terima & Insert kata!
      e.preventDefault();
      const targetIndex = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
      applySuggestion(currentSuggestions[targetIndex]);
      return;
    } else {
      // JIKA AUTOCOMPLETE TIDAK AKTIF: Buat baris baru alami
      return;
    }
  }

  // 2. NAVIGASI PANAH ATAS / BAWAH & ESCAPE
  if (isAutocompleteOpen) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
      updateActiveSuggestionItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      updateActiveSuggestionItem();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeAutocomplete();
    }
  }

  // 3. SHORTCUT TRANSLATE (Ctrl + Enter atau Cmd + Enter)
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    closeAutocomplete();
    translate();
  }
});

// Tutup autocomplete jika klik di luar
document.addEventListener("click", (e) => {
  if (!e.target.closest(".textarea-container")) {
    closeAutocomplete();
  }
});

// Pra-muat kamus jika bahasa sumber diubah
sourceLangSelect.addEventListener("change", () => {
  closeAutocomplete();
  getOrGenerateDictionary(sourceLangSelect.value);
});

// ==============================================================
// MESIN TRANSLASI
// ==============================================================

async function translate() {
  const text = sourceText.value.trim();
  if (!text) {
    targetText.value = "";
    statusIndicator.textContent = "";
    return;
  }

  const fromLang = sourceLangSelect.value;
  const toLang = targetLangSelect.value;

  if (fromLang === toLang) {
    targetText.value = text;
    statusIndicator.textContent = "Selesai";
    return;
  }

  statusIndicator.textContent = "Menerjemahkan...";
  translateBtn.disabled = true;

  try {
    let translated = "";

    // Mesin 1: Google Translate
    try {
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
      const gRes = await fetch(googleUrl);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData && gData[0]) {
          translated = gData[0].map(item => item[0]).join("");
        }
      }
    } catch (err) {
      console.warn("Mesin 1 gagal, mencoba fallback:", err);
    }

    // Mesin 2: MyMemory API Fallback
    if (!translated || translated.trim() === "") {
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`;
      const mRes = await fetch(myMemoryUrl);
      if (mRes.ok) {
        const mData = await mRes.json();
        if (mData.responseData && mData.responseData.translatedText) {
          translated = decodeHTML(mData.responseData.translatedText);
        }
        if ((!translated || translated.trim() === "") && mData.matches && mData.matches.length > 0) {
          const match = mData.matches.find(m => m.translation && m.translation.trim() !== "");
          if (match) translated = decodeHTML(match.translation);
        }
      }
    }

    if (translated && translated.trim() !== "") {
      targetText.value = translated;
      statusIndicator.textContent = "Selesai";
    } else {
      targetText.value = "Terjemahan tidak ditemukan.";
      statusIndicator.textContent = "Gagal";
    }
  } catch (error) {
    console.error(error);
    targetText.value = "Gagal terhubung ke server terjemahan.";
    statusIndicator.textContent = "Error";
  } finally {
    translateBtn.disabled = false;
  }
}

// Tukar Bahasa
function swapLanguages() {
  const tempLang = sourceLangSelect.value;
  sourceLangSelect.value = targetLangSelect.value;
  targetLangSelect.value = tempLang;

  const tempText = sourceText.value;
  sourceText.value = targetText.value;
  targetText.value = tempText;

  charCount.textContent = `${sourceText.value.length} / 1000`;
  closeAutocomplete();
  getOrGenerateDictionary(sourceLangSelect.value);
}

// Text to Speech
function speak(text, lang) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

// Helper Decode HTML Entities
function decodeHTML(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

// Event Listeners
translateBtn.addEventListener("click", () => {
  closeAutocomplete();
  translate();
});

swapBtn.addEventListener("click", swapLanguages);

clearBtn.addEventListener("click", () => {
  sourceText.value = "";
  targetText.value = "";
  charCount.textContent = "0 / 1000";
  statusIndicator.textContent = "";
  closeAutocomplete();
});

copyBtn.addEventListener("click", () => {
  if (!targetText.value) return;
  navigator.clipboard.writeText(targetText.value);
  statusIndicator.textContent = "Tersalin!";
  setTimeout(() => (statusIndicator.textContent = ""), 2000);
});

speakSourceBtn.addEventListener("click", () => {
  speak(sourceText.value, sourceLangSelect.value);
});

speakTargetBtn.addEventListener("click", () => {
  speak(targetText.value, targetLangSelect.value);
});

// Jalankan inisialisasi
populateLanguages();
