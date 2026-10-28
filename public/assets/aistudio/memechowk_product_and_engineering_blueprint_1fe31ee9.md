# MemeChowk: Mobile-First Regional Meme, Audio & Creator Platform Blueprint (Nepal & India)

> **Document Purpose:** End-to-end product architecture, UI/UX specification, rights/moderation framework, full-stack technical blueprint, Linux developer setup guide, and business model analysis for coordinating a student engineering team.  
> **Working Title:** **MemeChowk** (*Chowk* = the bustling neighborhood courtyard/intersection in Nepal and India where people gather, share news, and joke). *Treat this name as a working placeholder pending trademark and domain availability verification in Nepal and India.*

---

## A. Executive Summary, Product Identity & Uniqueness

### 1. Product Vision & Concise Description
**MemeChowk** is a fast, mobile-first web application and Progressive Web App (PWA) designed for Nepali and Indian internet users to **discover, preview, upload, download, collect, and remix** regional meme templates, short video reactions, GIFs, dialogue audio clips, sound effects, and original creator packs.

Today, a video editor in Kathmandu or Delhi looking for a specific Nepali viral audio clip, a classic Hindi television reaction, or a clean high-resolution template has to scrub through YouTube videos, screen-record TikTok/Reels with watermarks overlaid, or dig through dead Telegram channels. MemeChowk solves this by combining **cross-script regional search** (matching Romanized Nepali/Hinglish like `"k ho yo"` or `"kya kar raha hai"` with Devanagari `"के हो यो"` / `"क्या कर रहा है"`), **low-data instant previews**, **transparent reuse permissions**, and **built-in browser remixing** (meme captioning and soundboard playback) in one lightweight destination.

### 2. Alternative Working Names (For Domain & Trademark Verification)
1. **MemeChowk (मिम चोक / मीम चौक):** Evokes the local public square of South Asian towns; works identically in Nepali and Hindi.
2. **ThahaMeme / ChautariClips (चौतारी क्लिप्स):** *Chautari* is the traditional stone resting platform under a banyan/peepal tree in Nepal where villagers trade stories and humor.
3. **GuffGaff / BakchodiBox:** Casual slang for banter, though **MemeChowk** is recommended as the primary candidate because it is brand-safe for college portfolios, sponsors, and mainstream creators across both Nepal and India.

### 3. Mission Statement
To give South Asian students, meme-makers, video editors, and everyday chatters a fast, low-data, and copyright-respecting library of regional humor—where any reaction image, video clip, or sound bite can be found in seconds in the language and script people actually type.

### 4. Target User Personas & Jobs-to-be-Done (JTBD)

| Persona | Typical Device & Connection | Core Frustration Today | How MemeChowk Serves Them |
| :--- | :--- | :--- | :--- |
| **1. Everyday Student / Group-Chat User** | Budget Android (NPR 15k–25k / INR 10k–15k), 4G data pack or shared Wi-Fi. | Wants to reply in Messenger, WhatsApp, or Discord with a specific Nepali/Hindi audio or reaction image but can't find it quickly. | 2-second search in Romanized Nepali/Hinglish → 1-tap audio play or lightweight WebP/MP4 download without logging in. |
| **2. Meme-Page Admin (Instagram / Facebook / Reddit)** | Mid-range Android or Laptop. | Templates found online have blurry JPEG compression or someone else's watermark plastered over them. | Curated **Blank Template** library + built-in **Image Meme Editor** supporting crisp Devanagari & Impact/Inter fonts with clean PNG/JPEG export. |
| **3. Short-Form Video Editor (Reels / YouTube Shorts / TikTok)** | Laptop (Linux/Windows/Mac) or CapCut/VN on phone. | Wastes 30 minutes downloading a 10-minute YouTube video just to extract a 3-second punchline audio or reaction cutaway. | Pre-trimmed 2–8 second MP4/WebM clips and normalized MP3/WAV audio bites showing exact duration, file size, and source context. |
| **4. Gaming Streamer (PUBG Mobile, FreeFire, Valorant)** | PC + secondary phone/tablet as a makeshift stream deck. | International soundboards (MyInstants) lack local Nepali/Hindi banter or play at wildly inconsistent volumes. | Dedicated **Soundboard Mode**: large touch pads, loudness-normalized audio, single-active-sound cutoff, and custom saved boards. |
| **5. Original Regional Creator / Voice Artist** | Smartphone + basic mic. | Their original skits/dialogues get ripped without credit or link-back. | Verified **Creator Packs** with embedded attribution links, clear permission badges, and remix lineage tracking. |

### 5. Explicit MVP Boundaries & Non-Goals
* **No Promise of Automatic Virality:** Software cannot manufacture humor; the platform succeeds only if discovery is faster and cleaner than scrubbing YouTube or Telegram.
* **No Unlicensed Scraping or Implied Endorsement:** Taxonomy categories like "CID-themed" or "Sacar-related" are examples of search intent—**never** an excuse to bulk-scrape copyrighted broadcasts or claim official endorsement. Demo and launch seeds must use original creations, public-domain works, or explicitly licensed creator submissions.
* **No Celebrity Voice Cloning or Generative Deepfakes:** "Voice" in MemeChowk strictly means user-uploaded voice recordings, original dialogue performances, and licensed audio clips.
* **No Autoplay Audio Noise:** Entering a page never blasts audio automatically; all audio requires an explicit user tap/click.
* **No Fake Conversion Buttons:** The UI never displays a "Download GIF" or "Download WAV" button unless that exact file variant has been generated, verified, and stored in object storage.

---

## B. Competitor Research, Positioning & Regional Differentiation

### 1. Reference Platform Analysis (Observed Features vs. Assumptions)

| Reference Platform | Observed Strengths (Factual) | Observed Limitations for Nepali & Indian Users (Factual) | Working Assumptions to Validate in Beta |
| :--- | :--- | :--- | :--- |
| **1. memes.co.in** | Popular repository of Indian/Hindi video and image meme templates; familiar to Indian Instagram reel editors. | Heavy ad clutter on mobile; weak or non-existent Nepali catalog; limited structured metadata (duration, license, normalized audio variants); weak cross-script alias search. | *Assumption:* Editors will switch to MemeChowk if downloads are 1-click without pop-up ad traps and include pre-extracted audio + video variants. |
| **2. myinstants.com** | Iconic, dead-simple colored-button soundboard UI; instant tap-to-play; huge global gaming sound effects catalog. | Almost no structured Nepali/Hindi transliteration search; inconsistent audio levels (some clips clip/distort loudly); no paired video/template context for the same meme. | *Assumption:* Streamers and students in Nepal/India want a soundboard tab built directly into the same platform where they get video/image memes. |
| **3. voicy.network** | Clean modern UI for sound clips with waveform previews and category tags. | Primarily Western/English catalog; requires heavy bandwidth for browsing; lacks an integrated image meme editor or blank template library. | *Assumption:* Lightweight JSON waveform peaks (rendered on HTML5 Canvas without downloading the full MP3) will feel faster on 4G mobile data. |
| **4. imgflip.com / memegenerator** | Fast canvas-based meme captioning; massive Western blank template database; easy text box dragging and outline controls. | Poor Devanagari font rendering defaults; Western-centric templates; no integrated regional audio/dialogue soundboard. | *Assumption:* Pre-loading readable Devanagari fonts (*Noto Sans Devanagari*, *Khand*, *Mukta*) alongside classic meme fonts will drive template remixing. |
| **5. giphy.com** | Industry-standard GIF/sticker CDN and search API; fast masonry grid. | Optimized for messaging keyboard stickers rather than downloadable video/audio editing assets with dialogue transcripts and clear reuse rights. | *Assumption:* Video editors prefer short MP4s (with audio) + separate MP3s over silent, large-file-size legacy GIFs. |

### 2. MemeChowk's 5 Pillars of Uniqueness
1. **Cross-Script & Phonetic Regional Search:** A user typing `"k ho yo"`, `"ke ho yo"`, or `"के हो यो"` (or Hinglish `"kya bawasir hai"` vs `"क्या बवासीर है"`) hits the exact same canonical asset via our `SearchAlias` dictionary and trigram index.
2. **Unified Multi-Modal Asset Families:** A single iconic moment can expose its **Video Clip (MP4)**, **Extracted Audio Bite (MP3)**, **Reaction GIF/WebP**, and **Blank Still Template (PNG)** on one page—saving creators from using three separate websites.
3. **Low-Cost Android & Low-Data Engineering:** Designed for a 360px screen on a budget Android phone: zero-autoplay, static poster frames until tapped, 64-bar JSON waveform previews (under 500 bytes), and a global **"Data Saver Mode"** toggle.
4. **Honest Rights & Attribution Ledger:** Instead of pretending every internet meme is public domain, every asset displays an explicit **Permission Basis Badge** (*Original Creator Upload*, *Creative Commons*, *Editorial/Personal Context Only — Unknown Commercial Rights*), protecting commercial editors from accidental copyright strikes.
5. **Nepal + India Cultural Bridge:** Treats Nepali internet culture (Nepali hip-hop/vlogs, local idioms, college/hostel life, Dashain/Tihar, local football/cricket reactions) as a first-class citizen alongside pan-Indian Hindi templates.

---

## C. Taxonomy, Content Strategy & Cross-Script Search Architecture

### 1. Multi-Dimensional Content Taxonomy
Instead of dumping assets into a single flat tag list, MemeChowk organizes content across **6 orthogonal facets** so users can combine filters (e.g., `Language: Nepali` + `Media: Audio` + `Emotion: Shocked` + `Reuse: Commercial OK`):

