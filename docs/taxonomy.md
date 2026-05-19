# Thematic Labels — Taxonomy v0

**Status:** Draft for review
**Last updated:** 2026-05-17
**Linked roadmap:** [`THEMATIC_LABELS_ROADMAP.md`](../THEMATIC_LABELS_ROADMAP.md)

This document is both a **human-readable spec** for reviewers and the **system-prompt context** for the LLM labeler. Treat it as a contract: if a labeling decision is contested, the resolution path is to amend this file rather than to label inconsistently.

---

## 1. How to read a label

Every label has six fields:

| Field | Purpose |
|---|---|
| `id` | Stable kebab-case identifier. Never renamed. Used in `assignments.json`, in URLs, and in analytics. |
| `displayName` | What the user sees. Multilingual (en/ar/ur) in the production JSON. In this spec, English is primary and the Arabic transliteration (plus other alternate names) appears in italics after it — e.g. *Jesus (Isa, Eesa)*. |
| `aliases` | Names that resolve to this label. Includes Arabic transliterations (`Isa`, `Eesa` → `jesus`; `Yahya` → `john`), English alternates (`Enoch` → `idris`), and common variants. The filter UI matches against `id`, `displayName`, and `aliases` case-insensitively — so a user typing "Yahya" finds sections tagged `john` without us needing to duplicate the label. This is the alias layer that sits *on top* of the tag system. |
| `facet` | Which top-level group it belongs to. Drives color and grouping in the UI. |
| `definition` | One sentence. The reviewer's test: does this section meet this criterion? |
| `examples` | 2–4 known sections (`surah:startAyah`, matching `theme_breaks.json`) that should carry this label. The seed for sanity-checking the LLM. |

**On aliases specifically.** Aliases are not separate tags; they are alternate strings that resolve to the same label. The principle: one canonical id per person/concept, every culturally-relevant name resolves to it. This is critical for People (Arabic↔English transliteration) and useful for ritual terms (e.g. `Salah`/`Salat`/`Namaz` → `prayer`). The production `taxonomy.json` will carry an `aliases: [...]` array per label; this spec shows the most important aliases inline.

---

## 2. Labeling rules (apply to every section)

These rules apply globally and override any facet-specific instinct:

1. **Label sections, not verses.** A section is the range of ayahs between two adjacent entries in `theme_breaks.json` for a given surah. The section ID is `"{surah}:{startAyah}"`. **Straddling themes:** when a single image, address, or argument spans a section break (e.g. the birds in Al-Mulk 67:19 close one section and open the next), tag the same label on *both* sections. Sections are reading units, not theme units — generous overlap is correct.
2. **Aim for 2–12 labels per section.** Some sections are intricate and warrant rich tagging. Single-label sections are common in short surahs; sections that demand more than 12 are usually either too long or the labels are being applied too loosely — flag for review.
3. **Tag every named figure and every addressed group.** The Qur'an is precise about whom it names and whom it addresses; a user searching for `moses` expects to find every section in which Moses is named, even in passing reference. The same applies to collective addressees — `mankind`, `believers`, `children-of-israel`, `people-of-the-book`. Generous tagging is the default here: under-recall hurts the product far more than over-recall does.
4. **Tag every divine attribute named or invoked.** Closing formulas like "Indeed He is the Forgiving, the Merciful" *are* the attribute claim — the preceding verses are the argument that earns it. Tagging both lets a user trace which arguments lead the Qur'an to assert which attribute. Apply the same logic to attributes invoked mid-section.
5. **Concept labels need a concrete trigger.** Abstract concepts — `guidance`, `taqwa`, `righteous-conduct`, `patience`, `gratitude`, `humility`, `repentance`, `corruption-on-earth` — become useless filters if applied to every morally-toned section. Tag a concept label only when the section *names* the concept (in the Arabic or the translation) or makes it the *explicit subject* of an instruction, exhortation, or depicted act. A section that is broadly virtuous in tone but does not name or depict the concept does not get the label. **This rule does not apply to** named figures and addressed groups (rule 3) or named divine attributes (rule 4), which are always tagged.
6. **Du'a means uttered, not commanded.** A section gets a `dua-*` label only when it contains an *uttered* supplication (commonly `Rabbanā…`, `Rabbi…`, `Allāhumma…`). Sections that *describe* or *command* du'a get `prayer` or the relevant ethical label instead.
7. **Adjudication:** when the translation alone is ambiguous, consult **Ibn Kathir's tafsir** (already wired into the Scholar modal) as the primary tie-breaker. If still unsure, mark the section's labels with confidence `medium` and surface it in the review queue.
8. **New labels are amendments, not improvisation.** If a section genuinely needs a label that doesn't exist, the LLM proposes it under `suggestedNewLabels` and a human decides whether to extend the taxonomy. Never silently invent.
9. **Empty is allowed.** Some sections (opening basmalas, the disjoined letters by themselves) have no thematic content. Leave them empty rather than forcing a tag.

