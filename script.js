// Supported languages list
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

// Populate dropdowns with Indonesian as default source and English as default target
function populateLanguages() {
  for (const [code, name] of Object.entries(languages)) {
    const optSource = new Option(name, code);
    const optTarget = new Option(name, code);
    sourceLangSelect.add(optSource);
    targetLangSelect.add(optTarget);
  }

  // Indonesian -> English by default
  sourceLangSelect.value = "id";
  targetLangSelect.value = "en";
}

// Character counter
sourceText.addEventListener("input", () => {
  charCount.textContent = `${sourceText.value.length} / 1000`;
});

// Translation Engine (Dual-engine: Google Translate + MyMemory Fallback)
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

  statusIndicator.textContent = "Translating...";
  translateBtn.disabled = true;

  try {
    let translated = "";

    // Method 1: Google Translate API (fast, reliable for single words like "halo")
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
      console.warn("Primary engine error, switching to fallback:", err);
    }

    // Method 2: MyMemory API Fallback
    if (!translated || translated.trim() === "") {
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`;
      const mRes = await fetch(myMemoryUrl);
      if (mRes.ok) {
        const mData = await mRes.json();
        if (mData.responseData && mData.responseData.translatedText) {
          translated = decodeHTML(mData.responseData.translatedText);
        }
        // Fallback to matches if responseData was empty
        if ((!translated || translated.trim() === "") && mData.matches && mData.matches.length > 0) {
          const match = mData.matches.find(m => m.translation && m.translation.trim() !== "");
          if (match) translated = decodeHTML(match.translation);
        }
      }
    }

    if (translated && translated.trim() !== "") {
      targetText.value = translated;
      statusIndicator.textContent = "Done";
    } else {
      targetText.value = "Translation not found.";
      statusIndicator.textContent = "Error";
    }
  } catch (error) {
    console.error(error);
    targetText.value = "Failed to translate. Check your internet connection.";
    statusIndicator.textContent = "Error";
  } finally {
    translateBtn.disabled = false;
  }
}

// Swap languages and text
function swapLanguages() {
  const tempLang = sourceLangSelect.value;
  sourceLangSelect.value = targetLangSelect.value;
  targetLangSelect.value = tempLang;

  const tempText = sourceText.value;
  sourceText.value = targetText.value;
  targetText.value = tempText;

  charCount.textContent = `${sourceText.value.length} / 1000`;
}

// Text-to-Speech
function speak(text, lang) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

// Helper: Decode HTML Entities
function decodeHTML(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

// Event Listeners
translateBtn.addEventListener("click", translate);
swapBtn.addEventListener("click", swapLanguages);

clearBtn.addEventListener("click", () => {
  sourceText.value = "";
  targetText.value = "";
  charCount.textContent = "0 / 1000";
  statusIndicator.textContent = "";
});

copyBtn.addEventListener("click", () => {
  if (!targetText.value) return;
  navigator.clipboard.writeText(targetText.value);
  statusIndicator.textContent = "Disalin!";
  setTimeout(() => (statusIndicator.textContent = ""), 2000);
});

speakSourceBtn.addEventListener("click", () => {
  speak(sourceText.value, sourceLangSelect.value);
});

speakTargetBtn.addEventListener("click", () => {
  speak(targetText.value, targetLangSelect.value);
});

// Shortcut: Ctrl + Enter / Cmd + Enter to translate
sourceText.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    translate();
  }
});

// Run
populateLanguages();