| Facet | Example Values | Purpose |
| :--- | :--- | :--- |
| **1. Language (`language`)** | `ne` (Nepali), `hi` (Hindi), `en` (English), `mai` (Maithili - Phase 3), `bho` (Bhojpuri - Phase 3), `non_verbal` (Laughs/SFX) | Powers the top navigation language/region selector. |
| **2. Region / Culture (`region`)** | `NP` (Nepal), `IN` (India), `SOUTH_ASIA` (Shared), `GLOBAL` | Lets Nepali users prioritize local memes on Home while still accessing popular Hindi templates. |
| **3. Media Type (`media_type`)** | `IMAGE_TEMPLATE`, `MEME_IMAGE`, `VIDEO_CLIP`, `GIF`, `AUDIO_DIALOGUE`, `SOUND_EFFECT`, `VOICE_RECORDING`, `CREATOR_PACK` | Drives card layout (waveform vs. video player vs. "Remix Template" button). |
| **4. Situational Category (`category`)** | `College & Exams`, `Friendship & Hostel`, `Family & Relatives`, `Gaming & Streams`, `Cricket & Football`, `Work & Coding`, `Celebrations & Festivals`, `Awkward Moments` | Powers browsable thematic collections on Home and Explore. |
| **5. Emotion / Reaction (`emotion`)** | `Laughing`, `Shocked / Confused`, `Crying / Sad`, `Angry / Roast`, `Sarcastic`, `Hyped / Victory`, `Disappointed` | Helps editors find a reaction when they don't know a specific dialogue phrase. |
| **6. Reuse Tier (`reuse_tier`)** | `CC0_PUBLIC_DOMAIN`, `CREATOR_AUTHORIZED_COMMERCIAL`, `CREATOR_NON_COMMERCIAL`, `PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS` | Enforces whether commercial download/pack inclusion is permitted. |

* **Policy on Pop-Culture & Public-Figure Taxonomy (e.g., CID-themed or Sacar-related queries):**  
  Users frequently search for iconic cultural references (`"daya darwaza tod do"`, `"sacar"`, `"kp oli"`, `"shark tank"`). In MemeChowk:
  1. Taxonomy tags and search aliases may include cultural topic slugs so search works naturally.
  2. However, **only assets with a valid, documented permission basis** (e.g., licensed creator parodies, original recreations, explicitly permitted clips, or user-recorded voice impressions clearly labeled as parody) are approved by moderators.
  3. **Seed/Demo Rule:** The repository seed script (`prisma/seed.ts`) must **never** include pirated TV clips or unconsented personal recordings; it must generate original SVG/PNG templates, synthesized/original voice recordings, and CC0 demo assets.

### 2. Cross-Script & Transliteration Search Architecture (MVP vs. Scale)

#### Why Regional Search Is Hard in Nepal & India
A Nepali user searching for *"के हो यो"* might type:
* Devanagari: `के हो यो`
* Standard Romanized: `ke ho yo`
* Chat shorthand: `k ho yo` or `k हो yo`
* English meaning: `what is this`

Similarly, a Hindi user might type `"क्या कर रहा है यार"`, `"kya kar raha hai yaar"`, or `"kya kr rha h yr"`.

#### Phase 1 Practical Database Search Architecture (PostgreSQL Native)
Before adding external search servers (like Elasticsearch or Meilisearch) that consume extra RAM and require sync pipelines, we implement a **3-Layer PostgreSQL Search Pipeline** using built-in extensions (`pg_trgm` and `unaccent`):

```text
[User Query: "k ho yo"]
         │
         ▼
1. Query Normalizer (TypeScript)
   - Lowercase, trim punctuation, collapse repeated vowels ("oo" -> "o", "aa" -> "a")
   - Generate normalized phonetic token: "k ho yo"
         │
         ▼
2. PostgreSQL Hybrid Search Query (Single Round-Trip)
   ├── Match A: Exact or Prefix match on `SearchAlias.normalized_alias` (Weight: 1.0)
   ├── Match B: Full-Text Search (`tsvector`) on `Asset.title`, `transcript_deva`, `transcript_roman` (Weight: 0.8)
   └── Match C: Trigram Similarity (`pg_trgm` `similarity() > 0.35`) for typos like "kya kr rha" (Weight: 0.5)
         │
         ▼
3. Composite Ranking Score
   Score = (TextMatchScore * 0.70) + (TimeDecayedPopularity * 0.20) + (FreshnessBoost * 0.10)
```

#### Editable Alias Dictionary (`SearchAlias` Table)
Every asset and tag can have multiple human-curated or moderator-approved aliases stored in PostgreSQL:

| Canonical Phrase (Devanagari) | `normalized_alias` Entries Stored in `SearchAlias` | English / Context Aliases |
| :--- | :--- | :--- |
| **के हो यो** | `ke ho yo`, `k ho yo`, `keho yo`, `के हो यो` | `what is this nepali`, `confused reaction` |
| **यस्तै छ जिन्दगी** | `yastai cha jindagi`, `yestai xa jindagi`, `yastai chha zindagi` | `such is life`, `sad nepali sigh` |
| **अरे भाई भाई भाई** | `arey bhai bhai bhai`, `are bhai bhai`, `अरे भाई` | `stop bro panic reaction` |
| **पैसा ही पैसा होगा** | `paisa hi paisa hoga`, `paisa hi paisa`, `पैसा ही पैसा` | `rich meme`, `money rain reaction` |

#### Honest Limitations of PostgreSQL Search & Trigger for Switching
* **Limitations of PostgreSQL `pg_trgm` + `tsvector`:**
  1. PostgreSQL's built-in `nepali` and `hindi` stemmers are minimal compared to English; morphological variations (e.g., *गरेको* vs *गर्नु*) rely on trigram overlap or explicit aliases.
  2. Once the catalog exceeds **100,000–250,000 assets** with 5+ concurrent facet filters (`language` + `emotion` + `duration` + `trigram`), `GIN` trigram scans can exceed 150ms.
* **Switching Trigger (Phase 2/3):** Only introduce **Typesense** or **Meilisearch** when P95 search latency exceeds 200ms or when total approved assets exceed 50,000.

#### Zero-Results Recovery Flow
When a query returns `0` results:
1. Log the normalized query into an aggregated `ZeroResultQuery` table (without storing user IP/PII) so admins can see what memes people are looking for!
2. Show top 3 fuzzy spelling suggestions or popular collections in the user's selected language.
3. Display a 1-field **"Request This Meme / Dialogue"** card (`POST /api/requests`) where the user can describe the clip or paste a reference link for creators/moderators to fulfill.

---

## D. User Experience, Sitemap & Mobile-First Design System

### 1. Visual Identity & Aesthetic Direction
* **Theme:** **"Late-Night Creator Studio meets South Asian Street Pop"**—dark charcoal surfaces that save battery on OLED Android screens and make colorful memes pop, paired with high-contrast marigold and coral accents.
* **Color Palette (WCAG AA/AAA Compliant):**
  * Background Primary: `#0F1115` (Deep Charcoal)
  * Card / Surface Elevated: `#181B22` (Slate Charcoal) with `#262B36` `1px` border
  * Primary Brand Accent: `#FFB800` (Marigold Yellow — dark text `#0F1115` on buttons for 10.4:1 contrast)
  * Secondary / Audio Accent: `#FF4D4D` (Electric Coral — used for active soundboard pads & recording states)
  * Verified / Safe Reuse Badge: `#10B981` (Emerald Green)
  * Warning / Unknown Rights Badge: `#F59E0B` (Amber)
  * Text Primary: `#F3F4F6` | Text Muted: `#9CA3AF`
* **Typography:**
  * UI & Latin Headings: `'Plus Jakarta Sans'` or `'Inter'` (`font-weight: 600/700`)
  * Devanagari UI & Transcripts: `'Noto Sans Devanagari'` or `'Mukta'` (specifically chosen because *Mukta* and *Noto Sans Devanagari* have generous vertical line-height so matras like `ी`, `ै`, `ु`, `ू` never get clipped on mobile buttons).
  * Meme Editor Fonts: `'Impact'`, `'Anton'`, `'Noto Sans Devanagari Bold'`, `'Khand Bold'`, and `'JetBrains Mono'` (for metadata badges like `0:04 • 142 KB • MP3`).

### 2. Low-Cost Android & Low-Bandwidth Engineering Rules
1. **360px Viewport First:** Every page is tested at `360x640px` (standard budget Redmi/Samsung/Realme viewport in Nepal & India). Touch targets are a minimum of **`48x48px`**.
2. **Zero Layout Shift (CLS = 0):** Every `Asset` stores `width` and `height` in the database so the grid renders an exact `aspect-ratio` skeleton box with a tiny CSS gradient/BlurHash placeholder before the image loads.
3. **Never Download Full Media on Grid Scroll:**
   * **Images/Templates:** Grid loads a `360px`-wide `WebP` thumbnail (`15–35 KB`), never the `2 MB` original PNG.
   * **Videos/GIFs:** Grid loads a static `WebP` poster frame (`20 KB`) with a duration badge (`0:05`). The compressed preview video (`360p MP4`, `~150 KB`) only streams when the user **taps** the card (or hovers on desktop when Data Saver is off).
   * **Audio/Soundboard:** Grid renders a 48-bar SVG waveform from a precomputed array of 48 integers stored directly in the JSON response (`0 bytes` of audio downloaded until the user taps Play!).
4. **Global "Data Saver Mode" (`कम डाटा मोड`):** A persistent toggle in the top header (and auto-enabled if `navigator.connection.saveData === true` or `effectiveType === '2g' | 'slow-2g'`). In Data Saver Mode, video previews never prebuffer, thumbnails use low-quality WebP, and infinite scroll switches to an explicit `"Load 12 More"` button.

### 3. Application Sitemap & Navigation Architecture

```text
[Mobile Bottom Navigation Bar (4 Primary Tabs)]
├── 🏠 Home (/)                  -> Search Bar, Language Toggle (NE/HI/EN), Trending, Soundboard Strip, New Uploads
├── 🔍 Explore (/explore)        -> Filterable Multi-Facet Media Grid + Shareable URL Query Params
├── ➕ Upload (/upload)          -> Authenticated Upload Wizard OR Quick Jump to Image Meme Editor (/editor)
└── 🔖 Saved (/saved)            -> Personal Favorites, Custom Soundboards & Collections

[Full Application Routes]
├── /                            (Home)
├── /explore                     (Search & Filter Grid: ?q=k+ho+yo&lang=ne&type=AUDIO_DIALOGUE&reuse=COMMERCIAL)
├── /soundboard                  (Dedicated Tap-to-Play Soundboard Grid with Instant Cutoff)
├── /a/[slug]                    (Permanent Asset Detail Page: Preview, Transcript, Rights, Variants, Remix)
├── /c/[slug]                    (Curated or User Collection Page: e.g., /c/nepali-hostel-reactions)
├── /editor                      (HTML5 Canvas Image Meme Generator: ?templateId=...)
├── /upload                      (Multi-step Upload + Rights Declaration + Live Processing Tracker)
├── /u/[username]                (Creator Profile, Uploaded Packs & Attribution Portfolio)
├── /saved                       (Saved Items & Custom Collections)
├── /admin/moderation            (RBAC Admin Queue: Quarantine Review, Rights Verification, Takedowns, Aliases)
└── /legal/[page]                (/legal/terms, /legal/privacy, /legal/copyright-takedown, /legal/help)
```

