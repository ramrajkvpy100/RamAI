/** Clinical photographs — each diagnosis with its subject, so a doctor can practise one subject at a time. */
import type { PracticeItem } from "../practice";

import EXTRA from "./clinical-more.json";

type C = [id: string, subject: ClinicalSubject, label: string, key: string, search: string[], describe: string];

export const CLINICAL_SUBJECTS = ["Dermatology", "General medicine", "Eye", "ENT & mouth", "Paediatrics", "Surgery & ortho"] as const;
export type ClinicalSubject = (typeof CLINICAL_SUBJECTS)[number];

const C: C[] = [
  // Dermatology
  ["psoriasis", "Dermatology", "Plaque psoriasis", "Well-demarcated, red plaques with **silvery scale** on the **extensor surfaces** (elbows, knees).", ["plaque psoriasis elbow", "psoriasis vulgaris plaques"], "well-demarcated red scaly plaques of psoriasis, anywhere on the body"],
  ["vitiligo", "Dermatology", "Vitiligo", "Sharply defined **depigmented (milk-white) macules**, often symmetrical, around the face, hands or genitals.", ["vitiligo hands", "vitiligo depigmentation"], "depigmented milk-white patches of vitiligo, anywhere on the body"],
  ["zoster", "Dermatology", "Herpes zoster (shingles)", "Grouped **vesicles on a red base** in a **single dermatome**, not crossing the midline.", ["herpes zoster dermatome vesicles", "shingles rash trunk"], "grouped vesicles or crusts on a red base in a band on one side (any dermatome)"],
  ["tinea", "Dermatology", "Tinea corporis (ringworm)", "An annular, scaly plaque with an **active raised edge** and **central clearing**.", ["tinea corporis ring", "ringworm skin annular"], "a ring-shaped (annular) scaly patch of tinea, anywhere on the body"],
  ["scabies", "Dermatology", "Scabies", "Itchy papules and **burrows** in the **finger webs**, wrists and genitals, worse at night.", ["scabies finger webs burrows", "scabies hand"], "the papules, burrows or excoriations of scabies, anywhere on the body"],
  ["impetigo", "Dermatology", "Impetigo", "**Honey-coloured crusts** around the nose and mouth, usually in children.", ["impetigo honey crusted face", "impetigo child"], "honey-coloured crusts of impetigo, anywhere on the skin"],
  ["urticaria", "Dermatology", "Urticaria", "Raised, itchy **wheals** that come and go **within 24 hours**, leaving no mark.", ["urticaria hives wheals", "urticaria skin"], "raised pale-centred itchy wheals with surrounding redness"],
  ["cellulitis", "Dermatology", "Cellulitis", "A **spreading, warm, tender red** area of skin with poorly defined edges, often on the leg.", ["cellulitis leg", "cellulitis lower limb erythema"], "a red, swollen area of cellulitis, anywhere on the body"],
  ["acne", "Dermatology", "Acne vulgaris", "**Comedones** (blackheads, whiteheads), papules and pustules on the face, chest and back.", ["acne vulgaris face comedones"], "acne: comedones, papules or pustules"],
  ["leprosy", "Dermatology", "Leprosy (hypopigmented patch)", "A **hypopigmented, anaesthetic** patch — loss of sensation is the key sign.", ["leprosy skin patch hypopigmented", "tuberculoid leprosy"], "a skin patch of leprosy"],
  ["molluscum", "Dermatology", "Molluscum contagiosum", "Small, firm, pearly papules with a **central dimple (umbilication)**.", ["molluscum contagiosum papules"], "small pearly umbilicated papules on the skin"],
  ["pityriasis-versicolor", "Dermatology", "Pityriasis versicolor", "Fine-scaly, **hypo- or hyperpigmented** macules on the **upper trunk**; the scale shows on stretching the skin.", ["pityriasis versicolor", "tinea versicolor back"], "fine scaly hypopigmented or brown macules on the upper trunk"],
  ["pityriasis-rosea", "Dermatology", "Pityriasis rosea", "A **herald patch**, then oval pink scaly patches along the skin lines — a **'Christmas tree'** pattern on the back.", ["pityriasis rosea", "pityriasis rosea herald patch"], "oval pink scaly patches on the trunk of pityriasis rosea"],
  ["lichen-planus", "Dermatology", "Lichen planus", "**Purple, polygonal, flat-topped, itchy papules** with fine white lines (Wickham's striae), often on the wrists.", ["lichen planus wrist", "lichen planus papules"], "violaceous flat-topped papules of lichen planus"],
  ["atopic-eczema", "Dermatology", "Atopic eczema", "Dry, itchy, **lichenified** patches in the **flexures** (elbows, knees) with a history of atopy.", ["atopic dermatitis flexural", "atopic eczema"], "dry red itchy eczema, often in skin creases"],
  ["contact-dermatitis", "Dermatology", "Allergic contact dermatitis", "An itchy eczematous rash **in the shape of the contact** — a watch strap, a nickel button, a bindi.", ["allergic contact dermatitis nickel", "contact dermatitis"], "an eczematous rash matching the area that touched an allergen"],
  ["melasma", "Dermatology", "Melasma", "Symmetrical **brown patches on the cheeks, forehead and upper lip**, worse with sun and pregnancy.", ["melasma face"], "symmetrical brown patches of melasma on the face"],
  ["alopecia-areata", "Dermatology", "Alopecia areata", "A **round, smooth bald patch** with no scarring; **exclamation-mark hairs** at the edge.", ["alopecia areata patch"], "a round smooth patch of hair loss on the scalp or beard"],
  ["warts", "Dermatology", "Viral warts", "Rough, **hyperkeratotic papules** with tiny black dots (thrombosed capillaries), often on the hands.", ["common wart hand verruca vulgaris"], "rough warty papules of verruca vulgaris"],
  ["herpes-labialis", "Dermatology", "Herpes labialis (cold sore)", "**Grouped vesicles at the lip border** that crust, after a tingling prodrome; they recur.", ["herpes labialis lip", "cold sore lip"], "grouped vesicles or crusts on the lip"],
  ["sjs", "Dermatology", "Stevens–Johnson syndrome", "Dusky target lesions with **blistering and skin peeling** plus **mucosal erosions** (lips, eyes), days after a new drug.", ["Stevens-Johnson syndrome", "toxic epidermal necrolysis"], "blistering skin and eroded lips of Stevens–Johnson syndrome"],
  ["fixed-drug", "Dermatology", "Fixed drug eruption", "A round **dusky violet patch** that comes back **at the same spot** each time the drug is taken.", ["fixed drug eruption"], "a round dusky violet patch of a fixed drug eruption"],
  ["candida-intertrigo", "Dermatology", "Candidal intertrigo", "Bright red, moist rash in a **skin fold** with **satellite pustules** beyond the edge.", ["candidal intertrigo", "cutaneous candidiasis skin fold"], "red moist rash in a skin fold with satellite spots"],
  ["pemphigus", "Dermatology", "Pemphigus vulgaris", "**Flaccid blisters** that break into raw erosions, with **mouth ulcers**; Nikolsky sign positive.", ["pemphigus vulgaris"], "flaccid blisters and erosions of pemphigus"],
  ["bullous-pemphigoid", "Dermatology", "Bullous pemphigoid", "**Tense blisters** on red or normal skin in an **older person**, mouth usually spared.", ["bullous pemphigoid"], "tense blisters of bullous pemphigoid"],
  ["erythema-nodosum", "Dermatology", "Erythema nodosum", "**Tender red nodules on the shins** — think TB, streptococcus, sarcoid, drugs or leprosy (ENL).", ["erythema nodosum shins"], "tender red nodules on the front of the legs"],
  ["keloid", "Dermatology", "Keloid", "A firm, shiny scar that **grows beyond the original wound**, often on the chest, shoulders or earlobes.", ["keloid scar"], "a raised shiny keloid scar"],
  ["seb-derm", "Dermatology", "Seborrhoeic dermatitis", "**Greasy yellow scale** on red skin of the scalp, eyebrows and nasolabial folds.", ["seborrheic dermatitis face"], "greasy scaly redness of seborrhoeic dermatitis"],
  ["pediculosis", "Dermatology", "Head lice (pediculosis capitis)", "**Nits glued to the hair shafts** close to the scalp, with itching behind the ears.", ["head lice nits hair"], "lice eggs (nits) stuck to the hair"],
  ["melanoma", "Dermatology", "Malignant melanoma", "A pigmented lesion that is **Asymmetric, Border-irregular, Colour-varied, Diameter > 6 mm, Evolving** (ABCDE).", ["malignant melanoma skin"], "an irregular, multicoloured pigmented skin lesion of melanoma"],
  ["bcc", "Dermatology", "Basal cell carcinoma", "A **pearly nodule with rolled edges and telangiectasia**, often with a central ulcer (rodent ulcer), on sun-exposed skin.", ["basal cell carcinoma nodular"], "a pearly nodule or rodent ulcer of basal cell carcinoma"],
  // General medicine
  ["jaundice", "General medicine", "Jaundice (scleral icterus)", "**Yellow sclerae** — visible when bilirubin is above about 2.5–3 mg/dL.", ["scleral icterus jaundice eye", "jaundice yellow sclera"], "yellow discolouration of the sclera of the eye"],
  ["clubbing", "General medicine", "Finger clubbing", "Loss of the nail-bed angle and a **bulbous fingertip** (positive Schamroth's window sign).", ["finger clubbing nails", "digital clubbing"], "clubbed fingers or toes with bulbous tips"],
  ["koilonychia", "General medicine", "Koilonychia", "**Spoon-shaped**, thin, concave nails — classically **iron deficiency**.", ["koilonychia spoon nails"], "spoon-shaped concave fingernails"],
  ["goitre", "General medicine", "Goitre", "A **swelling in the front of the neck** that **moves up on swallowing**.", ["goitre neck swelling", "thyroid goiter"], "a visible goitre — an enlarged thyroid in the neck"],
  ["cyanosis", "General medicine", "Central cyanosis", "**Blue lips and tongue** — low oxygen saturation in the arterial blood.", ["central cyanosis lips", "cyanosis"], "bluish discolouration of the lips and tongue"],
  ["pitting-oedema", "General medicine", "Pitting oedema", "Swelling of the legs that **keeps a dent** after pressing for a few seconds.", ["pitting edema leg", "pitting oedema"], "pitting oedema — a dent left in swollen skin"],
  ["pallor", "General medicine", "Pallor of anaemia", "**Pale conjunctivae, palms and nail beds** — check the lower eyelid's inner lining.", ["conjunctival pallor anemia", "pale palm anemia"], "pale conjunctiva or palms in anaemia"],
  ["exophthalmos", "General medicine", "Graves' eye disease (exophthalmos)", "**Protruding eyes with lid retraction** — white sclera visible above the iris; with a goitre in Graves'.", ["exophthalmos Graves disease", "thyroid eye disease"], "protruding eyes with lid retraction of Graves' disease"],
  ["cushingoid", "General medicine", "Cushing's syndrome", "**Moon face, central obesity, wide purple striae** and a buffalo hump — often from long-term steroids.", ["Cushing syndrome striae", "Cushing syndrome moon face"], "features of Cushing's syndrome such as purple striae or a moon face"],
  ["xanthelasma", "General medicine", "Xanthelasma", "**Soft yellow plaques on the eyelids** near the inner canthus — check the lipids.", ["xanthelasma eyelid"], "yellow plaques on the eyelids"],
  ["gouty-tophi", "General medicine", "Gouty tophi", "**Chalky white-yellow nodules** over joints, the ear or the great toe in chronic gout.", ["gouty tophi hand", "tophaceous gout"], "chalky nodules of tophaceous gout"],
  ["rheumatoid-hands", "General medicine", "Rheumatoid hands", "**Ulnar deviation, swan-neck and boutonnière** deformities with swollen MCP joints.", ["rheumatoid arthritis hand deformity ulnar deviation"], "rheumatoid hand deformities with ulnar deviation"],
  ["malar-rash", "General medicine", "Malar (butterfly) rash of SLE", "A red rash over the **cheeks and bridge of the nose, sparing the nasolabial folds**, worse with sun.", ["lupus malar rash butterfly"], "a butterfly-shaped red rash over the cheeks and nose"],
  ["spider-naevi", "General medicine", "Spider naevi", "A central red arteriole with **radiating legs that blanch** when pressed — more than 5 suggests liver disease.", ["spider angioma liver"], "a spider naevus with radiating vessels"],
  ["caput-medusae", "General medicine", "Caput medusae", "**Dilated veins radiating from the umbilicus** in portal hypertension.", ["caput medusae abdomen"], "dilated abdominal wall veins around the umbilicus"],
  ["ascites", "General medicine", "Ascites", "A **distended abdomen with flanks bulging**, shifting dullness and an everted umbilicus.", ["ascites abdomen distension"], "a markedly distended abdomen from ascites"],
  ["purpura", "General medicine", "Purpura / petechiae", "**Non-blanching** red-purple spots — low platelets, vasculitis or meningococcal sepsis.", ["petechiae purpura skin", "petechial rash"], "non-blanching petechiae or purpura on the skin"],
  ["diabetic-foot", "General medicine", "Diabetic foot ulcer", "A **painless, punched-out ulcer at a pressure point** (under the metatarsal heads) with callus around it.", ["diabetic foot ulcer"], "a neuropathic ulcer on the sole of a diabetic foot"],
  ["acanthosis", "General medicine", "Acanthosis nigricans", "**Velvety dark thickening** of the skin of the **neck and armpits** — insulin resistance.", ["acanthosis nigricans neck"], "dark velvety skin on the back of the neck or armpit"],
  // Eye
  ["conjunctivitis", "Eye", "Conjunctivitis", "A **red eye** with discharge, normal vision and a normal pupil.", ["conjunctivitis red eye discharge", "bacterial conjunctivitis"], "a red, inflamed conjunctiva with sticky discharge"],
  ["subconj", "Eye", "Subconjunctival haemorrhage", "A **bright red patch over the white of the eye**, painless, with normal vision.", ["subconjunctival hemorrhage"], "a bright red patch of blood over the sclera"],
  ["cataract", "Eye", "Cataract", "A **white or grey opacity behind the pupil**, with gradual painless loss of vision.", ["mature cataract eye", "cataract pupil white"], "a cloudy white lens visible through the pupil"],
  ["pterygium", "Eye", "Pterygium", "A **wing-shaped fleshy growth** of conjunctiva onto the cornea, usually from the nasal side.", ["pterygium eye"], "a wing-shaped fleshy growth onto the cornea"],
  ["stye", "Eye", "Stye (hordeolum)", "A **tender red swelling at the eyelid margin** with a point of pus.", ["stye hordeolum eyelid"], "a red tender swelling on the eyelid edge"],
  ["chalazion", "Eye", "Chalazion", "A **painless firm lump within the eyelid**, away from the margin.", ["chalazion eyelid"], "a painless lump in the eyelid"],
  ["ptosis", "Eye", "Ptosis", "A **drooping upper eyelid** — think third nerve palsy, Horner's or myasthenia.", ["ptosis eyelid drooping"], "a drooping upper eyelid"],
  ["corneal-ulcer", "Eye", "Corneal ulcer", "A painful red eye with a **white spot on the cornea** that stains with fluorescein — an emergency.", ["corneal ulcer eye", "bacterial keratitis"], "a white corneal opacity in a red eye"],
  ["bitot", "Eye", "Bitot's spots (vitamin A deficiency)", "**Foamy, triangular grey-white patches on the conjunctiva** with night blindness.", ["Bitot spots vitamin A deficiency"], "foamy grey patches on the conjunctiva"],
  // ENT & mouth
  ["oral-candida", "ENT & mouth", "Oral thrush (candidiasis)", "**White curd-like plaques** on the tongue and mouth that **scrape off**, leaving a red base.", ["oral candidiasis tongue", "oral thrush"], "white curd-like plaques on the tongue and inside of the mouth"],
  ["tonsillitis", "ENT & mouth", "Acute tonsillitis", "**Swollen red tonsils with white exudate**, fever and painful swallowing.", ["acute tonsillitis exudate"], "swollen red tonsils with white exudate"],
  ["aphthous", "ENT & mouth", "Aphthous ulcer", "A **small, round, painful ulcer with a yellow base and red rim** inside the mouth; heals in 1–2 weeks.", ["aphthous ulcer mouth"], "a round shallow mouth ulcer with a yellow base"],
  ["leukoplakia", "ENT & mouth", "Oral leukoplakia", "A **white patch that does not scrape off** — premalignant, common with tobacco chewing.", ["oral leukoplakia"], "a white patch inside the mouth that cannot be scraped off"],
  ["osmf", "ENT & mouth", "Oral submucous fibrosis", "**Blanched, stiff oral mucosa** with **trismus** in an areca nut (supari/gutkha) user — premalignant.", ["oral submucous fibrosis"], "pale fibrous bands inside the mouth"],
  ["angular-cheilitis", "ENT & mouth", "Angular cheilitis", "**Cracks and redness at the corners of the mouth** — iron, B-vitamin deficiency or candida.", ["angular cheilitis"], "cracked red corners of the mouth"],
  ["geographic-tongue", "ENT & mouth", "Geographic tongue", "**Smooth red patches with white wavy borders** on the tongue that move over days; harmless.", ["geographic tongue"], "map-like smooth patches on the tongue"],
  ["otitis-externa", "ENT & mouth", "Otitis externa", "A **swollen red ear canal** with discharge; pain on **pulling the pinna**.", ["otitis externa ear canal"], "a red swollen ear canal"],
  ["perforated-tm", "ENT & mouth", "Perforated eardrum", "A **hole in the tympanic membrane** on otoscopy, after infection or trauma.", ["tympanic membrane perforation otoscopy"], "a perforated eardrum seen through an otoscope"],
  // Paediatrics
  ["varicella", "Paediatrics", "Chickenpox (varicella)", "Itchy vesicles **in different stages** (papules, vesicles, crusts) at once — 'dewdrop on a rose petal'.", ["chickenpox rash vesicles child", "varicella rash"], "a chickenpox rash: vesicles, papules or crusts, anywhere on the body"],
  ["measles", "Paediatrics", "Measles", "A **maculopapular rash** spreading from the face downwards, after fever, cough, coryza and conjunctivitis; Koplik spots in the mouth.", ["measles rash face", "measles maculopapular rash"], "a blotchy red maculopapular measles rash, anywhere on the body"],
  ["kwashiorkor", "Paediatrics", "Severe acute malnutrition", "**Visible wasting** (or oedema in kwashiorkor) — MUAC below 11.5 cm in a child aged 6–59 months.", ["severe acute malnutrition child", "marasmus child"], "a child with visible severe wasting"],
  ["hfmd", "Paediatrics", "Hand, foot and mouth disease", "**Oval grey vesicles on the palms and soles** with **mouth ulcers** in a young child.", ["hand foot and mouth disease"], "small vesicles on the hands, feet or mouth"],
  ["napkin-dermatitis", "Paediatrics", "Nappy (napkin) rash", "Red rash in the nappy area **sparing the skin folds** (irritant); fold involvement with satellites suggests candida.", ["diaper dermatitis"], "a red rash in the nappy area"],
  ["neonatal-jaundice", "Paediatrics", "Neonatal jaundice", "**Yellow skin spreading head to toe** in a newborn — check the bilirubin against the age in hours.", ["neonatal jaundice baby"], "a newborn with yellow skin"],
  ["mumps", "Paediatrics", "Mumps", "**Swelling in front of and below the ear** (parotid), lifting the earlobe, with fever.", ["mumps parotid swelling"], "a swollen parotid gland in front of the ear"],
  ["cleft-lip", "Paediatrics", "Cleft lip", "A **gap in the upper lip** (with or without the palate) present from birth.", ["cleft lip infant"], "a baby with a cleft upper lip"],
  ["kawasaki", "Paediatrics", "Kawasaki disease", "Fever for 5+ days with **red cracked lips, strawberry tongue**, red eyes without discharge, and **peeling fingertips**.", ["Kawasaki disease strawberry tongue", "Kawasaki disease"], "red cracked lips or strawberry tongue of Kawasaki disease"],
  // Surgery & ortho
  ["inguinal-hernia", "Surgery & ortho", "Inguinal hernia", "A **groin swelling with a cough impulse** that may reduce on lying down.", ["inguinal hernia swelling"], "a swelling in the groin from an inguinal hernia"],
  ["varicose", "Surgery & ortho", "Varicose veins", "**Dilated, tortuous superficial veins** of the leg, often with ankle skin changes.", ["varicose veins leg"], "twisted dilated veins on the leg"],
  ["lipoma", "Surgery & ortho", "Lipoma", "A **soft, painless, mobile, lobulated lump** under the skin with a slipping edge.", ["lipoma"], "a soft rounded lump under the skin"],
  ["sebaceous-cyst", "Surgery & ortho", "Epidermoid (sebaceous) cyst", "A **smooth dome-shaped lump with a central punctum**, attached to the skin.", ["epidermoid cyst punctum"], "a dome-shaped cyst with a small central punctum"],
  ["abscess", "Surgery & ortho", "Skin abscess", "A **hot, red, tender, fluctuant swelling** — needs incision and drainage.", ["skin abscess"], "a red swollen fluctuant skin abscess"],
  ["gangrene", "Surgery & ortho", "Dry gangrene", "**Black, shrivelled, dry toes** with a clear line of demarcation — critical limb ischaemia.", ["dry gangrene toes"], "black dry gangrenous toes"],
  ["burn", "Surgery & ortho", "Partial-thickness burn", "**Blisters on a red, moist, painful base** that blanches — superficial partial thickness.", ["partial thickness burn blisters"], "a blistered red partial-thickness burn"],
  ["paronychia", "Surgery & ortho", "Acute paronychia", "A **red, tender, swollen nail fold**, often with pus at the edge.", ["paronychia finger"], "a swollen red nail fold"],
  ["ingrown-toenail", "Surgery & ortho", "Ingrown toenail", "The **nail edge digging into a swollen, red side of the big toe**, often with granulation tissue.", ["ingrown toenail"], "an ingrown big-toe nail with swollen skin"],
  ["hydrocele", "Surgery & ortho", "Hydrocele", "A **painless scrotal swelling** you can get above, that **transilluminates**.", ["hydrocele scrotum"], "a swollen scrotum from a hydrocele"],
  ["clubfoot", "Surgery & ortho", "Clubfoot (CTEV)", "A newborn's foot turned **down and in** (equinus, varus, adduction) — Ponseti casting.", ["clubfoot infant"], "a baby's foot turned inwards and downwards"],
  ["ganglion", "Surgery & ortho", "Ganglion cyst", "A **smooth, firm lump on the back of the wrist** that may transilluminate.", ["ganglion cyst wrist"], "a smooth lump on the back of the wrist"],
];

/** Written by AI and checked by an AI examiner, filling each subject towards 50 (scripts/gen-clinical.mjs). */
const MORE = (EXTRA as { id: string; subject: string; label: string; key: string; search: string[]; describe?: string }[]).filter((x) => (CLINICAL_SUBJECTS as readonly string[]).includes(x.subject) && x.label && x.key && Array.isArray(x.search) && x.search.length > 0);

export const CLINICAL_ITEMS: (PracticeItem & { subject: ClinicalSubject })[] = [
  ...C.map(([id, subject, label, key, search, describe]) => ({ id, subject, label, key, search, describe })),
  ...MORE.map((x) => ({ id: x.id, subject: x.subject as ClinicalSubject, label: x.label, key: x.key, search: x.search.slice(0, 3), describe: x.describe ?? x.label })),
];
