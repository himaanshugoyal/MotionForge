/**
 * AI Service Driver for MotionForge AI
 * Handles client-side API requests to Gemini, OpenAI, and Anthropic,
 * webpage crawling via a CORS proxy (legacy), and multi-scene HyperFrames projects.
 */

// Crawl an external webpage using a sequence of public CORS proxies for high reliability
export async function scrapeWebsite(url) {
  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    let htmlString = '';
    let lastError = null;

    const proxies = [
      {
        name: 'CORSproxy.io',
        getUrl: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
        parse: async (res) => res.text()
      },
      {
        name: 'AllOrigins',
        getUrl: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
        parse: async (res) => {
          const json = await res.json();
          return json.contents;
        }
      },
      {
        name: 'Codetabs Proxy',
        getUrl: (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
        parse: async (res) => res.text()
      }
    ];

    for (const proxy of proxies) {
      try {
        const response = await fetch(proxy.getUrl(targetUrl));
        if (response.ok) {
          const contents = await proxy.parse(response);
          if (contents && contents.trim().length > 100) {
            htmlString = contents;
            break;
          }
        }
      } catch (err) {
        console.warn(`Proxy ${proxy.name} failed:`, err);
        lastError = err;
      }
    }

    if (!htmlString) {
      throw new Error(lastError ? lastError.message : 'All public CORS proxies failed to fetch the website content.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const title = doc.title || 'Untitled Webpage';

    let description = '';
    const metaDesc = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
    if (metaDesc) {
      description = metaDesc.getAttribute('content') || '';
    }

    const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
      .map((h) => h.textContent.trim())
      .slice(0, 10)
      .join('\n- ');

    const paragraphs = Array.from(doc.querySelectorAll('p'))
      .map((p) => p.textContent.trim())
      .filter((t) => t.length > 20)
      .slice(0, 8)
      .join('\n');

    return `WEBPAGE CONTENT CRAWLED:
Title: ${title}
Description: ${description}

Key Headings:
- ${headings}

Sample Page Text:
${paragraphs.substring(0, 1500)}`;
  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Could not crawl website: ${error.message}. Try copy-pasting raw HTML instead.`);
  }
}

const SCENE_SYSTEM_PROMPT = `You are an expert cinematic motion graphics director building HyperFrames HTML video scenes.
Analyze the inputs (PDF text, website brief, screenshots, or prompts) and generate a multi-scene animated video project.
Your response MUST be a single raw JSON object. No markdown fences, no commentary.

JSON schema:
{
  "aspectRatio": "landscape" | "portrait" | "square",
  "name": "Short project title",
  "brand": {
    "colors": ["#0a0a0f", "#67e8f9", "#a855f7", "#ffffff"],
    "fonts": ["Outfit", "Inter"]
  },
  "scenes": [
    {
      "title": "Scene headline (short)",
      "subtitle": "Optional supporting line",
      "template": "title-card" | "bullet-explainer" | "screenshot-kenburns" | "quote" | "cta-outro",
      "duration": 4.0,
      "bullets": ["Only for bullet-explainer, 3-5 short points"],
      "imageUrl": "optional absolute or /api/... screenshot URL for ken-burns",
      "background": { "type": "gradient" | "color" | "image", "value": "css color, gradient, or image url" },
      "accentColor": "#67e8f9",
      "transition": "fade",
      "layers": []
    }
  ],
  "overlays": [
    {
      "id": "optional-compat-overlay",
      "name": "Legacy overlay name",
      "text": "Short overlay text",
      "start": 1.0,
      "duration": 3.0,
      "fontSize": 48,
      "textColor": "#ffffff",
      "accentColor": "#67e8f9",
      "x": 50,
      "y": 40,
      "trackIndex": 1,
      "animationType": "neon" | "spring" | "cyberpunk" | "fade" | "progress"
    }
  ]
}

Rules:
1. Produce 4–8 scenes that tell a clear narrative: hook → points → visual proof → CTA.
2. Prefer "screenshot-kenburns" when screenshot/image asset URLs are provided.
3. Prefer "bullet-explainer" for PDF section summaries.
4. End with "cta-outro".
5. Keep titles under 8 words; bullets under 12 words each.
6. Also include a flat "overlays" array (6–12 items) for the live canvas editor, timed across the full video.
7. videoDuration is implied by sum of scene durations; also set "videoDuration" to that sum.
8. Use brand colors from the content brief when provided.`;

/**
 * Generate a multi-scene HyperFrames project (+ legacy overlays for canvas editing).
 */
export async function generateAIComposition({
  provider,
  model,
  apiKey,
  promptText,
  fileBase64,
  pdfText,
  webpageText,
  contentBrief = null,
  imageBase64 = null,
  imageMimeType = 'image/png',
  proxyUrl = ''
}) {
  const briefBlock = contentBrief
    ? `\n\nCONTENT BRIEF (JSON):\n${JSON.stringify(contentBrief, null, 2)}`
    : '';

  const userQuery = `Prompt/Goal: ${promptText || 'Create a high-graphic animated product explainer video.'}
${webpageText ? `\n\nCrawled Website Data:\n${webpageText}` : ''}
${pdfText ? `\n\nExtracted PDF Text:\n${pdfText}` : ''}
${briefBlock}
${fileBase64 && provider === 'gemini' ? `\n\n[PDF Source Document attached as binary]` : ''}
${imageBase64 && provider === 'gemini' ? `\n\n[Screenshot/image attached as binary — use for ken-burns scenes]` : ''}`;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const parts = [{ text: `${SCENE_SYSTEM_PROMPT}\n\n${userQuery}` }];

    if (fileBase64) {
      parts.unshift({
        inlineData: { mimeType: 'application/pdf', data: fileBase64 }
      });
    }
    if (imageBase64) {
      parts.unshift({
        inlineData: { mimeType: imageMimeType || 'image/png', data: imageBase64 }
      });
    }

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return normalizeAIResult(parseJSONContent(rawText));
  }

  if (provider === 'openai') {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model,
      messages: [
        { role: 'system', content: SCENE_SYSTEM_PROMPT },
        { role: 'user', content: userQuery }
      ],
      response_format: { type: 'json_object' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `OpenAI API returned status ${res.status}`);
    }

    const data = await res.json();
    return normalizeAIResult(parseJSONContent(data.choices?.[0]?.message?.content));
  }

  if (provider === 'claude') {
    const baseUrl = proxyUrl || 'https://api.anthropic.com/v1/messages';
    const payload = {
      model,
      max_tokens: 5000,
      system: SCENE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userQuery }]
    };

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Claude API returned status ${res.status}: ${errText || res.statusText}`);
    }

    const data = await res.json();
    return normalizeAIResult(parseJSONContent(data.content?.[0]?.text));
  }

  throw new Error('Unsupported API provider selected.');
}

