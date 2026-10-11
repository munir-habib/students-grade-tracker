// Supabase Edge Function (Deno runtime) — extracts a grading structure (categories +
// planned assessments) from raw syllabus text using the Anthropic Messages API.
//
// NOTE: This function requires an `ANTHROPIC_API_KEY` secret on the Supabase project
// (`supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`). As of writing that secret has not
// been provisioned yet, so this function cannot be exercised end-to-end until it is added —
// the code below is complete and should work once the key exists.
//
// Model id note: `claude-sonnet-5` is the current (non-dated) alias for Claude Sonnet 5 as of
// this writing. Anthropic model ids/aliases change over time — if this call starts failing
// with a "model not found" style error, check https://docs.claude.com for the current id.
const ANTHROPIC_MODEL = 'claude-sonnet-5'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Output shape (also encoded as the forced tool-use schema below)
// ---------------------------------------------------------------------------

type ExtractedItem = {
  name: string
  pointsPossible: number
  date: string | null
}

type ExtractedCategory = {
  name: string
  weightPct: number | null
  items: ExtractedItem[]
}

type ExtractResult = {
  categories: ExtractedCategory[]
  warnings: string[]
}

const EXTRACTION_TOOL = {
  name: 'record_grading_structure',
  description:
    'Records the grading structure extracted from a course syllabus, plus any warnings about rules that could not be structured.',
  input_schema: {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        description: 'The grading categories found in the syllabus (e.g. Exams, Quizzes, Lab Practicals).',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Category name, e.g. "Exams" or "Quizzes".' },
            weightPct: {
              type: ['number', 'null'],
              description: 'Percentage weight of this category toward the final grade, or null if the course is points-based and no percentage is given.',
            },
            items: {
              type: 'array',
              description: 'Individual assessments within this category.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Assessment name, e.g. "Exam 1" or "Written exam 2".' },
                  pointsPossible: { type: 'number', description: 'Points possible for this individual item.' },
                  date: {
                    type: ['string', 'null'],
                    description: 'ISO date (YYYY-MM-DD) if the syllabus gives one for this item, otherwise null.',
                  },
                },
                required: ['name', 'pointsPossible', 'date'],
              },
            },
          },
          required: ['name', 'weightPct', 'items'],
        },
      },
      warnings: {
        type: 'array',
        description:
          'Verbatim (or near-verbatim) prose about gating rules, pass/fail requirements, minimum scores, ambiguous or unstructurable items, or anything else the student must read manually. Empty array if there is nothing to warn about.',
        items: { type: 'string' },
      },
    },
    required: ['categories', 'warnings'],
  },
}

const SYSTEM_PROMPT = `You are extracting the grading structure from a university course syllabus so it can be pre-populated into a grade-tracking app. The syllabus text you receive may be almost entirely running prose, may contain a small summary table, or may contain a fuller weighted table — do not assume a table exists; read the whole text.

The app's data model only understands: categories (with an optional percentage weight) containing individual assessment items (each with a name and a points-possible value, and an optional date). It has NO concept of gating rules, pass/fail requirements, minimum scores, "must pass X to earn Y", cumulative-threshold rules, or similar conditions.

Follow these rules exactly:

1. Expand parenthetical per-item point breakdowns into individual items. For example "Total Written Exams (Written exam 1/2/3) | 3 | 126 (39/48/39)" describes 3 exams worth 39, 48, and 39 points respectively — emit three separate items named "Written exam 1", "Written exam 2", "Written exam 3" with pointsPossible 39, 48, 39. Never emit that as a single 126-point item when a breakdown is given.

2. When only an aggregate count and total are given with NO per-item breakdown (e.g. "~9 quizzes, 18 points total, 2 dropped"), emit exactly ONE item for that row whose pointsPossible is the aggregate total, and whose name makes it obvious to the student that it is a combined placeholder they must split manually — e.g. "Quizzes (combined total — split into individual quizzes manually)". Do not guess how the aggregate splits across individual quizzes.

3. Put ANY pass/fail, gating, minimum-score, "must pass all N to pass the course", "must reach X% to earn other points", or similarly conditional prose into the warnings array, quoted verbatim or near-verbatim from the source text. Do NOT invent a structured field or rule for it, and do NOT silently drop it — this is critical, the student must see it.

4. If a category has no percentage weight stated anywhere (a purely points-based course), set weightPct to null rather than guessing a percentage.

5. If an item has no date given anywhere in the text, set date to null rather than guessing.

6. If something is genuinely ambiguous or you are not confident how to structure it, also add a note about it to warnings rather than fabricating structure.

7. Use your best judgment for category names and grouping when the syllabus is pure prose with no table at all.

Call the record_grading_structure tool exactly once with your complete extraction. Do not include any other commentary.`