### 4. Detailed Wireframes & Specifications for All 9 MVP Pages

#### Page 1: Home (`/`) & Page 2: Explore (`/explore`) — 360px Mobile View
```text
+------------------------------------------+
| मिमचोक MemeChowk   [⚡ Data Saver] [NE|HI]|
+------------------------------------------+
| 🔍 Search "k ho yo", "के हो यो", "bhai"...|
| [All] [🔊 Audio] [🎬 Video] [🖼️ Blank]   |
+------------------------------------------+
| 🔥 TRENDING COLLECTIONS                  |
| ┌──────────────────┐ ┌──────────────────┐|
| │ 🇳🇵 Nepali Reacts │ │ 🎓 Exam Survival │|
| │ 42 clips         │ │ 28 templates     │|
| └──────────────────┘ └──────────────────┘|
+------------------------------------------+
| ⚡ INSTANT SOUNDBOARD (Tap to Play)       |
| [▶️ के हो यो (0:02)] [▶️ अरे भाई (0:03)]  |
+------------------------------------------+
| 🆕 VERIFIED UPLOADS        [Filter ⚙️ (2)]|
| +------------------+ +------------------+|
| | [Poster Frame]   | |  ▄▆█▃▅▇▂▄▆█▃▅   ||
| |                  | |   [ ▶️ 0:03 ]    ||
| | 🎬 0:04 • 310 KB | | 🔊 MP3 • 48 KB   ||
| +------------------+ +------------------+|
| | Hostel Dal Bhat  | | "K Ho Yo Bhai!"  ||
| | 🇳🇵 NE • ✅ CC-BY | | 🇳🇵 NE • ⚠️ Pers. ||
| | [⬇️] [✂️] [🔖]   | | [⬇️] [🔗] [🔖]   ||
| +------------------+ +------------------+|
+------------------------------------------+
|  🏠 Home   🔍 Explore  ➕ Create  🔖 Saved|
+------------------------------------------+
```

#### Page 3: Asset Detail (`/a/[slug]`)
* **Purpose:** Permanent shareable destination for a single meme asset.
* **Key Elements:**
  1. **Media Player:** Video player (paused with poster frame), interactive audio waveform player, or high-res image viewer.
  2. **Bilingual Dialogue & Transcript Box:** Shows exact spoken dialogue in **Devanagari** (`"के हो यो भाई, यस्तो पनि हुन्छ र?"`), **Romanized** (`"Ke ho yo bhai, yasto pani huncha ra?"`), and **English context** (`"Used when reacting to an absurd exam question or unexpected plot twist"`).
  3. **Metadata & Rights Card:** Format, duration (`0:03.4`), dimensions (`1080x1080`), file size, uploader link, source attribution, and an explicit **Reuse Permission Pill** (e.g., `✅ Creator Authorized for Commercial & Editorial Use` or `⚠️ Personal/Social Meme Only — Unknown Third-Party Broadcast Rights`).
  4. **Verified Download Matrix:** Buttons *only* for variants where `AssetVariant.status === 'READY'` (e.g., `Download MP4 (720p • 620 KB)`, `Download Audio MP3 (128kbps • 54 KB)`).
  5. **Action Bar:** `[🎨 Open in Meme Editor]` (if image/template), `[🔖 Save to Collection]`, `[🔗 Share Link]`, and `[🚩 Report / Claim Rights]`.

#### Page 4: Soundboard (`/soundboard`)
* **Purpose:** Ultra-responsive grid of audio pads for streamers, Discord voice chats, and classroom/hostel banter.
* **Single-Active-Audio Controller Logic:** Managed by a singleton `AudioController` hook in React. Tapping Pad B **immediately pauses and resets (`currentTime = 0`) Pad A** before playing Pad B, preventing chaotic overlapping noise. Includes a sticky `[⏹️ STOP ALL AUDIO]` button (bound to `Escape` / `Space` on desktop keyboards).

#### Page 5: Upload (`/upload`)
* **Purpose:** Authenticated 3-step wizard for submitting templates, clips, audio, or voice recordings.
* **Step 1 (File Selection & Client Pre-Check):** Drag-and-drop or mobile file picker (or in-browser microphone recorder for original voice clips up to 15 seconds). Validates MIME type and size before requesting a presigned upload URL.
* **Step 2 (Regional Metadata & Search Aliases):** Title, language (`NE`/`HI`/`EN`), media type, Devanagari + Romanized transcript/keywords, emotion tags.
* **Step 3 (Mandatory Rights & Permission Declaration):** Uploader must select **how they obtained the media**:
  * Option A: *"I created/recorded this original content myself"* (eligible for Creator Commercial / CC licensing after moderator check).
  * Option B: *"I have written permission or a Creative Commons license from the creator"* (requires source URL/evidence note).
  * Option C: *"Short reaction/commentary clip from third-party media (Unknown commercial rights)"* → **System hard-locks `commercial_eligible = false` and marks status `PERSONAL_MEME_ONLY`**, regardless of any checkbox!

#### Page 6: Image Meme Editor (`/editor`)
* **Purpose:** Zero-install HTML5 Canvas meme generator optimized for Devanagari and Latin text.
* **Features:**
  * Load any approved blank template (`/editor?templateId=xyz`) or upload a local image from phone gallery (processed 100% client-side if not publishing).
  * Add/drag/resize multiple text layers (Top text, Bottom text, or free-floating dialogue labels).
  * Font selector with preloaded web fonts (`Noto Sans Devanagari Bold`, `Mukta ExtraBold`, `Impact`, `Inter Black`), text color picker, stroke/outline width slider, background highlight box toggle (popular in Indian/Nepali Instagram memes), and alignment controls.
  * Export crisp **PNG** or **JPEG** (`canvas.toBlob()`) directly to device, or click `"Submit Remix to MemeChowk"` (automatically links `parent_asset_id` for remix attribution!).

#### Pages 7, 8 & 9: Profile/Saved (`/saved`, `/u/[username]`), Admin Moderation (`/admin/moderation`), and Legal/Rights Pages (`/legal/*`)
* **Saved & Collections:** Logged-in users organize favorites into named collections (e.g., `"My Stream Soundboard"`, `"Dashain Templates"`), toggle public/private visibility, and share collection links.
* **Admin Moderation Dashboard:** Keyboard-driven review queue (`A` = Approve, `R` = Reject with reason, `E` = Edit aliases/rights tier) showing quarantine media preview, FFmpeg probe metadata, duplicate hash warnings, and open copyright/abuse reports.
* **Legal & Rights Reporting (`/legal/copyright-takedown`):** Structured takedown and abuse reporting form supporting copyright infringement, privacy/non-consensual imagery, harassment, and impersonation.

---

## E. Media Pipeline — Uploads, Validation, Quarantine, FFmpeg & Downloads

### 1. Strict Format Allowlist & Resource Boundaries

| Media Category | Allowed Input Extensions & Magic Bytes | Max File Size | Duration / Dimension Limits | Generated Output Variants (`AssetVariant`) |
| :--- | :--- | :--- | :--- | :--- |
| **Images & Blank Templates** | `image/jpeg`, `image/png`, `image/webp` | `10 MB` | Min `200x200px`, Max `4096x4096px` | 1. `THUMB_WEBP` (`360px` wide, q=78)<br>2. `DISPLAY_WEBP` (`1080px` max)<br>3. `ORIGINAL_CLEAN` (EXIF stripped PNG/JPG) |
| **Short Video Reactions** | `video/mp4` (H.264/AAC), `video/webm` | `25 MB` | Min `0.5s`, **Max `15.0s`**, Max `1920x1920px` | 1. `POSTER_WEBP` (frame at `0.5s`)<br>2. `PREVIEW_MP4_360P` (faststart, ~400 kbps)<br>3. `DOWNLOAD_MP4_720P` (H.264/AAC)<br>4. `EXTRACTED_AUDIO_MP3` (if audio track exists) |
| **Animated GIFs** | `image/gif` | `15 MB` | Max `10.0s`, Max `1000x1000px` | 1. `POSTER_WEBP`<br>2. `LOOP_MP4` (80% smaller than GIF for fast web playback)<br>3. `OPTIMIZED_GIF` |
| **Audio, Dialogues & SFX** | `audio/mpeg` (MP3), `audio/wav`, `audio/ogg`, `audio/mp4` (M4A) | `10 MB` | Min `0.3s`, **Max `20.0s`** | 1. `WAVEFORM_JSON` (48 normalized peak ints)<br>2. `NORMALIZED_MP3` (128 kbps, `-16 LUFS`)<br>3. `PREVIEW_OGG_OPUS` (48 kbps for low-data) |

### 2. End-to-End Upload, Quarantine & Processing Architecture

```text
[User Browser]
   │ 1. POST /api/uploads/init (filename, size, mime, sha256)
   │    -> Server checks Auth, Rate Limit (10/hr), User Quota, & SHA-256 Duplicate Index
   ▼
[Next.js API] ──► Issues 5-min Presigned PUT URL to `memechowk-quarantine` bucket
   │
   │ 2. Browser uploads bytes directly to MinIO/S3 `memechowk-quarantine` (NOT public!)
   ▼
[Browser calls POST /api/uploads/:assetId/complete]
   │ 3. Server creates `ProcessingJob` in PostgreSQL and enqueues BullMQ job in Redis
   ▼
[Sandboxed Media Worker (Node.js + FFmpeg + Sharp)]
   ├── Step A: Stream first 4100 bytes from quarantine -> verify real Magic Bytes (`file-type`)
   ├── Step B: Run `ffprobe` / `sharp.metadata()` -> reject if duration > 15s, resolution > 4096px, or zip/polyglot bomb
   ├── Step C: Compute perceptual hash (`dHash`) for images/poster frames -> flag near-duplicates for moderator
   ├── Step D: Strip all EXIF/GPS/camera metadata (`-map_metadata -1`)
   ├── Step E: Generate normalized variants (WebP thumb, 360p MP4, -16 LUFS MP3, 48-point waveform JSON)
   ├── Step F: Write variants to private `memechowk-staging` bucket & create `AssetVariant` rows (`status = READY`)
   └── Step G: Set `Asset.status = PENDING_MODERATION` (Still invisible to public!)
   │
   ▼
[Admin Moderator Reviews in `/admin/moderation`]
   ├── If APPROVED: Copies/promotes approved variants to public-read (or signed CDN) delivery path; `status = APPROVED_PUBLIC`
   └── If REJECTED: Deletes staging/quarantine objects; records reason in `ModerationAction`
```