---

## 3. Facets

Nine facets, ordered roughly by frequency. Each facet has a stable color in the UI.

| Facet | Color (suggested) | Roughly covers |
|---|---|---|
| `people` | Indigo | Named figures, named groups, collective addressees |
| `divine-attributes` | Gold | God's names, attributes, and actions toward creation |
| `dua` | Teal | Sections containing uttered supplications |
| `worldly-matters` | Earth-brown | Law, ritual, family, social conduct |
| `ethical-states` | Sage green | Positive virtues and inner dispositions |
| `negative-attributes` | Crimson | Vices, warned-against traits, sinful patterns |
| `eschatology` | Deep purple | Afterlife, judgment, resurrection, past nations |
| `cosmology` | Slate blue | Creation, natural signs, death |
| `revelation` | Bronze | The Qur'an, prior scriptures, prophethood as a category |

---

## 4. People & Figures (`people`)

Sections where a named figure or named group is a *subject* of the passage. Use generously for narrative sections; use sparingly for warnings about a group.

Order is roughly chronological for the prophet block, then antagonists, then peoples and collectives.

| id | Display | Definition | Examples |
|---|---|---|---|
| `adam` | Adam *(Ādam)* | Sections featuring the creation, fall, or repentance of Adam, or his sons. | `2:30`, `7:10`, `20:115` |
| `idris` | Idris *(Enoch)* | A truthful prophet raised to a high station; pre-Flood. | `19:56`, `21:85` |
| `noah` | Noah *(Nuh, Nūḥ)* | The Flood narrative, Noah's da'wah, his son, or his prayer. | `7:59`, `11:25`, `71:1` |
| `hud` | Hud *(Hūd)* | Prophet sent to 'Ad; warns of their destruction by a barren wind. | `7:65`, `11:50`, `26:123`, `46:21` |
| `salih` | Salih *(Sāliḥ)* | Prophet sent to Thamud; the she-camel sign; the rock-cut homes. | `7:73`, `11:61`, `26:141`, `27:45` |
| `abraham` | Abraham *(Ibrahim, Ibrāhīm, Khalilullah)* | Abraham's monotheism, breaking idols, the sacrifice, his prayer for Mecca. | `2:122`, `6:74`, `14:35`, `37:83` |
| `isaac` | Isaac *(Ishaq, Isḥāq)* | Abraham's son; granted as a prophet, often paired with Jacob. | `19:49`, `21:72`, `37:112` |
| `ishmael` | Ishmael *(Ismail, Ismāʿīl)* | Abraham's eldest son; true to his promise; co-builder of the Ka'bah. | `2:127`, `19:54`, `21:85` |
| `lot` | Lot *(Lut, Lūṭ)* | Lot's people, their corruption, their destruction. | `7:80`, `11:77`, `27:54` |
| `jacob` | Jacob *(Yaqub, Yaʿqūb, Israel, Isrāʾīl)* | The patriarch (also called Israel); Abraham's grandson; father of Joseph. | `12:6`, `19:6`, `19:49` |
| `joseph` | Joseph *(Yusuf, Yūsuf)* | The Joseph narrative (almost entirely Surah Yusuf). | `12:3`, `12:21`, `12:50` |
| `shuayb` | Shuayb *(Shuʿayb, Jethro)* | Prophet sent to Madyan; warned them against fraud in trade and short-measuring. | `7:85`, `11:84`, `26:177`, `29:36` |
| `moses` | Moses *(Musa, Mūsā, Kalimullah)* | Moses's call, confrontation with Pharaoh, the Exodus, his time at Sinai. | `7:103`, `20:9`, `28:7` |
| `aaron` | Aaron *(Harun, Hārūn)* | Moses's brother; appointed prophet alongside him, often co-mentioned. | `19:53`, `20:30`, `25:35` |
| `dhul-kifl` | Dhul-Kifl *(Dhū al-Kifl)* | A patient prophet mentioned briefly alongside Ishmael and Idris; tradition associates him variably with Ezekiel or Isaiah. | `21:85`, `38:48` |
| `david` | David *(Dawud, Dāwūd)* | David's kingship, his judgment between disputants, his psalms. | `21:78`, `34:10`, `38:17` |
| `solomon` | Solomon *(Sulaiman, Sulaymān)* | Solomon's kingdom, his control over jinn/wind/animals, Queen of Sheba. | `27:15`, `34:12`, `38:30` |
| `elijah` | Elijah *(Ilyas, Ilyās)* | Prophet who called his people away from worshipping Ba'al. | `6:85`, `37:123` |
| `elisha` | Elisha *(al-Yasa, al-Yasaʿ)* | Prophet mentioned in brief lists of the favored. | `6:86`, `38:48` |
| `jonah` | Jonah *(Yunus, Yūnus, Dhu an-Nun)* | Jonah's flight, the fish, his repentance. | `10:98`, `21:87`, `37:139` |
| `job` | Job *(Ayyub, Ayyūb)* | Job's affliction and steadfast patience. | `21:83`, `38:41` |
| `zechariah` | Zechariah *(Zakariya, Zakarīyā)* | Zechariah's secret prayer for an heir; the sign of muteness; his guardianship of Mary. | `3:37`, `19:1`, `21:89` |
| `john` | John *(Yahya, Yaḥyā)* | John's birth, his given character — wisdom as a child, dutifulness, God-consciousness. | `3:39`, `19:7`, `19:12`, `21:90` |
| `mary` | Mary *(Maryam)* | Mary as a subject — her devotion, the annunciation, her trial. | `3:35`, `19:16`, `66:12` |
| `jesus` | Jesus *(Isa, Eesa, ʿĪsā)* | The conception, miracles, ministry, or theological status of Jesus. | `3:45`, `5:110`, `19:27` |
| `muhammad` | Muhammad ﷺ *(Muḥammad, Ahmad)* | Sections directly addressing the Prophet, his role, or his domestic life. | `33:28`, `33:45`, `48:1`, `93:1` |
| `family-of-imran` | Family of Imran *(Āl ʿImrān)* | The household of Imran, especially Mary's mother, Mary, and the chosen lineage named in Surah Al-Imran. | `3:33`, `3:35`, `66:12` |
| `disciples` | Disciples *(Hawariyyun)* | The disciples of Jesus who profess support for Allah and His messenger. | `3:52`, `5:111`, `61:14` |
| `pharaoh` | Pharaoh *(Firaun, Firʿawn)* | Pharaoh as antagonist — his court, his magicians, his drowning. | `7:103`, `28:4`, `79:15` |
| `saul` | Saul *(Talut, Ṭālūt)* | The king appointed for the Children of Israel before David's victory over Goliath. | `2:247`, `2:249` |
| `goliath` | Goliath *(Jalut, Jālūt)* | The opposing warrior defeated by David in the Saul narrative. | `2:249`, `2:251` |
| `iblis` | Iblis *(Satan, Shaytan, Shayṭān)* | The refusal to prostrate, the whispering, the tempter's role. | `2:34`, `7:11`, `15:26` |
| `ad` | 'Ad *(ʿĀd)* | The people of Hud — known for might; destroyed by a barren wind. | `7:65`, `11:50`, `46:21`, `89:6` |
| `thamud` | Thamud *(Thamūd)* | The people of Salih — carvers of mountain dwellings; destroyed by the cry / earthquake after slaying the she-camel. | `7:73`, `11:61`, `27:45`, `91:11` |
| `madyan` | Madyan *(Midian)* | The people of Shuayb — destroyed for fraud in trade. | `7:85`, `11:84`, `29:36` |
| `dhul-qarnayn` | Dhul-Qarnayn *(Dhū al-Qarnayn)* | The traveler-king narrative and Gog & Magog. | `18:83` |
| `companions-of-the-cave` | People of the Cave *(Ashab al-Kahf)* | The narrative of the youths in the cave. | `18:9`, `18:13` |
| `children-of-israel` | Children of Israel *(Bani Israel, Banū Isrāʾīl)* | Bani Israel as collective subject — covenant, rebellion, prophets sent to them. | `2:40`, `2:83`, `5:12`, `17:4` |
| `patriarchs` | Patriarchs / Tribes *(al-Asbat)* | The patriarchal tribes or descendants named alongside Abraham, Ishmael, Isaac, Jacob, Moses, and Jesus in revelation lists. | `2:136`, `2:140`, `3:84` |
| `people-of-the-book` | People of the Book *(Ahl al-Kitab)* | Jews and Christians addressed collectively. | `3:64`, `3:113`, `4:171`, `5:15` |
| `sabeans` | Sabeans *(Sabi'un, Ṣābiʾūn)* | The Sabeans as a named religious community listed with believers, Jews, and Christians. | `2:62`, `5:69`, `22:17` |
| `hypocrites` | Hypocrites *(Munafiqun, Munāfiqūn)* | Sections about the Munafiqun — their behavior, their fate, their identification. | `2:8`, `4:142`, `9:64`, `63:1` |
| `believers` | Believers *(Mu'minun, Muʾminūn)* | Direct address to believers (`yā ayyuhā alladhīna āmanū`) as the rhetorical subject. | `2:104`, `5:1`, `33:9`, `49:6` |
| `mankind` | Mankind *(Naas, an-Nās)* | Universal address to all humanity (`yā ayyuhā an-nās`). A finite, identifiable set; high-value filter for users wanting every passage addressed to humans as such. | `2:21`, `4:1`, `22:1`, `49:13` |
| `disbelievers` | Disbelievers *(Kafirun, Kāfirūn)* | Disbelievers as collective subject — their arguments, their fate, their accusations. | `6:1`, `25:4`, `109:1` |
| `polytheists` | Polytheists *(Mushrikun, Mushrikūn)* | Mushrikun specifically — those associating partners with God. | `9:1`, `22:31` |
| `quraysh` | Quraysh *(Meccans)* | Sections aimed at the early Meccan opposition. | `74:11`, `106:1`, `108:1` |
| `angels` | Angels *(Mala'ikah, Malāʾikah)* | Angels as collective subject, including Gabriel/Jibril when not separately named. | `2:30`, `2:285`, `35:1`, `78:38` |
| `harut-and-marut` | Harut and Marut *(Hārūt, Mārūt)* | The two angels named in the Babylon sorcery passage. | `2:102` |
| `jinn` | Jinn | Jinn as collective subject. | `55:14`, `72:1` |

---

## 5. Divine Attributes (`divine-attributes`)

Seeded from the 99 Names but clustered into thematic groups, not split per name. Tag only when the attribute is the section's substance, not a closing flourish.

| id | Display | Definition | Examples |
|---|---|---|---|
| `tawhid` | Oneness of God | Sections asserting God's absolute oneness or refuting associates/sons. | `2:163`, `112:1`, `39:4` |
| `mercy` | Mercy | God's mercy, forgiveness, and compassion as the dominant theme. | `7:156`, `39:53`, `55:1` |
| `justice` | Justice | God's justice, fair judgment, never wronging by an atom's weight. | `4:40`, `21:47`, `99:7` |
| `sovereignty` | Sovereignty | God as King, owner of dominion, holder of all power. | `3:26`, `25:2`, `67:1` |
| `knowledge` | Knowledge | God's complete knowledge of the seen and unseen. | `6:59`, `13:8`, `49:18` |
| `power` | Power | God's omnipotence and ability over all things. | `35:1`, `41:39` |
| `wisdom` | Wisdom | God's wise ordering of events, decree, and law. | `2:269`, `31:2` |
| `creation` | Creator | God as Creator — bringing into being, originating. | `40:62`, `59:24`, `87:1` |
| `provision` | Provider | God as sustainer who provides rizq to all creatures. | `11:6`, `29:60`, `51:58` |
| `guidance` | Guidance | God as the source of guidance, sender of guidance, light through darkness. | `1:6`, `24:35`, `28:56` |
| `nearness-and-response` | Nearness & Response | God as near, hearing, responding to those who call. | `2:186`, `50:16` |
| `divine-decree` | Decree | God's decree, predestination, the lawh mahfuz, what He has written. | `9:51`, `57:22` |

---

## 6. Du'a & Supplication (`dua`)

Apply only when a supplication is **uttered** in the section. Almost every du'a label co-occurs with `believers` or with a specific prophet.

| id | Display | Definition | Examples |
|---|---|---|---|
| `dua-forgiveness` | Du'a for Forgiveness | Uttered supplication asking for forgiveness or removal of sin. | `2:286`, `3:147`, `7:23`, `71:28` |
| `dua-guidance` | Du'a for Guidance | Asking to be guided to or kept on the straight path. | `1:6`, `3:8`, `2:250` |
| `dua-distress` | Du'a in Distress | Calling on God in hardship, fear, or persecution. | `21:83`, `21:87`, `7:126` |
| `dua-family-offspring` | Du'a for Family | Asking for righteous offspring, spouses, or family. | `3:38`, `19:5`, `25:74`, `46:15` |
| `dua-knowledge-wisdom` | Du'a for Knowledge | Asking for understanding, wisdom, or eloquence. | `20:25`, `20:114`, `26:83` |
| `dua-protection` | Du'a for Protection | Seeking refuge from evil, satanic suggestion, calamity, hell. | `2:201`, `23:97`, `113:1`, `114:1` |
| `dua-gratitude` | Du'a of Gratitude | Supplications that thank or praise God for a blessing or favor. | `27:15`, `27:19`, `46:15` |

---

## 7. Worldly Matters / Law (`worldly-matters`)

Sections that legislate or instruct on conduct in this life.

| id | Display | Definition | Examples |
|---|---|---|---|
| `marriage-and-family` | Marriage & Family | Rules of marriage, treatment of spouses, family conduct. | `4:1`, `4:19`, `30:21`, `33:35` |
| `divorce` | Divorce | Rules of divorce, iddah, custody, separation. | `2:229`, `65:1`, `33:49` |
| `inheritance` | Inheritance | Distribution of estate and inheritance shares. | `4:7`, `4:11`, `4:176` |
| `war-and-treaties` | War & Treaties | Rules of fighting, peace agreements, conduct during conflict. | `2:190`, `8:1`, `9:1`, `48:1` |
| `migration` | Migration (Hijrah) | Leaving home or being expelled for Allah's cause; the moral and legal status of emigrants. | `2:218`, `3:195`, `8:72`, `59:9` |
| `trade-and-debt` | Trade & Debt | Commerce, contracts, debt, witnessing. | `2:282`, `4:29` |
| `interest` | Interest (Riba) | Sections legislating against or warning about riba — usury, interest, and unjust gain through lending. | `2:275`, `2:278`, `3:130`, `30:39` |
| `intoxicants-and-gambling` | Intoxicants & Gambling | Wine/intoxicants, gambling, games of chance, and their social or spiritual harms. | `2:219`, `5:90`, `5:91` |
| `food-and-dietary` | Food & Dietary Law | What is permitted and forbidden to eat; slaughter rules. | `2:172`, `5:3`, `6:118`, `16:114` |
| `ritual-purity` | Purity & Hygiene | Wudu, ghusl, menstruation, ritual cleanliness. | `4:43`, `5:6`, `2:222` |
| `prayer` | Prayer (Salah) | Establishment of salah, its times, its conduct. | `2:43`, `4:103`, `20:14`, `73:1` |
| `fasting` | Fasting | Rules and virtues of fasting, primarily Ramadan. | `2:183` |
| `hajj-and-pilgrimage` | Hajj | The pilgrimage, its rites, the sacred precincts. | `2:196`, `3:97`, `22:25` |
| `sacred-mosque-and-qiblah` | Sacred Mosque & Qiblah | The Sacred Mosque, qiblah direction, and sanctuary-linked orientation or access rules. | `2:142`, `2:144`, `2:149`, `9:19` |
| `zakat-and-charity` | Zakat & Charity | Obligatory zakat, voluntary sadaqah, spending in God's cause. | `2:177`, `2:261`, `9:60`, `57:18` |
| `orphan-care` | Orphan Care | Care, protection, fair treatment, and property rights of orphans. | `2:220`, `4:2`, `4:6`, `107:2` |
| `manumission-and-captives` | Manumission & Captives | Freeing slaves, ransom, captives, and liberation-linked obligations or virtues. | `2:177`, `4:92`, `5:89`, `90:13` |
| `oaths-and-vows` | Oaths & Vows | Swearing, breaking oaths, expiation. | `2:224`, `5:89`, `66:1` |
| `covenant` | Covenant & Pledges | Covenants, solemn pledges, and binding commitments between Allah and people or among people. | `2:27`, `2:40`, `2:83`, `3:77` |
| `justice-and-witness` | Justice & Testimony | Bearing witness, just judgment between people, slander cases. | `4:135`, `5:8`, `24:4` |

---

## 8. Ethical & Spiritual States (`ethical-states`)

Positive inner dispositions and virtues. Tag when the section commends, defines, or models the trait.

| id | Display | Definition | Examples |
|---|---|---|---|
| `patience` | Patience (Sabr) | Commendation or modeling of steadfast patience under trial. | `2:153`, `3:200`, `103:1` |
| `gratitude` | Gratitude (Shukr) | Commendation of thankfulness, recognition of God's favors. | `14:7`, `27:40`, `31:12` |
| `taqwa` | God-Consciousness (Taqwa) | The disposition of being mindful of God; the muttaqun. | `2:2`, `49:13`, `92:5` |
| `trust-in-god` | Trust (Tawakkul) | Reliance on God in decision and outcome. | `3:159`, `65:3` |
| `repentance` | Repentance (Tawbah) | Turning back to God, the door of repentance, accepting the repentant. | `4:17`, `9:104`, `66:8` |
| `humility` | Humility | Lowering oneself before God or fellow humans; rejecting pride. | `7:55`, `25:63`, `31:18` |
| `sincerity` | Sincerity (Ikhlas) | Acting purely for God's sake, free of ostentation. | `7:29`, `39:2`, `98:5` |
| `remembrance` | Remembrance (Dhikr) | Remembering God by tongue or heart; the role of dhikr in calming the heart. | `13:28`, `33:41`, `63:9` |
| `praise` | Praise (Hamd) | Sections containing explicit praise or glorification of God — `al-ḥamdu lillāh`, `tabāraka`, `subḥān`, `Allāhu akbar`. Distinct from `gratitude` (which marks shukr for specific blessings) and from divine-attribute labels (which mark the attribute being praised). Apply when praise is *uttered* in the section, not merely commanded. | `1:2`, `17:111`, `67:1`, `87:1` |
| `righteous-conduct` | Righteous Conduct | Broad ethical conduct toward parents, neighbors, the poor — the "righteousness" passages. | `2:177`, `17:23`, `90:12` |

---

## 9. Negative Attributes / Warnings (`negative-attributes`)

Vices, sinful patterns, traits warned against.

| id | Display | Definition | Examples |
|---|---|---|---|
| `arrogance` | Arrogance (Kibr) | Pride that refuses truth or despises people; Iblis's defining flaw. | `7:13`, `16:23`, `40:35` |
| `hypocrisy` | Hypocrisy | The trait of professing belief outwardly while disbelieving inwardly. | `2:8`, `4:142`, `63:1` |
| `plotting` | Plotting (Makr) | Scheming and conspiracy against truth or against the believers; God's counter-plan. | `3:54`, `8:30`, `27:50` |
| `shirk` | Idolatry (Shirk) | Associating partners with God in worship, lordship, or attributes. | `4:48`, `31:13`, `39:65` |
| `mockery` | Mockery | Mocking the believers, the Prophet, or revelation; mocking past prophets. | `9:65`, `83:29`, `104:1` |
| `slander-and-backbiting` | Slander & Backbiting | Spreading false accusations, gossiping, defamation. | `24:11`, `49:11`, `68:11`, `104:1` |
| `greed-and-miserliness` | Greed & Miserliness | Hoarding, refusing to spend in God's cause, love of wealth. | `3:180`, `47:38`, `92:8`, `102:1` |
| `sorcery` | Sorcery (Sihr) | Magic, witchcraft, sorcery accusations, or the practice and teaching of sihr. | `2:102`, `7:116`, `20:66`, `113:4` |
| `anger-and-violence` | Anger & Violence | Unjust killing, wrath-driven action, the sin of Cain. | `5:27`, `17:33` |
| `envy` | Envy (Hasad) | Resenting blessings God has given another; explicit refuge sought from it. | `4:54`, `113:5` |
| `corruption-on-earth` | Corruption on Earth | Causing fasād — moral, social, or material corruption. | `2:11`, `2:205`, `7:56`, `30:41` |
| `disbelief` | Disbelief (Kufr) | The state of denying truth after it has reached one. | `2:6`, `47:32`, `109:1` |

---

## 10. Eschatology (`eschatology`)

Afterlife, judgment, fate of past nations.

| id | Display | Definition | Examples |
|---|---|---|---|
| `day-of-judgment` | Day of Judgment | The Day described — its terror, its arrangement, the standing before God. | `22:1`, `39:67`, `75:1`, `82:1` |
| `paradise` | Paradise | Descriptions of Jannah — its rivers, gardens, companions, rewards. | `13:35`, `47:15`, `55:46`, `76:11` |
| `hell` | Hell | Descriptions of Jahannam — its punishments, its keepers, its inhabitants. | `40:71`, `56:41`, `74:26`, `88:1` |
| `resurrection` | Resurrection | The raising of the dead, the trumpet, the gathering. | `36:51`, `75:1`, `79:6` |
| `signs-of-the-hour` | Signs of the Hour | Cosmic signs preceding the Hour — sun darkened, mountains scattered. | `81:1`, `82:1`, `99:1` |
| `reckoning` | Reckoning | The handing of records, weighing of deeds, accounting. | `17:13`, `21:47`, `69:19`, `101:6` |
| `intercession` | Intercession | Who may intercede, who may not, on the Day. | `2:255`, `19:87`, `20:109` |
| `punishment-of-past-nations` | Punishment of Past Nations | The destruction of 'Ad, Thamud, Pharaoh's people, Lot's people as warning. | `7:65`, `11:50`, `54:18`, `89:6` |

---

## 11. Cosmology & Creation (`cosmology`)

How the world was made, what it signifies, the cycle of life and death.

| id | Display | Definition | Examples |
|---|---|---|---|
| `creation-of-heavens-earth` | Creation of Heavens & Earth | The making of the cosmos in six days; the throne. | `7:54`, `41:9`, `50:6` |
| `human-creation` | Creation of the Human | Stages of human creation — clay, sperm, clot, lump. | `22:5`, `23:12`, `40:67`, `96:1` |
| `natural-signs` | Natural Signs (Ayat) | Rain, plants, wind, animals, the tame earth, birds in flight — earthly natural phenomena framed as signs of the Creator. Co-tag with `cosmic-bodies` when both are present. | `16:10`, `30:46`, `67:19`, `78:6` |
| `cosmic-bodies` | Sun, Moon, Stars | Celestial bodies — sun, moon, stars, lamps of heaven, night, day — framed as signs or as adornment of the heavens. Distinct from `natural-signs` and freely co-tagged with it; both apply when both are present in the section. | `36:38`, `41:37`, `67:5`, `91:1` |
| `death-and-dying` | Death | The reality of death, the taking of the soul, what comes after. | `3:185`, `39:42`, `56:83` |
| `previous-creations-destroyed` | Past Civilizations | Generic ruins-and-warnings — "have they not traveled the land?" | `22:46`, `30:9` |

---

## 12. Revelation & Prophethood (`revelation`)

Sections about the Qur'an itself, prior books, and the office of prophethood.

| id | Display | Definition | Examples |
|---|---|---|---|
| `the-quran` | The Qur'an | Sections where the Qur'an is itself the subject — its origin, character, preservation. | `15:9`, `17:88`, `41:1`, `85:21` |
| `disjoined-letters` | Disjoined Letters *(Al-Muqattaʿāt, mysterious letters, abbreviated letters)* | Sections opening with the disjoined Arabic letters — Alif-Lām-Mīm, Ḥā-Mīm, Kāf-Hā-Yā-ʿAyn-Ṣād, Yā-Sīn, Ṭā-Hā, etc. Tag whenever the section begins with one of these openings, regardless of tafsir interpretation. | `2:1`, `19:1`, `20:1`, `36:1`, `41:1` |
| `qul-statements` | Qul Statements *(Say-commands, Commands to recite)* | Sections containing the rhetorical pattern `Qul…` ("Say…") — God commanding the Prophet (or, in some sections, the believers) to declare or recite a specific statement. Tag whenever the imperative `qul` appears. Use this **instead of** `muhammad` for the "Say:" pattern; `muhammad` is reserved for direct second-person address or sections substantively about him. | `1:1` (basmala once 1:1 is added), `67:23`, `67:28`, `67:30`, `109:1`, `112:1`, `113:1`, `114:1` |
| `previous-scriptures` | Previous Scriptures | Torah, Gospel, Psalms as subjects; their relationship to the Qur'an. | `3:3`, `5:44`, `5:46`, `87:18` |
| `prophethood-general` | Prophethood | Prophethood as a category — the sending of messengers, their common message. | `4:165`, `16:36`, `40:78` |
| `miracles` | Miracles | Miraculous signs given to prophets (Moses's staff, Jesus's healings, the splitting of the moon). | `7:107`, `20:17`, `54:1` |
| `challenge-to-produce` | Challenge to Produce Like | The Qur'anic challenge to produce a chapter or verse like it. | `2:23`, `10:38`, `17:88` |
| `denial-of-revelation` | Denial of Revelation | Accusations that the Qur'an is poetry, magic, or fabrication, and the responses. | `25:4`, `52:30`, `69:40` |

---

## 13. Counts (v0)

| Facet | Labels |
|---|---|
| people | 50 |
| divine-attributes | 12 |
| dua | 7 |
| worldly-matters | 20 |
| ethical-states | 10 |
| negative-attributes | 12 |
| eschatology | 8 |
| cosmology | 6 |
| revelation | 8 |
| **Total** | **133** |

People is the largest facet by design — generous tagging of named figures is a core retrieval use case ("show me every section that names Moses"). The 133 reflects four batches of additions on top of v0:

- **Maryam-pass additions:** `mankind`, `aaron`, `isaac`, `ishmael`, `jacob`, `idris`, `interest` (7 labels).
- **Full prophet batch:** `john` (split from `zechariah-and-john`, which was renamed to `zechariah`), `hud`, `salih`, `shuayb`, `elijah`, `elisha`, `dhul-kifl`, plus the punished-peoples split into `ad`, `thamud`, `madyan` (replacing the old `ad-thamud-madyan` collective).
- **Al-Baqarah additions:** `migration`, `intoxicants-and-gambling`, `sacred-mosque-and-qiblah`, `orphan-care`, `manumission-and-captives`, `covenant`, `sorcery` (7 labels).
- **Named-entity correction:** `family-of-imran`, `disciples`, `saul`, `goliath`, `patriarchs`, `sabeans`, `harut-and-marut` (7 labels).

---

## 14. What's missing on purpose (v0 scope cuts)

These were considered and deferred — listed here so we don't re-litigate them next session:

- **Per-99-Name labels.** Clustered into 12 attribute labels instead. Revisit if power-users actually want to filter by `as-sabur` vs. `al-halim`.
- **Hierarchies.** Flat within each facet. No parent/child until a real use case demands it.
- **Cross-references between facets.** No "see also" links yet — let the multi-label query do that work.
- **Sentiment polarity flag.** Considered tagging each label as positive/neutral/negative; the facet split already approximates this.
- **Asbab al-nuzul (occasions of revelation).** Distinct dataset; out of scope for thematic labeling.
- **Madani vs. Makki context flag.** Already derivable from surah metadata; doesn't need to be a label.

---

## 15. Next step

Hand-label **Surah Maryam (19)** against this taxonomy without LLM assistance. Every time a section forces an awkward label choice or demands a label that doesn't exist, **edit this file**. The output of that exercise is taxonomy v0.5 — the version we feed to the LLM for the Surah al-Baqarah pilot.