// ---------------------------------------------------------------------------
// Validation of the model's tool_use input before we trust it
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidItem(value: unknown): value is ExtractedItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    isFiniteNumber(item.pointsPossible) &&
    (item.date === null || typeof item.date === 'string')
  )
}

function isValidCategory(value: unknown): value is ExtractedCategory {
  if (typeof value !== 'object' || value === null) return false
  const category = value as Record<string, unknown>
  return (
    typeof category.name === 'string' &&
    category.name.trim().length > 0 &&
    (category.weightPct === null || isFiniteNumber(category.weightPct)) &&
    Array.isArray(category.items) &&
    category.items.every(isValidItem)
  )
}

function isValidExtractResult(value: unknown): value is ExtractResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (
    Array.isArray(result.categories) &&
    result.categories.every(isValidCategory) &&
    Array.isArray(result.warnings) &&
    result.warnings.every((w) => typeof w === 'string')
  )
}

// ---------------------------------------------------------------------------
// Anthropic content block shapes we care about (subset — not the full SDK type)
// ---------------------------------------------------------------------------

type AnthropicToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

type AnthropicContentBlock = AnthropicToolUseBlock | { type: string; [key: string]: unknown }

type AnthropicMessageResponse = {
  content: AnthropicContentBlock[]
  stop_reason: string
  stop_details?: { type: string; category?: string | null; explanation?: string | null } | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405)
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid request body: expected JSON with a 'text' field." }, 400)
  }

  const text = (payload as Record<string, unknown> | null)?.text
  if (typeof text !== 'string' || text.trim().length === 0) {
    return jsonResponse({ error: "Missing or empty 'text' field. Provide the syllabus text to analyze." }, 400)
  }

  // Guard against pathologically large inputs blowing the context window / cost.
  const MAX_CHARS = 200_000
  const trimmedText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return jsonResponse(
      { error: 'Server is not configured: ANTHROPIC_API_KEY secret is missing. Ask the project owner to set it.' },
      500,
    )
  }

  let anthropicRes: Response
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmedText }],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: EXTRACTION_TOOL.name },
      }),
    })
  } catch (err) {
    console.error('extract-syllabus: network error calling Anthropic API', err)
    return jsonResponse({ error: 'Could not reach the AI service. Please try again.' }, 500)
  }

  if (!anthropicRes.ok) {
    let detail = ''
    try {
      detail = await anthropicRes.text()
    } catch {
      // ignore
    }
    console.error(`extract-syllabus: Anthropic API returned ${anthropicRes.status}`, detail)
    return jsonResponse(
      { error: `AI service returned an error (status ${anthropicRes.status}). Please try again later.` },
      502,
    )
  }

  let data: AnthropicMessageResponse
  try {
    data = (await anthropicRes.json()) as AnthropicMessageResponse
  } catch (err) {
    console.error('extract-syllabus: could not parse Anthropic API response as JSON', err)
    return jsonResponse({ error: 'AI service returned an unreadable response. Please try again.' }, 500)
  }

  if (data.stop_reason === 'refusal') {
    return jsonResponse(
      { error: 'The AI service declined to process this document. Try a different file or add assessments manually.' },
      502,
    )
  }

  const toolUseBlock = data.content?.find(
    (block): block is AnthropicToolUseBlock => block.type === 'tool_use' && block.name === EXTRACTION_TOOL.name,
  )

  if (!toolUseBlock) {
    console.error('extract-syllabus: no tool_use block in Anthropic response', JSON.stringify(data))
    return jsonResponse({ error: 'AI service did not return structured data. Please try again.' }, 500)
  }

  const parsedInput = toolUseBlock.input

  if (!isValidExtractResult(parsedInput)) {
    console.error('extract-syllabus: tool_use input failed shape validation', JSON.stringify(parsedInput))
    return jsonResponse({ error: 'AI service returned data in an unexpected shape. Please try again.' }, 500)
  }

  return jsonResponse(parsedInput satisfies ExtractResult, 200)
})