### 3. Sandboxed FFmpeg Execution & Resource Limits
Processing user-uploaded media is a classic security vector (malformed MP4/GIF exploits or CPU exhaustion). The background worker enforces:
1. **No Shell Interpolation:** Always spawn `child_process.execFile('ffmpeg', [...args])` with an array of arguments—never `exec()` with string concatenation.
2. **Protocol Whitelisting & Network Isolation:** Pass `-protocol_whitelist file,pipe` to `ffmpeg` and `ffprobe` so a malicious HLS/M3U8 playlist disguised as a video cannot trigger Server-Side Request Forgery (SSRF) against local LAN services.
3. **Hard Timeout & Thread Limits:** Every FFmpeg job runs with `-threads 2`, a hard `30,000 ms` kill timeout (`AbortSignal.timeout(30000)`), and Docker container memory limits (`mem_limit: 1g`, `cpus: 1.5`).
4. **Audio Normalization Command (EBU R128):**
   ```bash
   ffmpeg -nostdin -y -protocol_whitelist file,pipe -i input.mp3 \
     -map_metadata -1 -vn -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
     -ar 44100 -ac 2 -b:a 128k output_normalized.mp3
   ```

### 4. Download Integrity, Headers & Rate Limiting
When a user clicks download on `/a/[slug]`:
* The request hits `GET /api/assets/:assetId/download?variantId=xyz`.
* The server verifies:
  1. `Asset.moderation_status === 'APPROVED_PUBLIC'` (if `TAKEDOWN_REMOVED` or `PENDING_MODERATION`, returns `404 Not Found` immediately).
  2. `AssetVariant` exists for that `assetId` and `status === 'READY'`.
  3. Rate limit check passes (e.g., max **30 downloads / 10 minutes per IP** for anonymous users; **120 / 10 minutes** for logged-in users).
* The server increments the deduplicated download counter and issues a short-lived (`60-second`) signed redirect (or streams with headers):
  * `Content-Type: video/mp4` (or `audio/mpeg`, `image/png`)
  * `Content-Disposition: attachment; filename="memechowk-k-ho-yo-audio.mp3"`
  * `X-Content-Type-Options: nosniff`
  * `Cache-Control: private, max-age=60` (so a subsequent takedown is respected within 60 seconds).

---

## F. Rights, Licensing, Moderation & Community Controls

### 1. Enforceable Rights & Commercial Eligibility Matrix
An uploader checking a box must **never** automatically mark a third-party TV clip or celebrity voice as commercially licensed. The server enforces a strict state table in `RightsRecord`:

| Uploader Declaration (`source_declaration`) | Moderator Verification (`moderator_verified_rights`) | Resulting `reuse_tier` | Eligible for Commercial Download / Pro Packs? | Public UI Badge Displayed |
| :--- | :--- | :--- | :--- | :--- |
| `ORIGINAL_CREATION` | Verified original / creator account | `CREATOR_AUTHORIZED_COMMERCIAL` or `CC_BY_4_0` | **Yes** | `🟢 Original Creator • Commercial & Remix OK (With Credit)` |
| `LICENSED_OR_PUBLIC_DOMAIN` | Moderator verified source URL / CC0 proof | `CC0_PUBLIC_DOMAIN` or `CC_BY_4_0` | **Yes** | `🟢 Verified License • Free to Reuse` |
| `ORIGINAL_CREATION` | Unverified new user (default until checked) | `CREATOR_NON_COMMERCIAL` | **No** (Standard personal/social use only) | `🔵 Community Upload • Personal & Social Share OK` |
| `THIRD_PARTY_REACTION_CONTEXT` | Confirmed short commentary/reaction clip | `PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS` | **No (Hard-Blocked in Code)** | `🟡 Unknown Third-Party Rights • Editorial/Personal Context Only` |
| Any declaration | Flagged as infringing / non-consensual / private person | `PROHIBITED` | **Rejected / Removed** | *Not published* |

### 2. Community Safety, Reporting & Takedown Workflow
To protect everyday citizens—especially students and young people in Nepal and India whose private photos or voice notes might be uploaded without consent as "memes"—MemeChowk enforces a strict **Dignity & Safety Policy**:
1. **Zero Tolerance for Private Individuals / Non-Consensual Content:** Memes mocking private citizens (e.g., a classmate's leaked phone call, a non-public person filmed without consent, doxxing phone numbers, or harassment) are rejected in quarantine or immediately purged upon report.
2. **1-Click Reporting (`/api/reports`):** Any visitor (even without an account) can report an asset for:
   * `COPYRIGHT_OR_UNCREDITED_CREATOR`
   * `PRIVATE_PERSON_OR_NON_CONSENSUAL`
   * `HARASSMENT_OR_HATE_SPEECH`
   * `NSFW_OR_VIOLENCE`
3. **Auto-Quarantine Threshold:** If an asset receives $\ge 3$ distinct reports for `PRIVATE_PERSON_OR_NON_CONSENSUAL`, the system automatically transitions `Asset.moderation_status` to `UNDER_EMERGENCY_REVIEW`, hiding it from public pages and disabling downloads until an admin reviews it.
4. **Hard Takedown Execution:** When an admin executes a `TAKEDOWN_REMOVED` action:
   * `Asset.moderation_status` is set to `TAKEDOWN_REMOVED`.
   * All associated object files in the public/staging bucket are **deleted or moved back to the locked evidence vault**.
   * Download endpoints immediately return `HTTP 410 Gone`.
   * An immutable `ModerationAction` audit row records the admin ID, timestamp, legal/policy reason, and reporter reference.
   * Repeat-offender uploaders (`strike_count >= 3`) have their upload privileges automatically revoked.

---

## G. Technical Architecture, Stack Verification & Simpler Alternatives

### 1. Recommended Stack & Version Compatibility Matrix
*(All versions below are verified stable, long-term supported releases suitable for Ubuntu/Debian/Arch/Fedora Linux development in 2026.)*

| Layer | Technology & Pinned Version | Role in MemeChowk | Simpler Alternative (To Reduce Maintenance) |
| :--- | :--- | :--- | :--- |
| **Runtime** | **Node.js `22.x LTS`** | Executes Next.js server and background media worker. | Keep Node 22 LTS across all containers. |
| **Web Framework & API** | **Next.js `15.x`** (App Router) + **React `19.x`** + **TypeScript `5.7+`** | Unified frontend UI, SSR SEO pages for `/a/[slug]`, and REST/Server Action endpoints. | Single repo handles UI, API, and Admin—no separate backend repo to sync. |
| **Styling & UI** | **Tailwind CSS `3.4+` or `4.x`** + **Lucide Icons** | Mobile-first dark UI, responsive grids, accessible focus states. | Plain Tailwind utility classes without heavy component libraries. |
| **Database & ORM** | **PostgreSQL `16-alpine`** + **Prisma ORM `6.x`** | Relational data, ACID transactions, `pg_trgm` + `tsvector` regional search. | Prisma provides type-safe queries and simple `prisma migrate dev` migrations. |
| **Authentication** | **Better Auth `1.x`** or **Auth.js (NextAuth v5)** | Email/password + Google OAuth sessions stored in PostgreSQL; role enforcement (`USER`, `CREATOR`, `MODERATOR`, `ADMIN`). | Database-backed HTTP-only session cookies allow instant server-side ban/revocation. |
| **Object Storage** | **MinIO** (Local Docker) → **Cloudflare R2** (Production) | S3-compatible buckets (`quarantine` and `public-media`) via `@aws-sdk/client-s3`. | **Why Cloudflare R2 in Prod:** Zero egress bandwidth fees (`$0/GB` download bandwidth), which saves a meme site from bankruptcy during traffic spikes! |
| **Job Queue & Rate Limit** | **Redis `7-alpine`** + **BullMQ `5.x`** | Queues FFmpeg/Sharp media jobs and tracks sliding-window IP download rate limits. | **Simpler Alternative:** Use **`pg-boss`** (runs job queues directly inside your existing PostgreSQL database) if you want 1 fewer container on a 1GB RAM VPS. |
| **Media Processing** | **Sharp `0.33+`** (Images) + **FFmpeg `6.x/7.x`** (Audio/Video) | Generates WebP thumbnails, strips EXIF, normalizes audio, extracts waveforms. | Run the worker inside the same repo (`npm run worker`) sharing Prisma models. |

### 2. High-Level System Architecture Diagram

```text
+-------------------------------------------------------------------------+
|                    CLIENT DEVICES (360px Android / Desktop)             |
|   [Public Browse & Search]  [Soundboard Player]  [Canvas Meme Editor]   |
+-------------------+-----------------------------------+-----------------+
                    │ HTTPS                             │ Presigned PUT / Signed GET
                    ▼                                   ▼
+-----------------------------------+   +---------------------------------+
|   Next.js App Server (TypeScript) |   | S3 Object Storage (MinIO / R2)  |
|  - SSR Public Asset Pages (SEO)   |   |  🔒 Bucket 1: `mc-quarantine`   |
|  - Search Normalizer (NE/HI/EN)   |   |     (Private, Raw Uploads)      |
|  - Auth & RBAC Middleware         |   |  🌐 Bucket 2: `mc-public`       |
|  - Download Gate & Rate Limiter   |   |     (Approved Variants Only)    |
+-----------------+-----------------+   +----------------+----------------+
                  │                                      ▲
      ┌───────────┴───────────┐                          │ Read Raw / Write Variants
      ▼                       ▼                          │
+--------------------+  +--------------------+  +--------+----------------+
| PostgreSQL 16 DB   |  | Redis 7            |  | Media Worker Process    |
| - Prisma Models    |  | - BullMQ Job Queue |─►| - Magic-byte Validator  |
| - `pg_trgm` Index  |  | - IP Rate Limits   |  | - Sharp (WebP, dHash)   |
| - `SearchAlias`    |  | - Dedup View Cache |  | - FFmpeg (MP4, -16 LUFS)|
+--------------------+  +--------------------+  +-------------------------+
```

---

## H. Complete Database Schema (Prisma) & API Specification

### 1. Complete Production-Ready `prisma/schema.prisma`
This schema covers all 14 required domain entities (`User`, `Asset`, `AssetVariant`, `Tag`, `AssetTag`, `SearchAlias`, `Collection`, `CollectionItem`, `Favorite`, `Report`, `ModerationAction`, `RightsRecord`, `ProcessingJob`, `DailyAssetMetric`, and `MemeRequest`):

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pg_trgm, unaccent]
}

