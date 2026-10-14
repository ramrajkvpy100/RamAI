/**
 * Hinglish (Hindi in Roman letters, as RamAI's patients write it) → Devanagari, so a Hindi voice reads
 * it with a real local accent instead of an English voice mangling it. Everyday words come from a
 * dictionary; anything else is spelled out phonetically (final "a" long, as in "mera"; consonant
 * clusters joined; a final nasal after a vowel becomes the anusvara). English words patients use
 * ("doctor", "BP") are written as Indians say them.
 */

const WORDS: Record<string, string> = {
  hai: "है", hain: "हैं", ho: "हो", hoon: "हूँ", hun: "हूँ", tha: "था", thi: "थी", the: "थे", nahi: "नहीं", nahin: "नहीं", na: "ना",
  main: "मैं", mein: "में", me: "में", mujhe: "मुझे", mujhko: "मुझको", mera: "मेरा", meri: "मेरी", mere: "मेरे", hum: "हम", humein: "हमें", hamare: "हमारे",
  aap: "आप", aapko: "आपको", aapne: "आपने", aapka: "आपका", tum: "तुम", yeh: "यह", ye: "ये", woh: "वह", wo: "वो", isko: "इसको", isne: "इसने", ise: "इसे", inko: "इनको", unko: "उनको", unhe: "उन्हें",
  kya: "क्या", kyun: "क्यों", kaise: "कैसे", kab: "कब", kahan: "कहाँ", kitna: "कितना", kitne: "कितने", kaun: "कौन",
  aur: "और", ya: "या", par: "पर", pe: "पे", se: "से", ko: "को", ka: "का", ki: "की", ke: "के", ne: "ने", tak: "तक", bhi: "भी", hi: "ही", toh: "तो", to: "तो",
  bahut: "बहुत", thoda: "थोड़ा", thodi: "थोड़ी", zyada: "ज़्यादा", jyada: "ज़्यादा", kam: "कम", ab: "अब", abhi: "अभी", phir: "फिर", fir: "फिर", baar: "बार", din: "दिन", raat: "रात", subah: "सुबह", shaam: "शाम",
  raha: "रहा", rahi: "रही", rahe: "रहे", gaya: "गया", gayi: "गई", gaye: "गए", hua: "हुआ", hui: "हुई", hue: "हुए", kar: "कर", karo: "करो", karna: "करना", kiya: "किया", kiye: "किए", lag: "लग", laga: "लगा", lagi: "लगी", lagta: "लगता", lagti: "लगती",
  dard: "दर्द", pet: "पेट", sar: "सर", sir: "सर", chhaati: "छाती", seene: "सीने", saans: "साँस", bukhar: "बुख़ार", khansi: "खाँसी", ulti: "उल्टी", chakkar: "चक्कर", kamzori: "कमज़ोरी", pyaas: "प्यास", paani: "पानी", khana: "खाना", dawai: "दवाई", dawa: "दवा", goli: "गोली",
  doctor: "डॉक्टर", saab: "साहब", sahab: "साहब", ji: "जी", haan: "हाँ", han: "हाँ", accha: "अच्छा", achha: "अच्छा", theek: "ठीक", thik: "ठीक", sach: "सच", bas: "बस", please: "प्लीज़",
  bp: "बीपी", sugar: "शुगर", test: "टेस्ट", report: "रिपोर्ट", injection: "इंजेक्शन", hospital: "हॉस्पिटल", tablet: "टैबलेट", ok: "ओके", okay: "ओके", sorry: "सॉरी",
  ghar: "घर", log: "लोग", beta: "बेटा", beti: "बेटी", maa: "माँ", papa: "पापा", bhai: "भाई", pati: "पति", patni: "पत्नी", bachcha: "बच्चा", bachche: "बच्चे",
  ek: "एक", do: "दो", teen: "तीन", char: "चार", paanch: "पाँच", hafte: "हफ़्ते", hafta: "हफ़्ता", mahine: "महीने", saal: "साल", ghante: "घंटे", ghanta: "घंटा",
  jaldi: "जल्दी", dheere: "धीरे", upar: "ऊपर", neeche: "नीचे", andar: "अंदर", bahar: "बाहर", saath: "साथ", baad: "बाद", pehle: "पहले", sab: "सब", kuch: "कुछ", koi: "कोई",
  khaya: "खाया", khaayi: "खाई", piya: "पिया", liya: "लिया", diya: "दिया", aaye: "आए", jaana: "जाना", jaa: "जा", jao: "जाओ", lo: "लो", lena: "लेना", dena: "देना", bola: "बोला", boli: "बोली", kaha: "कहा", jaata: "जाता", jaati: "जाती", jaate: "जाते", aata: "आता", aati: "आती", aaya: "आया", aayi: "आई", dekh: "देख", bata: "बता", batao: "बताओ", suno: "सुनो", chal: "चल", chalo: "चलो",
};

const CONS: [string, string][] = [
  ["chh", "छ"], ["ck", "क"], ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"],
  ["k", "क"], ["g", "ग"], ["j", "ज"], ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["f", "फ़"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["z", "ज़"], ["q", "क"], ["c", "क"], ["x", "क्स"],
];
/** [roman, independent letter, matra after a consonant] */
const VOWELS: [string, string, string][] = [
  ["aa", "आ", "ा"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ee", "ई", "ी"], ["ii", "ई", "ी"], ["oo", "ऊ", "ू"], ["uu", "ऊ", "ू"],
  ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"],
];
const HALANT = "्";

function phonetic(word: string): string {
  let out = "";
  let i = 0;
  let afterConsonant = false;
  while (i < word.length) {
    const rest = word.slice(i);
    // A final nasal after a vowel: "nahin", "hain" → anusvara.
    if (rest === "n" && i > 0 && /[aeiou]/.test(word[i - 1]!) && word.length > 3) {
      out += "ं";
      break;
    }
    const v = VOWELS.find(([r]) => rest.startsWith(r));
    if (v) {
      const atEnd = i + v[0].length === word.length;
      if (afterConsonant) out += v[0] === "a" && atEnd && word.length > 2 ? "ा" : v[2];
      else out += v[1];
      i += v[0].length;
      afterConsonant = false;
      continue;
    }
    const c = CONS.find(([r]) => rest.startsWith(r));
    if (c) {
      if (afterConsonant) out += HALANT;
      out += c[1];
      i += c[0].length;
      afterConsonant = true;
      continue;
    }
    out += word[i];
    i += 1;
    afterConsonant = false;
  }
  return out;
}

/** A Hinglish line in Devanagari, punctuation kept. Words already in Devanagari, and numbers, stay. */
export function toDevanagari(text: string): string {
  return text.replace(/[A-Za-z]+/g, (w) => {
    const lower = w.toLowerCase();
    if (WORDS[lower]) return WORDS[lower];
    if (w.length > 1 && w === w.toUpperCase()) return w; // ECG, CT: letters, said as letters
    return phonetic(lower);
  });
}
