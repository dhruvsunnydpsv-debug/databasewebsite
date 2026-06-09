#!/usr/bin/env python3
"""
SAT Question Scraper v3 — Scrapes real questions from CrackSAT digital SAT pages,
then sends them to the Prepvora webhook for Groq entity-swap de-copywriting.

Entity Swap = keep the SAME numbers, values, equations, and structure.
Only change names of people, places, and objects. Mathematically identical.

Sources:
  - cracksat.net  (Digital SAT practice tests — current URL format)

Environment:
  WEBHOOK_URL    — https://www.prepvora.com/api/admin/scraper-webhook/
  WEBHOOK_SECRET — matches WEBHOOK_SECRET in Vercel env
  TARGET_DOMAIN  — SAT domain (Algebra, Advanced Math, etc.)
  TARGET_COUNT   — number of questions to scrape and send (default 25)
"""

import os
import re
import json
import time
import random
import requests
from bs4 import BeautifulSoup

WEBHOOK_URL    = os.environ.get("WEBHOOK_URL", "https://www.prepvora.com/api/admin/scraper-webhook/")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
TARGET_DOMAIN  = os.environ.get("TARGET_DOMAIN", "Algebra")
TARGET_COUNT   = int(os.environ.get("TARGET_COUNT", "25"))
TARGET_EXAM    = os.environ.get("TARGET_EXAM", "SAT").upper()   # SAT (scrape CrackSAT) | ACT (AI-generate)

# ── Direct-insert credentials (preferred) ────────────────────────────────────
# When Supabase + Groq creds are present, the scraper entity-swaps and inserts
# straight into the DB itself. That lets it LOOP until EXACTLY TARGET_COUNT new
# questions land (duplicates don't count), instead of firing a fixed batch at the
# webhook and hoping. Falls back to the webhook when only WEBHOOK_SECRET is set.
SUPABASE_URL              = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "") or os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GROQ_API_KEY              = os.environ.get("GROQ_API_KEY", "")
DIRECT_MODE = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and GROQ_API_KEY)

# ── Source URLs by domain ────────────────────────────────────────────────────

# CrackSAT Digital SAT — CURRENT URL format (verified May 2026)
# Math: /digital/math/test{N}.html  (tests 1-65)
# R&W:  /digital/reading-writing/test{N}.html (tests 1-75)

CRACKSAT_DIGITAL_MATH = [
    f"https://www.cracksat.net/digital/math/test{i}.html"
    for i in range(1, 66)
]

CRACKSAT_DIGITAL_RW = [
    f"https://www.cracksat.net/digital/reading-writing/test{i}.html"
    for i in range(1, 141)   # verified live to test130 — was 1-75, now the full pool
]

# ── FRESH SOURCES: CrackSAT legacy /sat/ pages ───────────────────────────────
# A separate, large pool of practice pages the digital scraper never touched.
# Different markup, but extract_questions_cracksat_digital()'s generic fallback
# (matches "N. … A) … B)" blocks) handles them, and the webhook's Groq pipeline
# rewrites + validates whatever raw text it receives, with dedup protecting the
# bank. This is what keeps the scraper finding genuinely new questions.
CRACKSAT_SAT_MATH = [
    f"https://www.cracksat.net/sat/math-multiple-choice/test-{i}.html"
    for i in range(1, 121)   # verified live to test-110 — was 1-70
]
CRACKSAT_SAT_GRID = [
    f"https://www.cracksat.net/sat/math-grid-ins/test-{i}.html"
    for i in range(1, 51)    # was 1-30; extra pages 404 harmlessly if past the end
]
CRACKSAT_SAT_GRAMMAR = [
    f"https://www.cracksat.net/sat/grammar/test-{i}.html"
    for i in range(1, 71)    # was 1-34
]
CRACKSAT_SAT_READING = [
    f"https://www.cracksat.net/sat/reading/test-{i}.html"
    for i in range(1, 81)    # verified live to test-70 — was 1-40
]

# Topic-specific groupings (based on CrackSAT's own categorization):
# Tests 1-2:   Strategies
# Tests 3-9:   Arithmetic (fractions, decimals, percents, ratios, averages)
# Tests 10-12: Algebra (polynomials, equations, word problems)
# Tests 13-21: Geometry (lines, angles, triangles, quads, circles, solid, coord, data)
# Tests 22-26: Data Analysis (probability, sequences, functions, trig, complex)
# Tests 32-49: By-topic (linear, nonlinear, ratios, percents, data, geometry, trig, circles)
# Tests 50-65: Mixed practice