enum UserRole {
  USER
  CREATOR
  MODERATOR
  ADMIN
}

enum MediaType {
  IMAGE_TEMPLATE
  MEME_IMAGE
  VIDEO_CLIP
  GIF
  AUDIO_DIALOGUE
  SOUND_EFFECT
  VOICE_RECORDING
  CREATOR_PACK
}

enum LanguageCode {
  NE          // Nepali
  HI          // Hindi
  EN          // English
  NON_VERBAL  // SFX / Laughs / Music
}

enum RegionCode {
  NP          // Nepal
  IN          // India
  SOUTH_ASIA  // Shared Nepal + India
  GLOBAL
}

enum ModerationStatus {
  UPLOADED_QUARANTINE
  PROCESSING
  PROCESSING_FAILED
  PENDING_REVIEW
  UNDER_EMERGENCY_REVIEW
  APPROVED_PUBLIC
  REJECTED
  TAKEDOWN_REMOVED
}

enum VariantKind {
  THUMB_WEBP
  DISPLAY_WEBP
  ORIGINAL_CLEAN
  POSTER_WEBP
  PREVIEW_MP4_360P
  DOWNLOAD_MP4_720P
  LOOP_MP4
  OPTIMIZED_GIF
  NORMALIZED_MP3
  PREVIEW_OGG_OPUS
}

enum SourceDeclaration {
  ORIGINAL_CREATION
  LICENSED_OR_PUBLIC_DOMAIN
  THIRD_PARTY_REACTION_CONTEXT
}

enum ReuseTier {
  CC0_PUBLIC_DOMAIN
  CC_BY_4_0
  CREATOR_AUTHORIZED_COMMERCIAL
  CREATOR_NON_COMMERCIAL
  PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS
  PROHIBITED
}

model User {
  id                String             @id @default(cuid())
  email             String             @unique
  username          String             @unique
  displayName       String
  passwordHash      String?
  role              UserRole           @default(USER)
  isBanned          Boolean            @default(false)
  strikeCount       Int                @default(0)
  uploadQuotaBytes  BigInt             @default(262144000) // 250 MB default quota
  usedQuotaBytes    BigInt             @default(0)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  assets            Asset[]            @relation("UploadedAssets")
  collections       Collection[]
  favorites         Favorite[]
  reportsSubmitted  Report[]           @relation("Reporter")
  moderationActions ModerationAction[] @relation("ModeratorActor")
}

model Asset {
  id                  String            @id @default(cuid())
  slug                String            @unique
  title               String
  mediaType           MediaType
  language            LanguageCode      @default(NE)
  region              RegionCode        @default(NP)
  emotion             String?           // e.g., "Shocked", "Laughing", "Sarcastic"
  transcriptDeva      String?           // e.g., "के हो यो भाई"
  transcriptRoman     String?           // e.g., "ke ho yo bhai"
  EnglishContextNote  String?           // e.g., "Confused reaction when seeing exam paper"
  
  // Technical Metadata (Populated by Worker, never trusted from client)
  originalMimeType    String
  originalSizeBytes   Int
  width               Int?
  height              Int?
  durationMs          Int?
  waveformPeaksJson   String?           // JSON array of 48 ints [0..100] for instant audio UI
  sha256Hash          String            @unique
  perceptualHash      String?           // 64-bit dHash hex for near-duplicate detection
  quarantineObjectKey String

  // Lineage & Remixing
  uploaderId          String
  uploader            User              @relation("UploadedAssets", fields: [uploaderId], references: [id])
  parentAssetId       String?
  parentAsset         Asset?            @relation("AssetRemixes", fields: [parentAssetId], references: [id])
  remixes             Asset[]           @relation("AssetRemixes")

  // Moderation & Visibility
  moderationStatus    ModerationStatus  @default(UPLOADED_QUARANTINE)
  rejectionReason     String?
  publishedAt         DateTime?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  // Denormalized Engagement Counters (Updated by worker from deduplicated events)
  viewCount           Int               @default(0)
  downloadCount       Int               @default(0)
  likeCount           Int               @default(0)
  trendingScore       Float             @default(0.0)

  variants            AssetVariant[]
  rightsRecord        RightsRecord?
  processingJobs      ProcessingJob[]
  tags                AssetTag[]
  searchAliases       SearchAlias[]
  favorites           Favorite[]
  collectionItems     CollectionItem[]
  reports             Report[]
  moderationHistory   ModerationAction[]
  dailyMetrics        DailyAssetMetric[]

  @@index([moderationStatus, language, mediaType, publishedAt(sort: Desc)])
  @@index([moderationStatus, trendingScore(sort: Desc)])
  @@index([perceptualHash])
}

model AssetVariant {
  id          String      @id @default(cuid())
  assetId     String
  asset       Asset       @relation(fields: [assetId], references: [id], onDelete: Cascade)
  kind        VariantKind
  bucketName  String
  objectKey   String
  mimeType    String
  sizeBytes   Int
  width       Int?
  height      Int?
  durationMs  Int?
  isReady     Boolean     @default(false)
  createdAt   DateTime    @default(now())

  @@unique([assetId, kind])
}

model RightsRecord {
  id                      String            @id @default(cuid())
  assetId                 String            @unique
  asset                   Asset             @relation(fields: [assetId], references: [id], onDelete: Cascade)
  sourceDeclaration       SourceDeclaration
  sourceUrl               String?
  creatorAttributionName  String?
  creatorAttributionUrl   String?
  attributionRequired     Boolean           @default(true)
  moderatorVerifiedRights Boolean           @default(false)
  reuseTier               ReuseTier         @default(PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS)
  commercialEligible      Boolean           @default(false) // Server-enforced rule!
  notes                   String?
  updatedAt               DateTime          @updatedAt
}

model Tag {
  id          String     @id @default(cuid())
  slug        String     @unique
  nameEn      String
  nameNe      String?
  nameHi      String?
  category    String     // e.g., "SITUATION", "EMOTION", "TOPIC"
  assets      AssetTag[]
}

model AssetTag {
  assetId String
  tagId   String
  asset   Asset  @relation(fields: [assetId], references: [id], onDelete: Cascade)
  tag     Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([assetId, tagId])
}

model SearchAlias {
  id              String   @id @default(cuid())
  assetId         String
  asset           Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  rawAlias        String   // e.g., "k ho yo", "के हो यो", "keho yo"
  normalizedAlias String   // lowercase, trimmed phonetic key
  scriptType      String   // "LATIN", "DEVANAGARI"
  isCurated       Boolean  @default(false)

  @@index([normalizedAlias])
  @@index([assetId])
}

model Collection {
  id          String           @id @default(cuid())
  slug        String           @unique
  title       String
  description String?
  language    LanguageCode     @default(NE)
  ownerId     String
  owner       User             @relation(fields: [ownerId], references: [id])
  isPublic    Boolean          @default(true)
  isFeatured  Boolean          @default(false)
  isSponsored Boolean          @default(false)
  sponsorName String?
  createdAt   DateTime         @default(now())
  items       CollectionItem[]
}

model CollectionItem {
  id           String     @id @default(cuid())
  collectionId String
  assetId      String
  sortOrder    Int        @default(0)
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  asset        Asset      @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([collectionId, assetId])
}

model Favorite {
  userId    String
  assetId   String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  asset     Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@id([userId, assetId])
}

model ProcessingJob {
  id           String   @id @default(cuid())
  assetId      String
  asset        Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  jobType      String   // "VALIDATE_AND_TRANSCODE"
  status       String   // "QUEUED", "ACTIVE", "COMPLETED", "FAILED"
  attempts     Int      @default(0)
  errorMessage String?
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime @default(now())
}

model Report {
  id             String   @id @default(cuid())
  assetId        String
  asset          Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  reporterId     String?
  reporter       User?    @relation("Reporter", fields: [reporterId], references: [id])
  reporterEmail  String?  // For anonymous copyright/privacy claimants
  reasonCategory String   // "COPYRIGHT", "PRIVATE_PERSON", "HARASSMENT", "NSFW"
  details        String
  status         String   @default("OPEN") // "OPEN", "RESOLVED_REMOVED", "RESOLVED_DISMISSED"
  createdAt      DateTime @default(now())
}

model ModerationAction {
  id          String   @id @default(cuid())
  assetId     String
  asset       Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  moderatorId String
  moderator   User     @relation("ModeratorActor", fields: [moderatorId], references: [id])
  actionType  String   // "APPROVE", "REJECT", "TAKEDOWN", "EDIT_RIGHTS", "EMERGENCY_LOCK"
  reason      String
  createdAt   DateTime @default(now())
}

model DailyAssetMetric {
  id              String   @id @default(cuid())
  assetId         String
  asset           Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  date            DateTime @db.Date
  previews        Int      @default(0)
  downloads       Int      @default(0)
  editorOpens     Int      @default(0)
  copyLinkClicks  Int      @default(0)
  bandwidthBytes  BigInt   @default(0)

  @@unique([assetId, date])
}

