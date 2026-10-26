/**
 * Skills Lab learning modules — the basics of each drill, explained so simply a school student could follow.
 * Short cards: one idea each, a plain example, and what to remember. Settled textbook facts only.
 */
export interface LessonCard {
  title: string;
  /** Short lines, one idea each ("**bold**" for the key words). */
  lines: string[];
  /** One line to remember. */
  remember?: string;
}
export interface Lesson {
  title: string;
  intro: string;
  cards: LessonCard[];
  source: string;
}

export const LESSONS: Record<string, Lesson> = {
  ecg: {
    title: "Reading an ECG",
    intro: "An ECG is a drawing of the heart's electricity. Each heartbeat makes the same little pattern of bumps.",
    cards: [
      { title: "The three bumps", lines: ["**P wave** — the top chambers (atria) squeeze.", "**QRS** — the tall spike: the big bottom chambers (ventricles) squeeze.", "**T wave** — the ventricles reset, ready for the next beat."], remember: "P = atria, QRS = ventricles, T = recovery." },
      { title: "Is it fast or slow?", lines: ["Normal heart rate: **60–100** beats a minute.", "Below 60 = **bradycardia** (slow). Above 100 = **tachycardia** (fast).", "Quick trick: 300 ÷ number of big squares between two spikes = rate."], remember: "300 ÷ big squares = heart rate." },
      { title: "Is it regular?", lines: ["Look at the gaps between spikes. Equal gaps = **regular**.", "Gaps all different and no clear P waves = **atrial fibrillation**."], remember: "Irregularly irregular → think atrial fibrillation." },
      { title: "Narrow or wide spike?", lines: ["A **narrow** QRS (under 3 small squares) means the beat started in the normal way, from the top.", "A **wide** QRS means the beat started in the ventricles or took a slow path (bundle branch block)."], remember: "Wide, fast and regular → treat as ventricular tachycardia until proven otherwise." },
      { title: "Heart attack signs", lines: ["**ST elevation** — the line after the spike is lifted up: a blocked artery right now.", "Where it shows tells you which wall: II, III, aVF = bottom (inferior); V1–V4 = front (anterior)."], remember: "ST up in two neighbouring leads = STEMI — call for urgent reperfusion." },
      { title: "Too much potassium", lines: ["High potassium makes **tall, peaked T waves** first.", "Then the P wave flattens and the QRS widens — dangerous."], remember: "Peaked T waves → check potassium now." },
    ],
    source: "Hampton, The ECG Made Easy; Harrison's Principles of Internal Medicine",
  },
  xray: {
    title: "Reading a chest X-ray",
    intro: "X-rays pass easily through air (black) but are stopped by bone (white). Everything else is grey in between.",
    cards: [
      { title: "Black, grey, white", lines: ["**Air** = black (the lungs).", "**Soft tissue and fluid** = grey (heart, muscle).", "**Bone and metal** = white."], remember: "Air black, bone white." },
      { title: "Check it's a good film", lines: ["Can you count about **6 ribs at the front** above the diaphragm? Then the breath was deep enough.", "Are the collarbones even? Then the patient wasn't turned."] },
      { title: "The heart size", lines: ["On a front (PA) film, the heart should be **less than half** the width of the chest.", "Bigger than half = **cardiomegaly** (a big heart)."], remember: "Heart more than half the chest width → enlarged." },
      { title: "White patch in the lung", lines: ["Lung should be black. A **white patch** means something replaced the air.", "Fluid or pus in the air spaces (pneumonia) often shows **air bronchograms** — dark airways inside the white."], remember: "White patch + air bronchograms → consolidation (e.g. pneumonia)." },
      { title: "Fluid at the bottom", lines: ["Fluid sinks. A **pleural effusion** fills the bottom corner and makes a curved line (meniscus).", "The sharp corner (costophrenic angle) is lost first."], remember: "Blunted corner → small effusion." },
      { title: "Air outside the lung", lines: ["In a **pneumothorax**, air leaks around the lung.", "You see a thin lung edge and **no lung markings** beyond it."], remember: "No markings at the edge → pneumothorax." },
    ],
    source: "Corne & Kumaran, Chest X-Ray Made Easy",
  },
  ct: {
    title: "Looking at CT scans",
    intro: "A CT is many X-ray slices stacked like bread. You look at one slice at a time, as if looking up from the patient's feet.",
    cards: [
      { title: "Left is right", lines: ["You look up from the feet, so the patient's **left is on your right**.", "Always check the side markers."] },
      { title: "Bright and dark", lines: ["Blood that has **just bled** is **bright white** in the brain.", "Air is black, fat is dark grey, bone is very white."], remember: "New bleed in the brain = bright." },
      { title: "Windows", lines: ["The same scan can be shown different ways ('windows').", "**Lung window** to see lungs, **bone window** to see fractures, **soft tissue window** for organs."], remember: "Change the window to see different tissues." },
      { title: "Brain bleeds by shape", lines: ["**Lens-shaped** (bulging both sides) = **extradural** — usually an artery.", "**Crescent** (banana) shape = **subdural** — usually veins."] },
    ],
    source: "Radiopaedia; Grainger & Allison's Diagnostic Radiology",
  },
  usg: {
    title: "Ultrasound basics",
    intro: "Ultrasound sends sound waves in and listens for the echoes — like a bat. No radiation, safe in pregnancy.",
    cards: [
      { title: "Black means fluid", lines: ["**Fluid** (urine, bile, blood) lets sound pass: it looks **black**.", "Solid organs look grey. **Stones and bone** look bright white with a **dark shadow** behind."], remember: "Black = fluid; bright with a shadow = stone." },
      { title: "Gallstones", lines: ["Bright spots inside the black gallbladder, with a shadow behind, that **move** when the patient turns."] },
      { title: "Free fluid in trauma", lines: ["In an injured patient, black fluid around the liver, spleen or bladder can be **blood**.", "This quick check is called **FAST**."] },
    ],
    source: "Radiopaedia; Oxford Handbook of Emergency Medicine",
  },
  smear: {
    title: "Blood smear basics",
    intro: "A drop of blood is spread thin and stained, so you can see the cells under the microscope.",
    cards: [
      { title: "Three kinds of cells", lines: ["**Red cells** carry oxygen (no nucleus, pale centre).", "**White cells** fight infection (have a nucleus).", "**Platelets** are tiny bits that help blood clot."] },
      { title: "Small, pale red cells", lines: ["**Microcytic hypochromic** = small and pale.", "The commonest cause is **iron deficiency**."], remember: "Small and pale → think iron deficiency first." },
      { title: "Big red cells", lines: ["**Macrocytes** with very lobed white cells (hypersegmented neutrophils) suggest **B12 or folate deficiency**."] },
      { title: "Malaria", lines: ["Parasites **inside** red cells.", "Banana-shaped gametocytes are typical of **Plasmodium falciparum**."] },
    ],
    source: "Hoffbrand's Essential Haematology",
  },
  clinical: {
    title: "Spotting signs in pictures",
    intro: "Many diseases leave signs you can see. Look carefully, describe what you see, then name it.",
    cards: [
      { title: "Describe before you name", lines: ["Where is it? What colour? What shape? One or many? Raised or flat?", "Saying what you see stops you jumping to the wrong answer."] },
      { title: "Yellow eyes", lines: ["Yellow whites of the eyes = **jaundice** (too much bilirubin)."] },
      { title: "Blue lips", lines: ["Blue lips or tongue = **central cyanosis** — not enough oxygen in the blood."] },
      { title: "Clubbing", lines: ["Fingertips swollen, the nail bed angle lost.", "Seen in lung cancer, bronchiectasis and some heart diseases."] },
    ],
    source: "Macleod's Clinical Examination",
  },
  radiology: {
    title: "Writing a radiology report",
    intro: "A report is a short story: who, what scan, what you see, and what it most likely is.",
    cards: [
      { title: "Read the request first", lines: ["Who is the patient and why was the scan done?", "It tells you where to look hardest."] },
      { title: "Look everywhere", lines: ["Go in the same order every time, so nothing is missed.", "Check the edges and corners too — many misses hide there."] },
      { title: "Findings, then impression", lines: ["**Findings**: what you see, in plain words.", "**Impression**: the most likely diagnosis in one line, and what to do next if urgent."], remember: "Say what you see, then what it means." },
    ],
    source: "Royal College of Radiologists guidance on reporting",
  },
  sounds: {
    title: "Heart and breath sounds",
    intro: "A stethoscope lets you hear valves closing and air moving. Normal sounds are steady; extra sounds are clues.",
    cards: [
      { title: "Lub-dub", lines: ["**S1 ('lub')** — the mitral and tricuspid valves close.", "**S2 ('dub')** — the aortic and pulmonary valves close.", "The quiet gap between lub and dub is systole (the squeeze)."] },
      { title: "Murmurs", lines: ["A **murmur** is a whooshing sound from rough blood flow.", "Between lub and dub = **systolic** (e.g. aortic stenosis, mitral regurgitation).", "After dub = **diastolic** (e.g. aortic regurgitation, mitral stenosis)."] },
      { title: "Extra heart sounds", lines: ["**S3** comes just after dub — 'Ken-tuc-ky' — often heart failure.", "**S4** comes just before lub — 'Ten-nes-see' — a stiff heart."] },
      { title: "Normal breathing", lines: ["**Vesicular** breath sounds: soft, longer breathing in than out, no gap."] },
      { title: "Crackles and wheeze", lines: ["**Crackles** — like Velcro or bubbling: fluid or secretions in small airways.", "**Wheeze** — a whistle, mostly breathing out: narrow airways (asthma, COPD).", "**Stridor** — a loud harsh noise breathing in: the upper airway is blocked — an emergency."], remember: "Stridor = emergency." },
    ],
    source: "Macleod's Clinical Examination",
  },
  antidotes: {
    title: "Antidotes",
    intro: "An antidote is a medicine that undoes a poison. First keep the patient safe (airway, breathing, circulation), then give the right antidote.",
    cards: [
      { title: "Safety first", lines: ["Check **ABC** — airway, breathing, circulation — before anything else.", "Call for help and check blood sugar."] },
      { title: "Opioids", lines: ["Small pupils, slow breathing, drowsy → opioid overdose.", "Antidote: **naloxone**. It can wear off before the opioid does — watch the patient."] },
      { title: "Paracetamol", lines: ["Can quietly damage the liver over days.", "Antidote: **N-acetylcysteine**, best given early."] },
      { title: "Organophosphates (pesticides)", lines: ["Too much acetylcholine: sweating, drooling, small pupils, slow pulse.", "Antidote: **atropine** (dry the secretions) with **pralidoxime**."] },
      { title: "Blood thinners", lines: ["Warfarin is reversed with **vitamin K**.", "Heparin is reversed with **protamine**."] },
    ],
    source: "BNF; TOXBASE; WHO poisoning guidance",
  },
  algorithms: {
    title: "Emergency algorithms",
    intro: "Algorithms are step-by-step plans, so in a panic everyone does the right thing in the right order.",
    cards: [
      { title: "ABCDE", lines: ["**A**irway → **B**reathing → **C**irculation → **D**isability (brain, sugar) → **E**xposure.", "Fix each problem before moving on."], remember: "Always ABCDE." },
      { title: "Cardiac arrest", lines: ["No pulse, not breathing normally → start **CPR** at once: hard and fast chest pushes, 100–120 a minute.", "Get the defibrillator. **Shockable** rhythms (VF, pulseless VT) get a shock."] },
      { title: "Anaphylaxis", lines: ["Sudden swelling, wheeze, low blood pressure after an allergen.", "First drug: **adrenaline into the muscle** (thigh)."], remember: "Anaphylaxis → IM adrenaline first." },
      { title: "Choking adult", lines: ["Can cough → encourage coughing.", "Can't cough → back blows, then abdominal thrusts."] },
    ],
    source: "Resuscitation Council UK; AHA guidelines",
  },
  calculations: {
    title: "Clinical calculations",
    intro: "Doctors do small sums every day — doses, fluids and scores. Write the formula, put in the numbers, then check it makes sense.",
    cards: [
      { title: "Dose by weight", lines: ["Dose = **mg per kg × weight in kg**.", "Example: 15 mg/kg for a 20 kg child = 300 mg."], remember: "Always check the maximum dose." },
      { title: "Body mass index", lines: ["**BMI = weight (kg) ÷ height (m)²**.", "Example: 70 kg, 1.75 m → 70 ÷ 3.06 ≈ 22.9."] },
      { title: "Mean arterial pressure", lines: ["**MAP ≈ diastolic + ⅓ × (systolic − diastolic)**.", "Example: 120/80 → 80 + 13 ≈ 93."] },
      { title: "Drip rate", lines: ["Volume ÷ time gives mL per hour.", "1,000 mL over 8 hours = 125 mL an hour."] },
      { title: "Does it make sense?", lines: ["After any sum, ask: is this number possible for this patient?", "A dose ten times too big is the classic error."] },
    ],
    source: "BNF for Children; Oxford Handbook of Clinical Medicine",
  },
};