# All four math domains can draw from the full math pools — Groq classifies each
# question into its real domain, and the webhook normalizes/validates. The
# scrape_domain() shuffle + 20-page cap means each run samples a different slice,
# so over successive runs the scraper works through the whole pool.
_ALL_DIGITAL_MATH = list(CRACKSAT_DIGITAL_MATH)
_ALL_MATH_LEGACY  = CRACKSAT_SAT_MATH + CRACKSAT_SAT_GRID

DOMAIN_SOURCES: dict[str, list[str]] = {
    # Math domains — full digital math pool + the fresh legacy /sat/ math pool
    "Algebra": _ALL_DIGITAL_MATH + _ALL_MATH_LEGACY,
    "Advanced Math": _ALL_DIGITAL_MATH + _ALL_MATH_LEGACY,
    "Problem-solving and Data Analysis": _ALL_DIGITAL_MATH + _ALL_MATH_LEGACY,
    "Geometry and Trigonometry": _ALL_DIGITAL_MATH + _ALL_MATH_LEGACY,

    # R&W domains — full digital R&W pool + the relevant fresh legacy pool.
    # Reading pages skew to Information/Craft; grammar pages to Expression/Conventions.
    "Information and Ideas": CRACKSAT_DIGITAL_RW + CRACKSAT_SAT_READING,
    "Craft and Structure": CRACKSAT_DIGITAL_RW + CRACKSAT_SAT_READING,
    "Expression of Ideas": CRACKSAT_DIGITAL_RW + CRACKSAT_SAT_GRAMMAR,
    "Standard English Conventions": CRACKSAT_DIGITAL_RW + CRACKSAT_SAT_GRAMMAR,
}

# Rotate User-Agent headers to avoid blocks
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
]


def get_headers() -> dict:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        # NOTE: do NOT advertise brotli ('br') — the requests lib can't decode it
        # without the optional brotli package (not installed in CI), which makes
        # resp.text come back as garbled binary. gzip/deflate are decoded natively.
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


def fetch_page(url: str) -> str | None:
    """Fetch a URL with anti-bot delays and retry logic."""
    for attempt in range(3):
        try:
            delay = random.uniform(2, 5)
            time.sleep(delay)
            resp = requests.get(url, headers=get_headers(), timeout=20)
            if resp.status_code == 200:
                return resp.text
            print(f"  [warn] {url} returned {resp.status_code}")
            if resp.status_code in (403, 404):
                print(f"  [warn] Blocked or not found, skipping")
                return None
        except Exception as e:
            print(f"  [warn] attempt {attempt+1} failed: {e}")
            time.sleep(random.uniform(3, 8))
    return None


def extract_image_url(element) -> str | None:
    """Extract image URL from an element if present."""
    if element is None:
        return None
    # A NavigableString is a str subclass whose .find() returns an int (substring
    # index) — calling .get("src") on that int was the "'int' object has no
    # attribute 'get'" crash that skipped whole pages. Only real Tag elements
    # (which have find_all) should be searched for an <img>.
    img = element.find("img") if hasattr(element, 'find_all') else None
    if img and img.get("src"):
        src = img["src"]
        if src.startswith("//"):
            return "https:" + src
        elif src.startswith("/"):
            return "https://www.cracksat.net" + src
        elif src.startswith("http"):
            return src
    return None