model MemeRequest {
  id              String       @id @default(cuid())
  queryText       String
  language        LanguageCode @default(NE)
  description     String?
  referenceUrl    String?
  upvotes         Int          @default(1)
  status          String       @default("OPEN") // "OPEN", "FULFILLED"
  createdAt       DateTime     @default(now())
}
```

### 2. Core API Endpoints & Access Control Matrix

| Endpoint | Method | Auth / Role | Purpose & Server-Side Enforcement |
| :--- | :--- | :--- | :--- |
| `/api/search` | `GET` | Public | Executes normalized alias + `tsvector` + `pg_trgm` query. **Hard filter:** `WHERE moderationStatus = 'APPROVED_PUBLIC'`. |
| `/api/assets/:slug` | `GET` | Public (or Owner/Admin) | Returns asset detail, ready variants, transcript, and rights badge. Returns `404` if not `APPROVED_PUBLIC` unless requester is the uploader or `MODERATOR`/`ADMIN`. |
| `/api/assets/:id/download` | `GET` | Public (Rate-Limited) | Verifies `APPROVED_PUBLIC` and `variant.isReady == true`, checks Redis IP rate limit, logs `DailyAssetMetric.downloads`, returns 60s signed S3 download URL with `Content-Disposition: attachment`. |
| `/api/uploads/init` | `POST` | Authenticated (`!isBanned`) | Validates quota, MIME allowlist, and SHA-256 uniqueness; creates `Asset` in `UPLOADED_QUARANTINE` + `RightsRecord`; returns presigned PUT URL to `mc-quarantine`. |
| `/api/uploads/:id/complete` | `POST` | Owner Only | Verifies object exists in `mc-quarantine`, enqueues BullMQ job `VALIDATE_AND_TRANSCODE`. |
| `/api/collections` | `POST/PATCH` | Owner Only | Creates/updates user collections and custom soundboards; enforces max 50 collections for free tier. |
| `/api/reports` | `POST` | Public (Rate-Limited) | Submits abuse/copyright report; triggers automatic `UNDER_EMERGENCY_REVIEW` lock if $\ge 3$ privacy reports accumulate. |
| `/api/admin/moderation/:id` | `POST` | `MODERATOR`, `ADMIN` | Approves (promotes variants to `mc-public`), rejects, or executes hard takedown (deletes public objects + writes `ModerationAction`). |

---

## I. Growth Loops, Anti-Gaming Trending Algorithm & Privacy-Safe Analytics

### 1. Anti-Gaming Time-Decayed Trending Formula
A naive "Most Downloaded All-Time" list freezes the homepage forever, while a naive "Most Views in the Last Hour" is easily gamed by refreshing a page. MemeChowk computes `Asset.trendingScore` every 15 minutes via a background cron job using **deduplicated 7-day engagement with gravity decay**:

$$\text{TrendingScore} = \frac{(W_D \cdot D_{\text{dedup}}) + (W_R \cdot R_{\text{dedup}}) + (W_S \cdot S_{\text{dedup}}) + (W_P \cdot P_{\text{dedup}})}{\left(T_{\text{hours}} + 2\right)^{G}}$$

Where:
* $D_{\text{dedup}}$ = Unique IP/session downloads in the last 168 hours ($W_D = 5.0$)
* $R_{\text{dedup}}$ = Unique "Open in Meme Editor" or remix submissions ($W_R = 4.0$)
* $S_{\text{dedup}}$ = Unique saves to collections/favorites ($W_S = 3.0$)
* $P_{\text{dedup}}$ = Unique audio/video preview plays ($W_P = 1.0$)
* $T_{\text{hours}}$ = Hours since `publishedAt`
* $G = 1.5$ (Gravity exponent so older items naturally decay to make room for new memes)

**New Upload Discovery Guarantee ("Fresh on the Chowk"):**  
Even with a great formula, brand-new uploads start with $0$ engagement. On the Home and Explore feeds, **slots #3 and #8 of the first 12 cards** are reserved for a rotating sample of assets approved within the last 48 hours that have fewer than 20 views (`Exploration Band`), ensuring every approved creator gets fair initial impressions.

### 2. Honest Social Sharing & Attribution Loops
* **Dynamic OpenGraph Social Previews:** Every `/a/[slug]` and `/c/[slug]` route generates a crisp `1200x630` OpenGraph card showing the meme preview, dialogue text in Devanagari/Latin, and creator handle so links pasted in Discord, WhatsApp, Messenger, or X render richly.
* **Web Share API with Honest Telemetry:** On mobile, tapping `Share` triggers `navigator.share({ title, url })` (or falls back to copying the link / downloading the file). **We track `share_intent_clicked`, never claiming a "completed social post"** because browsers do not confirm whether the user finished posting inside WhatsApp or Instagram.
* **Remix Lineage Chain:** When a user creates a meme in `/editor?templateId=abc` and publishes it, the new asset automatically links `parentAssetId = "abc"`, displaying *"Remixed from [Blank Template Name] by @creator"* on the detail page.

### 3. Privacy-Safe Operational & Product Metrics
We do not use invasive third-party ad trackers. Our internal analytics table (`DailyAssetMetric` + `ZeroResultQuery`) tracks the 6 actionable health metrics:
1. **Search-to-Preview Conversion Rate:** $\frac{\text{Searches resulting in } \ge 1 \text{ media preview or play}}{\text{Total search queries}}$
2. **Preview-to-Download / Editor Rate:** $\frac{\text{Completed downloads + Editor opens}}{\text{Total media previews}}$
3. **Zero-Result Query Rate:** Percentage of searches returning $0$ hits (used weekly by moderators to add missing `SearchAlias` entries or commission needed templates).
4. **7-Day Repeat Visitor Rate:** Measured via an anonymous, non-identifying local-storage cohort token.
5. **Median Upload Approval Time ($P_{50}$ & $P_{90}$):** Hours from `PENDING_REVIEW` to moderator decision.
6. **Bandwidth Cost per 1,000 Visits:** Total gigabytes served divided by monthly visits.

---

## J. Business Model, Nepal/India Payment Realities & Financial Scenarios

### 1. Testable Monetization Pillars (And Legal Red Lines)

| Pillar | What Is Offered | Critical Legal / Operational Boundary |
| :--- | :--- | :--- |
| **1. Free Core Tier** | Unlimited browsing, search, soundboard playback, basic image editor, and standard-rate downloads (`30 / 10 min`). | Keeps the platform accessible to every student in Nepal and India without paywalls. |
| **2. MemeChowk Pro (Workflow SaaS)** | NPR 299/mo (or INR 199/mo): Custom multi-tab streamer soundboard hotkeys, batch ZIP download of *eligible* templates, high-res custom font presets in editor, 5 GB private cloud collection storage, and ad-free workspace. | **Crucial Rule:** Paying for Pro sells **software workflow convenience & storage**, *never* a license to third-party copyrighted clips (`PERSONAL_MEME_ONLY` clips remain excluded from commercial batch packs). |
| **3. Original Creator Packs** | One-time or bundled packs (NPR 199–499) of **100% original** Nepali/Hindi voice acting, original illustrated stickers, and streamer alert sound packs with a signed commercial-use certificate (`70%` creator / `30%` platform split). | Every file in a paid pack must have `moderatorVerifiedRights = true` and a signed creator release on file. |
| **4. Sponsored Collections & Brand Challenges** | Clearly labeled `"Sponsored Challenge"` (e.g., a Nepali ISP, gaming tournament, or snack brand sponsoring a *"Best College Fest Meme Challenge"* using an official brand template). | Must carry a visible `Sponsored` badge; never disguise ads as organic community uploads. |
| **5. Non-Intrusive Display Ads (Optional Later)** | Single reserved banner slot below the fold on desktop/mobile detail pages. | **Never** place fake "Download" ad buttons, pop-unders, or audio-playing video ads. |

### 2. Payment Provider Reality Check for a Nepal-Based Founder (2026)
As a student founder in Nepal (e.g., Dhangadhi / Kathmandu), payment integration has strict regulatory boundaries set by Nepal Rastra Bank (NRB) and Indian/international processors:

| Target Market | Realistic Payment Gateways | Requirements & Practical Recommendation |
| :--- | :--- | :--- |
| **1. Domestic Users in Nepal (NPR)** | **eSewa**, **Khalti**, **Fonepay QR**, **ConnectIPS** | **Reality:** Requires a registered business in Nepal (PAN/VAT + Company Registrar / Cottage Industry registration) to get production merchant keys. **However, both Khalti and eSewa provide free Sandbox/Test-Mode APIs** for student developers immediately. Keep payments in Sandbox mode during MVP validation! |
| **2. Users in India (INR)** | **Razorpay**, **Cashfree**, **PhonePe / UPI** | **Reality:** Razorpay and Indian UPI gateways generally require an Indian-registered entity (PAN + Indian bank account) for direct merchant onboarding, though cross-border INR-to-NPR card/QR rails exist via Fonepay/NIPL (Nepal-India cross-border QR) for physical/merchant payments. Do **not** build custom Indian UPI billing in Phase 1; validate Indian traffic on the free tier first. |
| **3. Global / Diaspora Users (USD)** | **Lemon Squeezy / Paddle (Merchant of Record)** or **Stripe** | **Reality:** Stripe does not natively onboard Nepal-domiciled companies directly. A Merchant of Record (MoR) or an international payout partner (capable of wire/SWIFT transfer to a Nepali commercial bank USD account, subject to NRB IT export retention rules and 5% foreign income tax at bank level) is required once revenue justifies paperwork. |

* **Actionable Advice for Phase 1 & 2:** Do **not** block your launch on company registration or payment gateway paperwork! Ship Phase 1 with 100% free tools and a `"Join Pro Waitlist"` modal to measure genuine purchase intent before spending money on legal registration.

### 3. Low / Base / High Monthly Financial Scenarios (Planning Estimates, Not Forecasts)
Let us model monthly unit economics transparently using LaTeX formulas so you can see where costs come from.

#### Cost Formulas
* **Storage Cost ($C_{\text{store}}$):** Average asset across all variants (WebP thumb + 360p preview + 720p MP4/MP3) $\approx 1.5\text{ MB}$. For $N_{\text{assets}}$ total assets at `$0.015 / GB-month` (Cloudflare R2):
  $$C_{\text{store}} = \left(\frac{N_{\text{assets}} \times 1.5}{1024}\right) \times 0.015 \text{ USD}$$
* **Bandwidth Egress Cost ($C_{\text{bw}}$):** Average visitor session consumes $\approx 3.5\text{ MB}$ (thumbnails + 3 previews + 1 download).
  * On **AWS S3** (`$0.09/GB`): $C_{\text{bw, S3}} = \text{Monthly GB} \times 0.09\text{ USD}$ (Very expensive at scale!)
  * On **Cloudflare R2** (`$0.00/GB` egress): $C_{\text{bw, R2}} = \$0.00$ (Only Class A/B operation fees apply, $\approx \$0.36$ per million reads).

| Metric / Line Item | Low Scenario (Early Campus Beta) | Base Scenario (Regional Traction) | High Scenario (Breakout Nepal + India Utility) |
| :--- | :--- | :--- | :--- |
| **Monthly Active Visitors (MAU)** | `2,500` | `25,000` | `150,000` |
| **Total Approved Assets ($N_{\text{assets}}$)** | `500` (~0.75 GB) | `5,000` (~7.5 GB) | `25,000` (~37.5 GB) |
| **Monthly Bandwidth Served** | `~18 GB / mo` | `~180 GB / mo` | `~1,100 GB (1.1 TB) / mo` |
| **1. VPS Compute (App + DB + Worker)** | `$6 / mo` (NPR ~810) *(Hetzner / DO 2vCPU, 4GB RAM)* | `$16 / mo` (NPR ~2,160) *(4vCPU, 8GB RAM)* | `$48 / mo` (NPR ~6,500) *(Dedicated App + Worker VPS)* |
| **2. Object Storage + CDN (Cloudflare R2)** | `$0 / mo` *(Within 10GB free tier)* | `$1.50 / mo` (NPR ~200) | `$8.00 / mo` (NPR ~1,080) *(Note: Would be $99/mo on AWS S3!)* |
| **3. Domain & Backups** | `$1.50 / mo` (NPR ~200) | `$3.50 / mo` (NPR ~475) | `$10.00 / mo` (NPR ~1,350) |
| **4. Moderation Effort (Student / Part-Time)** | `3 hrs/wk` (Founder sweat equity = NPR 0 cash) | `10 hrs/wk` (Founder + 1 part-time mod stipend = NPR 8,000) | `30 hrs/wk` (2 part-time moderators = NPR 25,000) |
| **Total Monthly Cash Cost** | **~NPR 1,010 / mo** (`~$7.50`) | **~NPR 10,835 / mo** (`~$80`) | **~NPR 33,930 / mo** (`~$251`) |
| **Estimated Revenue (0.3% Pro Conv. + 1 Pack/Sponsor)** | **NPR 0** *(Pre-monetization validation)* | **~NPR 12,000 – 20,000 / mo** *(~40 Pro users + 1 mini-sponsor)* | **~NPR 75,000 – 130,000 / mo** *(Pro + Creator Packs + Brand Challenges)* |
| **Net Sustainability Status** | **Bootstrapped out of pocket** (Costs less than 1 momo plate/week) | **Near Break-Even** (Covers server + part-time moderator) | **Self-Sustaining Student Startup** |

---

## K. Phased Implementation Roadmap, Linux Setup & Developer Coordination Guide

### 1. Three-Phase Execution Plan (Do Not Build Everything at Once!)

| Phase | Goal & Scope | Key Deliverables | Completion / Gate Criteria |
| :--- | :--- | :--- | :--- |
| **Phase 1: Core Vertical Slice (Weeks 1–5)** | Ship a working local + staging MVP covering the complete loop from discovery to moderated upload and image remixing. | - Home, Explore, Asset Detail, Soundboard<br>- PostgreSQL `SearchAlias` + `pg_trgm` search<br>- Auth + Presigned Quarantine Upload + Sharp/FFmpeg Worker<br>- Admin Moderation Queue + Takedown kill-switch<br>- HTML5 Canvas Image Meme Editor + Saved Favorites | All 9 Acceptance Checks pass on Linux at `360px` mobile viewport with 100% original/CC0 demo assets. |
| **Phase 2: Creator Polish & PWA (Weeks 6–9)** | Reduce friction for video/audio creators and mobile repeat users. | - In-browser audio trimmer (select start/end handles before upload)<br>- Video-to-GIF / MP4 loop converter job<br>- Public Creator Profiles (`/u/[username]`)<br>- Expanded Nepali/Hindi transliteration dictionary<br>- Offline-capable installable PWA service worker for saved soundboards | Search zero-result rate drops below 15%; P50 upload-to-ready worker processing time under 12 seconds. |
| **Phase 3: Monetization & Scale (Weeks 10+)** | Test revenue hypotheses only after organic repeat usage is proven. | - Khalti / eSewa Sandbox → Live integration for Creator Packs & Pro<br>- Sponsored Challenge landing pages<br>- Typesense/Meilisearch upgrade (if catalog > 50k assets)<br>- Maithili, Bhojpuri, and Newari taxonomy expansion | Validated organic repeat traffic and registered business entity for merchant onboarding. |

### 2. Team Task Split (How to Coordinate 2–4 Student Developers)
If you are working with classmates, divide ownership cleanly by boundary so you do not create Git merge conflicts:
* **Developer 1 (Lead / Backend & Search Engine):** Owns `prisma/schema.prisma`, search normalization (`src/lib/search/`), Auth/RBAC, rate limiting, and `/admin/moderation` APIs.
* **Developer 2 (Media Pipeline & Storage Engineer):** Owns Docker Compose, MinIO presigned URLs, `src/worker/media-worker.ts` (FFmpeg + Sharp + magic-byte validation + waveform JSON generator), and download endpoints.
* **Developer 3 (Mobile UI, Soundboard & Canvas Editor):** Owns Tailwind design system, `AudioController` singleton for `/soundboard`, HTML5 Canvas `/editor` with Devanagari fonts, and `360px` mobile responsiveness.
* **Developer 4 (Content Taxonomy, QA & Seed Curation):** Curates the initial 200+ Nepali/Hindi `SearchAlias` mappings, records/creates 100% original & CC0 seed memes/audio bites, and writes Vitest/Playwright acceptance tests.

---

### 3. Complete Local Linux Setup & Configuration Files

#### File 1: `docker-compose.yml` (PostgreSQL 16, Redis 7, MinIO S3 + Auto Bucket Init)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: memechowk_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: memechowk
      POSTGRES_PASSWORD: localdevpassword
      POSTGRES_DB: memechowk_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memechowk -d memechowk_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: memechowk_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  minio:
    image: minio/minio:latest
    container_name: memechowk_minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadminpassword
    ports:
      - "9000:9000" # S3 API Port
      - "9001:9001" # Web Console Port
    volumes:
      - miniodata:/data

  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 3;
      /usr/bin/mc alias set local http://minio:9000 minioadmin minioadminpassword;
      /usr/bin/mc mb --ignore-existing local/mc-quarantine;
      /usr/bin/mc mb --ignore-existing local/mc-public;
      /usr/bin/mc anonymous set none local/mc-quarantine;
      /usr/bin/mc anonymous set download local/mc-public;
      exit 0;
      "

volumes:
  pgdata:
  redisdata:
  miniodata:
```

