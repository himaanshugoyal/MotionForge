/**
 * AI Service Driver for MotionForge AI
 * Handles client-side API requests to Gemini, OpenAI, and Anthropic,
 * webpage crawling via a CORS proxy, and PDF base64 payloads.
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
            break; // Got valid HTML content, stop trying
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

    // Parse HTML content in the browser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // Extract metadata
    const title = doc.title || 'Untitled Webpage';
    
    let description = '';
    const metaDesc = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
    if (metaDesc) {
      description = metaDesc.getAttribute('content') || '';
    }

    // Extract headers
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent.trim())
      .slice(0, 10)
      .join('\n- ');

    // Extract body paragraph paragraphs
    const paragraphs = Array.from(doc.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(t => t.length > 20)
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

// Generate the JSON composition payload using AI models
export async function generateAIComposition({
  provider,
  model,
  apiKey,
  promptText,
  fileBase64, // base64 string for PDF
  webpageText,
  proxyUrl = ''
}) {
  // 1. Build the system prompt rules and response structure
  const systemPrompt = `You are an expert cinematic motion graphics director and video editor.
Analyze the provided inputs (which may include webpage crawls, PDF documents, or prompts) and generate a timed video composition.
Your response MUST be a single, raw JSON object. Do NOT include markdown code blocks, do NOT write any intro or explanation.

The JSON schema must match exactly:
{
  "aspectRatio": "landscape" | "portrait" | "square",
  "videoDuration": 8, // length in seconds, default between 6 and 12
  "overlays": [
    {
      "id": "unique-id-string",
      "name": "Human-Readable Preset Name",
      "text": "Overlay text content (keep concise, fit for visual presentation)",
      "start": 1.5, // start time in seconds
      "duration": 4.0, // length visible in seconds
      "fontSize": 52, // font size in px (base 1080p width)
      "textColor": "#ffffff", // hex code
      "accentColor": "#a855f7", // accent hex code (for neon glows, badges, bars)
      "x": 50, // center x coordinate in % (0 - 100)
      "y": 40, // center y coordinate in % (0 - 100)
      "trackIndex": 1, // z-index ordering (1, 2, 3...)
      "animationType": "neon" | "spring" | "cyberpunk" | "fade" | "progress"
    }
  ]
}

Animation Types guide:
- "neon": Big bold glowing title (best for top titles, main features).
- "spring": Bouncy badge/bubble (best for tags, call-outs, labels).
- "cyberpunk": Glitched lower third (best for descriptions, names, tech logs).
- "fade": Standard subtitles/captions (best for long explanation text at bottom).
- "progress": Progress tracker (best for showing visual flow at bottom).

Ensure that:
1. Elements do not overlap in spatial coordinates (X and Y) at the same time.
2. Timings flow sequentially to create a narrative (e.g. Intro -> Core Point -> Highlight Badge -> CTA / End Progress).
3. The video duration encompasses all overlay timings.`;

  const userQuery = `Prompt/Goal: ${promptText || 'Create an engaging product showcase video.'}
${webpageText ? `\n\nCrawled Website Data:\n${webpageText}` : ''}
${fileBase64 ? `\n\n[PDF Source Document attached as binary]` : ''}`;

  // 2. Route request to selected provider
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const contents = [];
    
    // Add PDF base64 if present
    if (fileBase64) {
      contents.push({
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: fileBase64
            }
          },
          { text: `${systemPrompt}\n\n${userQuery}` }
        ]
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n${userQuery}` }]
      });
    }

    const payload = {
      contents,
      generationConfig: {
        responseMimeType: 'application/json'
      }
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
    return parseJSONContent(rawText);
  }

  else if (provider === 'openai') {
    const url = `https://api.openai.com/v1/chat/completions`;
    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
      ],
      response_format: { type: 'json_object' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `OpenAI API returned status ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    return parseJSONContent(rawText);
  }

  else if (provider === 'claude') {
    // Note: Anthropics has strict CORS controls. We route through a proxy if supplied, or direct fetch.
    const baseUrl = proxyUrl || 'https://api.anthropic.com/v1/messages';
    
    const payload = {
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userQuery }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerously-allow-host': 'true' // bypass library warning
    };

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Claude API returned status ${res.status}: ${errText || res.statusText}`);
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text;
    return parseJSONContent(rawText);
  }

  throw new Error('Unsupported API provider selected.');
}

// Extract JSON out of LLM text response safely
function parseJSONContent(text) {
  if (!text) throw new Error('Empty response from AI model.');
  
  let cleanText = text.trim();
  
  // Strip markdown code blocks if the model wrapped it in ```json ... ```
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  
  cleanText = cleanText.trim();
  
  try {
    const parsed = JSON.parse(cleanText);
    
    // Validate output structure
    if (!parsed.aspectRatio || !parsed.videoDuration || !Array.isArray(parsed.overlays)) {
      throw new Error('Invalid JSON structure. Missing required properties.');
    }
    
    return parsed;
  } catch (err) {
    console.error('Failed to parse AI output:', cleanText);
    throw new Error(`Failed to parse AI response into video tracks: ${err.message}`);
  }
}