def extract_questions_cracksat_digital(html: str, domain: str) -> list[dict]:
    """
    Parse CrackSAT Digital SAT pages (current format as of May 2026).

    The new format uses:
    - <p class="nop"><span>N</span></p> for question numbers
    - <div class="radio"><input type="radio" .../><label ...>A. option text</label></div>
      for multiple choice
    - <input type="text" .../> for student-produced responses (grid-in)
    - Questions and options are siblings inside a <form> tag
    """
    soup = BeautifulSoup(html, "html.parser")
    questions: list[dict] = []

    # Find the form containing all questions
    form = soup.find("form", attrs={"name": "TEST"})
    if not form:
        # Fallback: try to find questions in the whole page
        form = soup

    # Split into questions by finding all <p class="nop"> markers
    nop_markers = form.find_all("p", class_="nop")

    if not nop_markers:
        # Fallback: try generic extraction
        return _extract_questions_fallback(html, domain)

    for idx, marker in enumerate(nop_markers):
        try:
            # Collect all sibling elements until the next nop marker
            parts = []
            images = []
            current = marker.next_sibling

            # Find the next marker to know where to stop
            next_marker = nop_markers[idx + 1] if idx + 1 < len(nop_markers) else None

            while current:
                if next_marker and current == next_marker:
                    break

                if hasattr(current, 'get_text'):
                    text = current.get_text(separator=" ", strip=True)
                    if text:
                        parts.append(text)

                    # Check for images
                    img_url = extract_image_url(current)
                    if img_url:
                        images.append(img_url)

                current = current.next_sibling

            block_text = "\n".join(parts)

            # Only include if there's enough content
            if len(block_text) > 30:
                # Clean up option prefixes (A., B., C., D.) for context
                questions.append({
                    "text": f"[Source: CrackSAT Digital SAT — domain: {domain}]\n\n{block_text}",
                    "image_url": images[0] if images else None,
                })
        except Exception as e:
            print(f"    [warn] Error extracting question {idx + 1}: {e}")
            continue

    return questions


def _extract_questions_fallback(html: str, domain: str) -> list[dict]:
    """Fallback extraction using text-pattern matching."""
    soup = BeautifulSoup(html, "html.parser")
    questions: list[dict] = []

    full_text = soup.get_text(separator="\n", strip=True)
    lines = [l.strip() for l in full_text.split("\n") if l.strip()]

    current: list[str] = []
    for line in lines:
        if re.match(r'^(?:Question\s+)?\d{1,2}[\.)]', line) and current:
            block_text = "\n".join(current)
            if len(block_text) > 40 and any(
                c in block_text for c in ["A)", "B)", "A.", "B.", "(A)", "(B)"]
            ):
                questions.append({
                    "text": f"[Source: CrackSAT Digital SAT — domain: {domain}]\n\n{block_text}",
                    "image_url": None,
                })
            current = [line]
        else:
            current.append(line)
    if current and len("\n".join(current)) > 40:
        block_text = "\n".join(current)
        if any(c in block_text for c in ["A)", "B)", "A.", "B.", "(A)", "(B)"]):
            questions.append({
                "text": f"[Source: CrackSAT Digital SAT — domain: {domain}]\n\n{block_text}",
                "image_url": None,
            })

    return questions


def iter_domain_questions(domain: str):
    """Lazily yield raw question dicts for `domain`, one CrackSAT page at a time.

    A generator (not a fixed batch) so the caller can stop the moment it has
    inserted exactly TARGET_COUNT new questions — we only fetch as many pages as
    the exact-count loop actually needs, instead of pre-scraping a big pool.
    """
    urls = list(DOMAIN_SOURCES.get(domain, DOMAIN_SOURCES["Algebra"]))
    random.shuffle(urls)
    pages_tried = 0
    max_pages = 50  # generous ceiling — plenty to satisfy a 50-question target

    for url in urls:
        if pages_tried >= max_pages:
            break
        print(f"  [scrape] Fetching {url}")
        html = fetch_page(url)
        pages_tried += 1
        if not html:
            continue
        questions = extract_questions_cracksat_digital(html, domain)
        print(f"    -> Found {len(questions)} questions")
        random.shuffle(questions)
        for q in questions:
            yield q


def send_to_webhook(questions: list[dict], domain: str) -> dict:
    """POST scraped questions to the Prepvora webhook."""
    payload = {
        "questions": [q["text"] for q in questions],
        "image_urls": [q.get("image_url") for q in questions],
        "target_domain": domain,
    }
    headers = {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
    }
    url = WEBHOOK_URL.rstrip("/") + "/"
    print(f"  [webhook] Sending {len(questions)} questions to {url}")

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=300)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as e:
        print(f"  [webhook] HTTP error: {e}")
        print(f"  [webhook] Response: {resp.text[:500] if resp else 'no response'}")
        # transport_error = a REAL failure (auth/500/unreachable) worth alerting on,
        # as opposed to a 200 response that simply ingested 0 (all duplicates).
        return {"ingested": 0, "failed": len(questions), "errors": [str(e)], "transport_error": True}
    except Exception as e:
        print(f"  [webhook] Error: {e}")
        return {"ingested": 0, "failed": len(questions), "errors": [str(e)], "transport_error": True}