#### File 2: `.env.example` (Zero Secrets Committed)
```ini
# Application
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database (PostgreSQL 16)
DATABASE_URL="postgresql://memechowk:localdevpassword@localhost:5432/memechowk_dev?schema=public"

# Authentication (Generate secret on Linux via: openssl rand -base64 32)
AUTH_SECRET="replace-with-local-random-32-byte-secret-key"

# Redis (BullMQ & Rate Limiting)
REDIS_URL="redis://localhost:6379"

# S3 / MinIO Object Storage (Server-Side Only — NEVER prefix credentials with NEXT_PUBLIC_)
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadminpassword"
S3_QUARANTINE_BUCKET="mc-quarantine"
S3_PUBLIC_BUCKET="mc-public"
NEXT_PUBLIC_MEDIA_CDN_URL="http://localhost:9000/mc-public"

# Worker & Upload Safety Limits
MAX_UPLOAD_BYTES=26214400
FFMPEG_TIMEOUT_MS=30000
PAYMENT_MODE="SANDBOX_DISABLED"
```

#### File 3: Step-by-Step Linux Terminal Commands (Ubuntu / Debian / Arch / Fedora)
```bash
# 1. Install system dependencies (Node.js 22 LTS, Docker, and FFmpeg)
# Ubuntu/Debian:
sudo apt update && sudo apt install -y ffmpeg docker.io docker-compose-v2 curl git
# (Or on Arch Linux: sudo pacman -S ffmpeg docker docker-compose git)

# Verify FFmpeg and ffprobe are installed:
ffmpeg -version && ffprobe -version

# 2. Clone project and configure environment
git clone <your-repo-url> memechowk && cd memechowk
cp .env.example .env

# 3. Start PostgreSQL, Redis, and MinIO buckets
docker compose up -d
docker compose ps

# 4. Install pinned npm dependencies & push Prisma schema (enables pg_trgm & unaccent)
npm install
npx prisma migrate dev --name init_memechowk

# 5. Seed 100% original/CC0 Nepali & Hindi demo assets, tags, and search aliases
npx prisma db seed

# 6. Start the Next.js web server AND the background media worker in two terminals:
npm run dev      # Terminal 1: Web app on http://localhost:3000
npm run worker   # Terminal 2: BullMQ FFmpeg/Sharp quarantine processor

# 7. Run the automated verification test suite:
npm run test
```

---

### 4. Core Reference Implementation Modules (Phase 1 Code Foundations)