const ENHANCE_PROMPT_SYSTEM = `You are an expert AI video prompt engineer. Your job is to take a basic user prompt and any provided context (like website text or document summaries), and rewrite the prompt into a highly descriptive, vivid, and optimized prompt for an AI video generation agent.
Return ONLY the raw prompt text string. Do not wrap in quotes or markdown. Make it compelling, structured, and focused on visual storytelling, motion design, and key messaging.`;

export async function enhanceAIPrompt({
  provider,
  model,
  apiKey,
  promptText,
  pdfText,
  webpageText,
  contentBrief,
  proxyUrl = ''
}) {
  const briefBlock = contentBrief
    ? `\n\nCONTENT BRIEF:\n${JSON.stringify(contentBrief, null, 2)}`
    : '';

  const userQuery = `Current Prompt/Goal: ${promptText || '(None provided, suggest one based on the context)'}
${webpageText ? `\n\nCrawled Website Data:\n${webpageText}` : ''}
${pdfText ? `\n\nExtracted PDF Text:\n${pdfText}` : ''}
${briefBlock}

Rewrite or auto-suggest a professional motion graphics video prompt based on this.`;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: `${ENHANCE_PROMPT_SYSTEM}\n\n${userQuery}` }] }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }

  if (provider === 'openai') {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model,
      messages: [
        { role: 'system', content: ENHANCE_PROMPT_SYSTEM },
        { role: 'user', content: userQuery }
      ]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `OpenAI API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  if (provider === 'claude') {
    const baseUrl = proxyUrl || 'https://api.anthropic.com/v1/messages';
    const payload = {
      model,
      max_tokens: 2000,
      system: ENHANCE_PROMPT_SYSTEM,
      messages: [{ role: 'user', content: userQuery }]
    };

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Claude API returned status ${res.status}: ${errText || res.statusText}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text?.trim() || '';
  }

  throw new Error('Unsupported API provider selected.');
}

function parseJSONContent(text) {
  if (!text) throw new Error('Empty response from AI model.');

  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
  else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
  if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Failed to parse AI output:', cleanText);
    throw new Error(`Failed to parse AI response into video tracks: ${err.message}`);
  }
}

/**
 * Normalize AI JSON into { aspectRatio, videoDuration, overlays, scenes, brand, name }
 * so both the new scene editor and legacy overlay canvas work.
 */
function normalizeAIResult(parsed) {
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : null;
  let overlays = Array.isArray(parsed.overlays) ? parsed.overlays : [];

  const sceneDuration = scenes
    ? scenes.reduce((sum, s) => sum + (Number(s.duration) || 4), 0)
    : 0;

  const videoDuration = Number(parsed.videoDuration) || sceneDuration || 10;
  const aspectRatio = parsed.aspectRatio || 'landscape';

  // Synthesize overlays from scenes if missing
  if (!overlays.length && scenes?.length) {
    let t = 0;
    overlays = scenes.flatMap((scene, i) => {
      const items = [
        {
          id: `ai-scene-${i}-title`,
          name: scene.title || `Scene ${i + 1}`,
          text: scene.title || `Scene ${i + 1}`,
          start: t + 0.25,
          duration: Math.min(3.2, (scene.duration || 4) - 0.4),
          fontSize: scene.template === 'title-card' ? 64 : 42,
          textColor: '#ffffff',
          accentColor: scene.accentColor || parsed.brand?.colors?.[1] || '#67e8f9',
          x: 50,
          y: scene.template === 'cta-outro' ? 40 : 35,
          trackIndex: i + 1,
          animationType: scene.template === 'cta-outro' ? 'spring' : 'neon'
        }
      ];
      (scene.bullets || []).slice(0, 3).forEach((b, bi) => {
        items.push({
          id: `ai-scene-${i}-b${bi}`,
          name: `Bullet ${bi + 1}`,
          text: b,
          start: t + 0.8 + bi * 0.7,
          duration: 2.4,
          fontSize: 28,
          textColor: '#ffffff',
          accentColor: scene.accentColor || '#67e8f9',
          x: 50,
          y: 55 + bi * 10,
          trackIndex: i + 10 + bi,
          animationType: 'fade'
        });
      });
      t += scene.duration || 4;
      return items;
    });
  }

  if (!overlays.length) {
    throw new Error('Invalid AI JSON: missing scenes and overlays');
  }

  return {
    name: parsed.name || 'AI Composition',
    aspectRatio,
    videoDuration,
    brand: parsed.brand || {
      colors: ['#0a0a0f', '#67e8f9', '#a855f7', '#ffffff'],
      fonts: ['Outfit', 'Inter']
    },
    scenes: scenes || null,
    overlays,
    sourceMeta: parsed.sourceMeta || null
  };
}

/**
 * Build a local content brief from PDF text (client-side).
 */
export function briefFromPdfText(pdfText, filename = 'document.pdf') {
  const lines = String(pdfText || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const headings = lines.filter((l) => l.length < 80 && !l.endsWith('.')).slice(0, 8);
  const bullets = lines.filter((l) => l.length > 40).slice(0, 6).map((l) => l.slice(0, 120));

  return {
    title: headings[0] || filename.replace(/\.pdf$/i, ''),
    bullets,
    sections: headings.slice(0, 5).map((h) => ({
      heading: h,
      points: ['Summarize key idea', 'Add a supporting visual beat']
    })),
    assets: [],
    brand: { colors: ['#0a0a0f', '#67e8f9', '#ffffff'], fonts: ['Outfit', 'Inter'] },
    sourceType: 'document',
    rawNotes: String(pdfText || '').slice(0, 6000)
  };
}