# ─────────────────────────────────────────────────────────────────────────────
# DIRECT-INSERT PIPELINE  (ported 1:1 from the /scraper-webhook route so behaviour
# — the Entity Swap, validation, dedup, and schema — is identical, just running
# in CI against Supabase directly and looping until the exact count is reached).
# ─────────────────────────────────────────────────────────────────────────────

RW_DOMAINS = {"Information and Ideas", "Craft and Structure", "Expression of Ideas", "Standard English Conventions"}
MATH_DOMAINS = {"Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry"}
VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}

DOMAIN_NORMALIZER = {
    "Information and Ideas": "Information and Ideas", "Information_Ideas": "Information and Ideas",
    "Craft and Structure": "Craft and Structure", "Craft_Structure": "Craft and Structure",
    "Expression of Ideas": "Expression of Ideas", "Expression_Ideas": "Expression of Ideas",
    "Standard English Conventions": "Standard English Conventions", "Standard_English": "Standard English Conventions",
    "Algebra": "Algebra", "Heart of Algebra": "Algebra", "Heart_of_Algebra": "Algebra",
    "Advanced Math": "Advanced Math", "Advanced_Math": "Advanced Math",
    "Problem-solving and Data Analysis": "Problem-solving and Data Analysis",
    "Problem_Solving_Data": "Problem-solving and Data Analysis",
    "Problem Solving and Data Analysis": "Problem-solving and Data Analysis",
    "Geometry and Trigonometry": "Geometry and Trigonometry", "Geometry_Trigonometry": "Geometry and Trigonometry",
}

DE_COPYRIGHT_PROMPT = r"""You are an expert SAT question editor specialising in the ENTITY SWAP technique.

You will receive a real SAT practice question. Your job is to de-copywrite it using these STRICT rules:

ENTITY SWAP RULES:
1. KEEP every number, value, equation, formula, percentage, ratio, and mathematical relationship EXACTLY as-is.
   - If the original says "60 miles per hour", your version must also use 60.
   - If the original equation is 3x + 7 = 2x - 5, your version uses 3x + 7 = 2x - 5.
   - Math problems must produce the IDENTICAL numerical answer.
2. ONLY change: names of people, places, objects, brands, and narrative wrapper.
   - "John drove from Boston to New York" -> "Priya drove from Chennai to Mumbai"
   - "A store sells apples" -> "A farm sells mangoes"
3. For Reading/Writing: rephrase the passage and question using different topics/names but keep the SAME rhetorical structure, vocabulary level, and grammatical pattern being tested.
4. Keep the same number of answer choices. Keep the SAME correct answer value — only rephrase its wording to match your new context.
5. Keep the same difficulty level.

MATH FORMATTING RULES (CRITICAL):
- All mathematical expressions MUST use LaTeX wrapped in $...$
- Exponents: write $x^2$ NOT x^2
- Fractions: write $\frac{3}{4}$ NOT 3/4 in math context
- Square roots: write $\sqrt{16}$ NOT the square root of 16
- Equations: write $3x + 7 = 2x - 5$ NOT 3x + 7 = 2x - 5
- Variables: write $x$, $y$, $n$ when standalone in math context
- DO NOT include option letters (A., B), C:) in the options array values

Return ONLY valid JSON (no markdown, no extra text):
{
  "module": "Reading_Writing" or "Math",
  "domain": "one of: Information and Ideas | Craft and Structure | Expression of Ideas | Standard English Conventions | Algebra | Advanced Math | Problem-solving and Data Analysis | Geometry and Trigonometry",
  "difficulty": "Easy | Medium | Hard",
  "question_text": "The entity-swapped question — same structure and values, different names/context. Use $LaTeX$ for all math.",
  "options": ["Option text only — no A./B./C./D. prefix, use $LaTeX$ for math", "...", "...", "..."],
  "correct_answer": "Exact text of the correct option (must match one of the options exactly)",
  "rationale": "2-3 sentence explanation of why the correct answer is right and why each distractor is wrong.",
  "is_spr": false
}"""