#### Module 1: Regional Search Normalizer & Hybrid Query (`src/lib/search/regional-search.ts`)
```typescript
// src/lib/search/regional-search.ts
import { Prisma, LanguageCode, MediaType } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Normalizes Romanized Nepali, Hinglish, and Devanagari queries so
 * "K ho yo!!", "ke ho yoo", and "के हो यो" map cleanly against SearchAlias.
 */
export function normalizeRegionalQuery(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // Keep Unicode letters (Devanagari + Latin) & numbers
    .replace(/\s+/g, " ");

  // Collapse common Romanized Nepali / Hinglish vowel elongations & chat shorthands
  return cleaned
    .replace(/\b(ke)\b/g, "k")
    .replace(/\b(chha|xa)\b/g, "cha")
    .replace(/aa+/g, "a")
    .replace(/ee+/g, "i")
    .replace(/oo+/g, "u")
    .trim();
}

export interface SearchFilters {
  query?: string;
  language?: LanguageCode;
  mediaType?: MediaType;
  commercialOnly?: boolean;
  limit?: number;
}

export async function searchApprovedAssets(filters: SearchFilters) {
  const limit = Math.min(filters.limit ?? 24, 48);
  const rawQuery = filters.query?.trim() ?? "";
  const normQuery = normalizeRegionalQuery(rawQuery);

  // If no search text, return filtered feed ordered by trendingScore & freshness
  if (!normQuery) {
    return prisma.asset.findMany({
      where: {
        moderationStatus: "APPROVED_PUBLIC",
        ...(filters.language ? { language: filters.language } : {}),
        ...(filters.mediaType ? { mediaType: filters.mediaType } : {}),
        ...(filters.commercialOnly
          ? { rightsRecord: { commercialEligible: true } }
          : {}),
      },
      include: {
        variants: { where: { isReady: true } },
        rightsRecord: true,
      },
      orderBy: [{ trendingScore: "desc" }, { publishedAt: "desc" }],
      take: limit,
    });
  }

  // Hybrid SQL query combining exact/prefix SearchAlias, transcript match, and pg_trgm similarity
  const results = await prisma.$queryRaw<Array<{ id: string; rank_score: number }>>(
    Prisma.sql`
      SELECT
        a.id,
        MAX(
          CASE
            WHEN sa."normalizedAlias" = ${normQuery} THEN 1.00
            WHEN sa."normalizedAlias" LIKE ${normQuery + "%"} THEN 0.85
            WHEN LOWER(a.title) LIKE ${"%" + rawQuery.toLowerCase() + "%"} THEN 0.80
            WHEN a."transcriptDeva" LIKE ${"%" + rawQuery + "%"} THEN 0.80
            ELSE GREATEST(
              similarity(COALESCE(sa."normalizedAlias", ''), ${normQuery}),
              similarity(LOWER(a.title), ${normQuery}),
              similarity(COALESCE(LOWER(a."transcriptRoman"), ''), ${normQuery})
            ) * 0.65
          END
        ) + LEAST(a."trendingScore" * 0.05, 0.25) AS rank_score
      FROM "Asset" a
      LEFT JOIN "SearchAlias" sa ON sa."assetId" = a.id
      LEFT JOIN "RightsRecord" rr ON rr."assetId" = a.id
      WHERE a."moderationStatus" = 'APPROVED_PUBLIC'
        AND (${filters.language ?? null}::"LanguageCode" IS NULL OR a.language = ${filters.language ?? null}::"LanguageCode")
        AND (${filters.mediaType ?? null}::"MediaType" IS NULL OR a."mediaType" = ${filters.mediaType ?? null}::"MediaType")
        AND (${filters.commercialOnly ?? false} = FALSE OR rr."commercialEligible" = TRUE)
        AND (
          sa."normalizedAlias" = ${normQuery}
          OR sa."normalizedAlias" LIKE ${normQuery + "%"}
          OR a."transcriptDeva" LIKE ${"%" + rawQuery + "%"}
          OR similarity(COALESCE(sa."normalizedAlias", ''), ${normQuery}) > 0.30
          OR similarity(LOWER(a.title), ${normQuery}) > 0.30
          OR similarity(COALESCE(LOWER(a."transcriptRoman"), ''), ${normQuery}) > 0.30
        )
      GROUP BY a.id
      ORDER BY rank_score DESC, a."publishedAt" DESC
      LIMIT ${limit};
    `
  );

  if (results.length === 0) return [];

  const orderedIds = results.map((r) => r.id);
  const assets = await prisma.asset.findMany({
    where: { id: { in: orderedIds } },
    include: {
      variants: { where: { isReady: true } },
      rightsRecord: true,
    },
  });

  const assetMap = new Map(assets.map((a) => [a.id, a]));
  return orderedIds.map((id) => assetMap.get(id)!).filter(Boolean);
}
```

#### Module 2: Enforceable Rights Calculator (`src/lib/rights/evaluate-rights.ts`)
```typescript
// src/lib/rights/evaluate-rights.ts
import { ReuseTier, SourceDeclaration } from "@prisma/client";

export interface RightsEvaluationInput {
  sourceDeclaration: SourceDeclaration;
  moderatorVerifiedRights: boolean;
  requestedReuseTier?: ReuseTier;
}

export interface RightsEvaluationResult {
  reuseTier: ReuseTier;
  commercialEligible: boolean;
}

/**
 * Enforces the hard rule that an uploader checkbox alone NEVER grants
 * commercial reuse eligibility for third-party or unverified uploads.
 */
export function evaluateAssetRights(input: RightsEvaluationInput): RightsEvaluationResult {
  // Rule 1: Third-party reaction/commentary clips are NEVER eligible for commercial download
  if (input.sourceDeclaration === "THIRD_PARTY_REACTION_CONTEXT") {
    return {
      reuseTier: "PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS",
      commercialEligible: false,
    };
  }

  // Rule 2: Even if uploader claims Original or Licensed, commercial eligibility
  // remains FALSE until a moderator explicitly verifies the proof/account.
  if (!input.moderatorVerifiedRights) {
    return {
      reuseTier: "CREATOR_NON_COMMERCIAL",
      commercialEligible: false,
    };
  }

  // Rule 3: Moderator has verified original creation or license proof
  if (
    input.requestedReuseTier === "CC0_PUBLIC_DOMAIN" ||
    input.requestedReuseTier === "CC_BY_4_0" ||
    input.requestedReuseTier === "CREATOR_AUTHORIZED_COMMERCIAL"
  ) {
    return {
      reuseTier: input.requestedReuseTier,
      commercialEligible: true,
    };
  }

  return {
    reuseTier: "CREATOR_NON_COMMERCIAL",
    commercialEligible: false,
  };
}
```

---

### 5. Required Automated Test Matrix & Acceptance Checklist

Before deploying or presenting the project, your test suite (`npm run test`) must verify these 9 acceptance criteria:

| # | Acceptance Check | How It Is Verified in Code / Tests |
| :--- | :--- | :--- |
| **1** | **Clean Linux installation works from README** | Running `docker compose up -d && npx prisma migrate dev && npx prisma db seed && npm run dev` boots cleanly with zero missing environment variables or external cloud dependencies. |
| **2** | **Data persists across container restarts** | Named Docker volumes (`pgdata`, `miniodata`, `redisdata`) preserve database rows and uploaded objects across `docker compose restart`. |
| **3** | **Unapproved uploads are never publicly accessible** | Unit/Integration test uploads an asset (`UPLOADED_QUARANTINE` / `PENDING_REVIEW`) and asserts that `GET /api/search`, `GET /api/assets/:slug`, and `GET /api/assets/:id/download` all return `404` for anonymous and non-owner users, and `mc-quarantine` rejects direct anonymous HTTP GETs. |
| **4** | **Normal users cannot access admin operations** | Integration test calls `POST /api/admin/moderation/:id` with a `USER` session cookie and asserts `HTTP 403 Forbidden`. |
| **5** | **Approved media can be found via cross-script aliases, previewed, and downloaded** | Test searches `"k ho yo"` and `"के हो यो"`, verifies both return the same approved asset, plays the preview, and verifies `GET /api/assets/:id/download` returns a valid file stream with `Content-Disposition: attachment`. |
| **6** | **Meme Editor exports a valid image with rendered Devanagari & Latin text** | E2E Playwright test loads `/editor`, types `"के हो यो भाई"`, clicks Export PNG, and verifies a valid `image/png` blob with non-zero dimensions is downloaded. |
| **7** | **Removed (`TAKEDOWN_REMOVED`) media cannot still be downloaded** | Test triggers a takedown on an approved asset and verifies that `GET /api/assets/:id/download` immediately returns `404`/`410` and the object is deleted from `mc-public`. |
| **8** | **Main flow works at a `360px` mobile viewport** | Playwright test sets `viewport: { width: 360, height: 640 }`, navigates Home → Search → Soundboard → Editor, and asserts zero horizontal overflow (`document.documentElement.scrollWidth <= 360`). |
| **9** | **No fake buttons, fabricated metrics, or false commercial claims** | UI only renders download buttons for `AssetVariant` rows where `isReady === true`; `THIRD_PARTY_REACTION_CONTEXT` uploads are hard-locked to `commercialEligible: false`. |

---

### 6. Production Readiness Checklist & Honest List of Unfinished Features (Post-Phase 1)

#### Production Launch Checklist (When Moving from Local Linux to Public VPS)
- [ ] Replace MinIO local URLs with **Cloudflare R2** buckets (`mc-quarantine` private, `mc-public` behind a custom domain with Cache-Control rules).
- [ ] Configure automated nightly `pg_dump` backups to an encrypted offsite bucket.
- [ ] Set `AUTH_SECRET` to a cryptographically random 32-byte value and enforce `Secure`, `HttpOnly`, `SameSite=Lax` cookies behind HTTPS.
- [ ] Publish real contact details for your designated Copyright & Privacy Takedown Officer on `/legal/copyright-takedown`.
- [ ] Run worker container with `--memory=1g --cpus=1.5` and verify FFmpeg `-protocol_whitelist file,pipe` is enforced on every command.

#### Honest List of Features Deferred to Phase 2 & Phase 3
1. **In-Browser Audio Waveform Trimmer (Phase 2):** Phase 1 enforces a 20-second audio limit on upload; interactive client-side start/end trimming handles are scheduled for Phase 2.
2. **Automated Video-to-GIF Palette Generation (Phase 2):** Phase 1 converts uploaded GIFs to lightweight MP4 loops and extracts 360p/720p MP4s + MP3 audio from videos; on-demand video-to-GIF generation is deferred to Phase 2 to prevent worker CPU spikes.
3. **Live Payment Gateway Checkout (Phase 3):** Payment buttons remain in explicit Sandbox/Waitlist mode until business registration (PAN/Company Registrar in Nepal) is completed.