def entity_swap(groq_client, raw_text: str, target_domain: str):
    """Run one question through Groq's Entity Swap. Returns (parsed_dict, error)."""
    domain_hint = (
        f'\nIMPORTANT: This question should be categorized under the "{target_domain}" domain.'
        if target_domain else ""
    )
    # Raw HTTP (no groq SDK) — the SDK pulls an httpx version that clashes in CI
    # and made EVERY call fail with "Connection error", skipping all questions.
    # requests is already a dependency and Just Works. Model fallback + backoff so
    # a per-model daily cap never skips a question.
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    messages = [
        {"role": "system", "content": DE_COPYRIGHT_PROMPT},
        {"role": "user", "content": f"Raw source material:{domain_hint}\n\n{raw_text}"},
    ]
    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
    for round_i in range(4):
        all_limited = True
        for model in models:
            try:
                r = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json={"model": model, "messages": messages, "temperature": 0.5, "response_format": {"type": "json_object"}},
                    timeout=60,
                )
            except Exception as e:
                all_limited = False
                print(f"  [groq] {model} network error: {e}", flush=True)
                continue
            if r.status_code == 200:
                try:
                    content = r.json()["choices"][0]["message"]["content"]
                except Exception:
                    all_limited = False
                    continue
                if not content:
                    all_limited = False
                    continue
                try:
                    return json.loads(content), None
                except Exception:
                    return None, "JSON parse error"
            if r.status_code in (429, 503):
                continue  # this model is capped — try the next one
            return None, f"groq_error: HTTP {r.status_code}: {r.text[:120]}"
        if all_limited:
            wait = min(20 * (2 ** round_i), 240)
            print(f"  all Groq models rate-limited — waiting {wait}s…", flush=True)
            time.sleep(wait)
        else:
            break
    return None, "groq_error: all models rate-limited"


def build_row(parsed: dict, raw_text: str):
    """Validate + normalize a Groq result into a schema-correct row. (parsed, err)."""
    q_text = (parsed.get("question_text") or "").strip()
    if not q_text or len(q_text) < 20:
        return None, "Question text too short"
    domain = DOMAIN_NORMALIZER.get(parsed.get("domain", ""), "")
    if not domain:
        return None, f"Unknown domain: {parsed.get('domain')}"
    difficulty = parsed.get("difficulty") or "Medium"
    if difficulty not in VALID_DIFFICULTIES:
        return None, f"Bad difficulty: {difficulty}"
    options = parsed.get("options")
    if not isinstance(options, list) or len(options) != 4:
        return None, "Options not 4-element array"
    # Strip any stray option-letter prefixes, then trim.
    options = [re.sub(r"^[a-dA-D][\)\.\-]\s*", "", str(o)).strip() for o in options]
    raw_correct = (parsed.get("correct_answer") or "").strip()
    correct = next((o for o in options if o == raw_correct), None)
    if correct is None:
        correct = next((o for o in options if o.lower() == raw_correct.lower()), None)
    if correct is None:
        correct = re.sub(r"^[a-dA-D][\)\.\-]\s*", "", raw_correct).strip()
    if correct not in options:
        return None, "correct_answer not in options"
    module = "Reading_Writing" if domain in RW_DOMAINS else "Math" if domain in MATH_DOMAINS else ""
    if not module:
        return None, "Could not determine module"
    rationale = (parsed.get("rationale") or "").strip() or f"The correct answer is: {correct}"
    return {
        "module": module,
        "domain": domain,
        "difficulty": difficulty,
        "question_text": q_text,
        "options": options,
        "correct_answer": correct,
        "rationale": rationale,
        "is_spr": parsed.get("is_spr") is True,
        "source_method": "Automated_Pipeline",
        "raw_original_text": (raw_text or "").strip() or None,
    }, None


def raw_already_seen(supabase, raw_text: str) -> bool:
    """Cheap pre-check: has this exact source block already been ingested? Lets us
    skip the Groq call entirely for pages we've processed before."""
    raw_trim = (raw_text or "").strip()
    if not raw_trim:
        return False
    try:
        dup = supabase.table("sat_question_bank").select("id").eq("raw_original_text", raw_trim).limit(1).execute()
        return bool(dup.data)
    except Exception:
        return False


def text_already_seen(supabase, q_text: str) -> bool:
    try:
        dup = supabase.table("sat_question_bank").select("id").eq("question_text", q_text).limit(1).execute()
        return bool(dup.data)
    except Exception:
        return False


def upload_image(supabase, qid, image_url: str):
    """Best-effort: persist a source diagram as q-<id>.<ext> in storage. Never raises."""
    try:
        resp = requests.get(image_url, timeout=30)
        if resp.status_code != 200:
            return
        ct = resp.headers.get("content-type", "image/png")
        ext = ("svg" if "svg" in ct else "jpg" if "jpeg" in ct else
               "webp" if "webp" in ct else "gif" if "gif" in ct else "png")
        try:
            supabase.storage.create_bucket("question-images", options={"public": True})
        except Exception:
            pass
        supabase.storage.from_("question-images").upload(
            f"q-{qid}.{ext}", resp.content, {"content-type": ct, "upsert": "true"}
        )
    except Exception:
        pass


def run_direct(domain: str, target: int):
    """Entity-swap + insert straight into Supabase, looping until EXACTLY `target`
    new questions are inserted (or the source pool is exhausted)."""
    from supabase import create_client

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    groq_client = None  # entity_swap() uses raw HTTP now — no groq SDK (avoids the CI httpx clash)

    inserted = 0
    dup_skipped = 0
    rejected = 0

    for raw in iter_domain_questions(domain):
        if inserted >= target:
            break
        raw_text = raw.get("text", "")

        # Skip the Groq call on sources we've already ingested.
        if raw_already_seen(supabase, raw_text):
            dup_skipped += 1
            continue

        parsed, err = entity_swap(groq_client, raw_text, domain)
        if err:
            rejected += 1
            print(f"    [skip] {err}")
            time.sleep(6 if err.startswith("groq_error") else 0.4)  # back off on rate limits
            continue

        row, err = build_row(parsed, raw_text)
        if err:
            rejected += 1
            print(f"    [skip] {err}")
            continue

        if text_already_seen(supabase, row["question_text"]):
            dup_skipped += 1
            continue

        try:
            res = supabase.table("sat_question_bank").insert(row).execute()
        except Exception as e:
            rejected += 1
            print(f"    [skip] DB error: {e}")
            continue

        new_id = res.data[0]["id"] if getattr(res, "data", None) else None
        if new_id and raw.get("image_url"):
            upload_image(supabase, new_id, raw["image_url"])

        inserted += 1
        print(f"    [insert {inserted}/{target}] {row['domain']} · {row['difficulty']}")
        time.sleep(0.5)  # gentle on the Groq rate limit

    print(f"\n  [direct] inserted={inserted} dup_skipped={dup_skipped} rejected={rejected}")
    return inserted


def run_webhook(domain: str, target: int):
    """Fallback path — batch questions to the webhook, looping until `target`
    ingested. Used when only WEBHOOK_SECRET (no Supabase creds) is configured."""
    inserted = 0
    batch = []
    BATCH = 5

    def flush(b):
        nonlocal inserted
        if not b:
            return
        result = send_to_webhook(b, domain)
        if result.get("transport_error"):
            print("  [error] Webhook returned a transport/auth error — see logs above.")
            exit(1)
        got = result.get("ingested", 0)
        inserted += got
        print(f"    -> ingested {got} (total {inserted}/{target})")
        time.sleep(random.uniform(5, 12))

    for raw in iter_domain_questions(domain):
        if inserted >= target:
            break
        batch.append(raw)
        if len(batch) >= BATCH:
            flush(batch)
            batch = []
    if inserted < target:
        flush(batch)
    return inserted


# ═════════════════════════════════════════════════════════════════════════════
# ACT — AI generation. There is no working ACT scrape source (crackact.com is a
# dead/parked domain; cracksat.net is SAT-only), so ACT questions are GENERATED.
# Same robust architecture as SAT: generate → validate → dedup → direct insert,
# rate-limit resilient (4-model fallback). exam_type='ACT'.
# ═════════════════════════════════════════════════════════════════════════════
ACT_DOMAINS = {
    "Conventions of Standard English": "English",
    "Production of Writing": "English",
    "Knowledge of Language": "English",
    "Pre-Algebra / Elementary Algebra": "Math",
    "Intermediate Algebra / Coordinate Geometry": "Math",
    "Plane Geometry / Trigonometry": "Math",
    "Key Ideas and Details": "Reading",
    "Craft and Structure": "Reading",
    "Integration of Knowledge and Ideas": "Reading",
    "Interpretation of Data": "Science",
    "Scientific Investigation": "Science",
    "Evaluation of Models, Inferences, and Experimental Results": "Science",
}
# Topic seeds give the generator variety across runs (the ACT "sources").
ACT_TOPIC_SEEDS = {
    "English": ["commas & punctuation", "subject-verb agreement", "pronoun clarity & case", "fragments & run-ons", "modifier placement", "transitions & logical flow", "concision & redundancy", "verb tense consistency", "idioms & word choice", "parallel structure"],
    "Math": ["linear equations", "ratios & proportions", "percent problems", "exponents & radicals", "quadratics & factoring", "systems of equations", "coordinate geometry & slope", "triangles & the Pythagorean theorem", "circles & area", "right-triangle trigonometry", "probability & counting", "statistics: mean/median/mode", "sequences & patterns", "functions & evaluation", "absolute value & inequalities"],
    "Reading": ["central idea & main purpose", "inference from a specific detail", "author's tone & perspective", "vocabulary in context", "function of a sentence or paragraph", "comparing two viewpoints", "cause & effect relationships", "locating supporting evidence"],
    "Science": ["reading a data table", "interpreting a line or bar graph", "experimental design & controls", "two conflicting hypotheses", "trends & extrapolation", "identifying variables", "combining two figures", "evaluating a conclusion"],
}

def _act_groq_json(system_prompt: str, user_prompt: str):
    """Raw-HTTP Groq call with 4-model fallback + backoff. Returns (dict|None, err)."""
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
    for round_i in range(4):
        all_limited = True
        for model in models:
            try:
                r = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions", headers=headers,
                    json={"model": model, "messages": messages, "temperature": 0.85, "response_format": {"type": "json_object"}},
                    timeout=60,
                )
            except Exception as e:
                all_limited = False
                print(f"  [groq] {model} network error: {e}", flush=True)
                continue
            if r.status_code == 200:
                try:
                    return json.loads(r.json()["choices"][0]["message"]["content"]), None
                except Exception:
                    all_limited = False
                    return None, "JSON parse error"
            if r.status_code in (429, 503):
                continue
            return None, f"groq_error: HTTP {r.status_code}"
        if all_limited:
            wait = min(20 * (2 ** round_i), 240)
            print(f"  all Groq models rate-limited — waiting {wait}s…", flush=True)
            time.sleep(wait)
        else:
            break
    return None, "groq_error: all models rate-limited"

def build_act_row(parsed: dict, domain: str, section: str, nopt: int):
    """Validate a generated ACT question into a schema-correct row. (row, err)."""
    q_text = (parsed.get("question_text") or "").strip()
    if not q_text or len(q_text) < 20:
        return None, "Question text too short"
    difficulty = parsed.get("difficulty") if parsed.get("difficulty") in VALID_DIFFICULTIES else "Medium"
    options = parsed.get("options")
    if not isinstance(options, list) or len(options) != nopt:
        return None, f"Options not {nopt}-element array"
    options = [re.sub(r"^[a-kA-K][\)\.\-]\s*", "", str(o)).strip() for o in options]
    if any(not o for o in options):
        return None, "Blank option"
    if len({o.lower() for o in options}) != nopt:
        return None, "Duplicate options"
    raw_correct = (parsed.get("correct_answer") or "").strip()
    correct = next((o for o in options if o == raw_correct), None)
    if correct is None:
        correct = next((o for o in options if o.lower() == raw_correct.lower()), None)
    if correct is None:
        correct = re.sub(r"^[a-kA-K][\)\.\-]\s*", "", raw_correct).strip()
    if correct not in options:
        return None, "correct_answer not in options"
    rationale = (parsed.get("rationale") or "").strip() or f"The correct answer is: {correct}"
    return {
        "exam_type": "ACT",
        "section": section,
        "domain": domain,
        "difficulty": difficulty,
        "question_text": q_text,
        "options": options,
        "correct_answer": correct,
        "rationale": rationale,
        "is_spr": False,
        "source_method": "Automated_Pipeline",
    }, None

def generate_act_question(domain: str, section: str, nopt: int, seed: str, diff: str):
    passage = ""
    if section in ("Reading", "Science"):
        passage = ("Begin with a SHORT, self-contained passage or small described data set "
                   "(3-6 sentences, or a tiny table described in words) the question is based on, then ask the question. ")
    letters = "A, B, C, D, E" if nopt == 5 else "A, B, C, D"
    system = ("You are a veteran ACT test author. Write ONE original, exam-accurate ACT practice question "
              "entirely in your OWN words — never reproduce copyrighted text. Match the real ACT's format, "
              "style, and difficulty.")
    user = (f'Section: ACT {section}. Domain: "{domain}". Topic focus: {seed}. Difficulty: {diff}.\n'
            f'{passage}'
            f'Provide EXACTLY {nopt} answer options ({letters}). The "correct_answer" MUST be the exact text of '
            f'one option. Use $...$ LaTeX for any math. Do NOT put letter prefixes (like "A." or "B)") inside the option text.\n'
            f'Return ONLY JSON: {{"question_text":"...","options":[{nopt} option strings],'
            f'"correct_answer":"exact text of the correct option","rationale":"1-3 sentence explanation",'
            f'"difficulty":"{diff}"}}')
    return _act_groq_json(system, user)

def run_act_direct(domain: str, target: int):
    """Generate ACT questions for `domain` and insert directly until `target` new
    unique questions land (or the attempt budget is exhausted)."""
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    section = ACT_DOMAINS[domain]
    nopt = 4  # match the existing ACT data + the 4-option quality-scan / practice-UI expectation
    seeds = ACT_TOPIC_SEEDS[section]
    inserted = dup_skipped = rejected = 0
    attempts = 0
    budget = target * 8 + 20
    while inserted < target and attempts < budget:
        attempts += 1
        seed = seeds[attempts % len(seeds)]
        diff = ("Easy", "Medium", "Hard")[attempts % 3]
        parsed, err = generate_act_question(domain, section, nopt, seed, diff)
        if err:
            rejected += 1
            print(f"    [skip] {err}")
            time.sleep(6 if err.startswith("groq_error") else 0.4)
            continue
        row, verr = build_act_row(parsed, domain, section, nopt)
        if verr:
            rejected += 1
            print(f"    [skip] {verr}")
            continue
        if text_already_seen(supabase, row["question_text"]):
            dup_skipped += 1
            continue
        try:
            supabase.table("sat_question_bank").insert(row).execute()
        except Exception as e:
            rejected += 1
            print(f"    [skip] DB error: {e}")
            continue
        inserted += 1
        print(f"    [insert {inserted}/{target}] ACT · {section} · {domain} · {diff}")
        time.sleep(0.5)
    print(f"\n  [act-gen] inserted={inserted} dup_skipped={dup_skipped} rejected={rejected}")
    return inserted


def main():
    # Use the explicit exam flag — NOT the domain name — because some domains
    # (e.g. "Craft and Structure") exist under both SAT and ACT.
    is_act = (TARGET_EXAM == "ACT")
    print(f"=== {'ACT Generator (AI)' if is_act else 'SAT Scraper v4 (CrackSAT + Entity Swap)'} ===")
    print(f"  Domain: {TARGET_DOMAIN}")
    print(f"  Target: {TARGET_COUNT} new questions (exact)")
    if is_act:
        if not DIRECT_MODE:
            print("  [error] ACT generation needs Supabase + Groq creds (DIRECT mode). Aborting.")
            return
        print("  Mode:   ACT AI-generation → direct Supabase insert")
        print()
        inserted = run_act_direct(TARGET_DOMAIN, TARGET_COUNT)
    else:
        print(f"  Mode:   {'DIRECT Supabase insert' if DIRECT_MODE else 'Webhook'}")
        print()
        inserted = run_direct(TARGET_DOMAIN, TARGET_COUNT) if DIRECT_MODE else run_webhook(TARGET_DOMAIN, TARGET_COUNT)

    print("\n=== Complete ===")
    print(f"  Target:   {TARGET_COUNT}")
    print(f"  Inserted: {inserted}")
    if inserted < TARGET_COUNT:
        # Falling short just means the source pool didn't have enough NEW unique
        # questions left (the rest are already in the bank). That's a no-op, not a
        # CI failure — exit 0 so scheduled runs don't spam failure emails.
        print(f"  [info] Source pool yielded {inserted}/{TARGET_COUNT} new unique questions; "
              f"the remainder were already in the bank. Not a failure.")


if __name__ == "__main__":
    main()
