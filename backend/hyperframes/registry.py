"""
HyperFrames Registry Blocks & Components Catalog.
Inspired by heygen-com/hyperframes registry system.
Provides installable, customizable visual blocks (HTML + CSS + GSAP)
that can be injected into any timeline StoryBeat.
"""

from typing import List, Dict, Any

BLOCKS_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "beat-freeze-cut",
        "name": "Beat Freeze Cut",
        "category": "transitions",
        "description": "Dramatic speed ramp & freeze-frame impact on beat hits with kinetic typography and cyber accent lines.",
        "author": "heygen-com/hyperframes",
        "tags": ["impact", "kinetic", "high-energy", "freeze", "transition"],
        "default_duration": 2.5,
        "track_kind": "graphics",
        "track_index": 0,
        "html": """<div class="clip block-beat-freeze-cut" data-start="{start}" data-duration="{duration}" data-track-index="0" data-track-kind="graphics" id="{element_id}">
  <div class="bfc-backdrop"></div>
  <div class="bfc-content">
    <div class="bfc-badge">{badge_text}</div>
    <h2 class="bfc-title">{title_text}</h2>
    <div class="bfc-subline">{sub_text}</div>
  </div>
</div>""",
        "css": """.block-beat-freeze-cut {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}
.bfc-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(10,10,10,0.5) 0%, rgba(0,0,0,0.85) 100%);
  opacity: 0;
}
.bfc-content {
  text-align: center;
  opacity: 0;
}
.bfc-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #22c55e;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 4px;
  margin-bottom: 12px;
}
.bfc-title {
  font-family: 'Inter', sans-serif;
  font-size: 64px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-shadow: 0 8px 30px rgba(0,0,0,0.8);
}
.bfc-subline {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  color: #a0a0a0;
  margin-top: 10px;
}""",
        "gsap_tween": """// Beat Freeze Cut timeline
tl.fromTo("#{element_id} .bfc-backdrop", { opacity: 0 }, { opacity: 0.75, duration: 0.15, ease: "power2.out" }, {start});
tl.fromTo("#{element_id} .bfc-content", { scale: 0.8, opacity: 0 }, { scale: 1.0, opacity: 1, duration: 0.25, ease: "back.out(2)" }, {start} + 0.05);
tl.to("#{element_id} .bfc-content", { scale: 1.05, opacity: 0, duration: 0.2, ease: "power2.in" }, {start} + {duration} - 0.25);
tl.to("#{element_id} .bfc-backdrop", { opacity: 0, duration: 0.2, ease: "power2.in" }, {start} + {duration} - 0.2);"""
    },
    {
        "id": "kinetic-title",
        "name": "Kinetic Title Card",
        "category": "titles",
        "description": "Punchy spring-eased hero title card with high-contrast typography, blur-in entrance and clean exit.",
        "author": "heygen-com/hyperframes",
        "tags": ["title", "typography", "hero", "branding", "bold"],
        "default_duration": 3.0,
        "track_kind": "graphics",
        "track_index": 0,
        "html": """<div class="clip block-kinetic-title" data-start="{start}" data-duration="{duration}" data-track-index="0" data-track-kind="graphics" id="{element_id}">
  <div class="kt-card">
    <div class="kt-overline" data-layout-ignore="true">{badge_text}</div>
    <h1 class="kt-heading">{title_text}</h1>
    <p class="kt-tagline">{sub_text}</p>
  </div>
</div>""",
        "css": """.block-kinetic-title {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 25;
}
.kt-card {
  max-width: 960px;
  text-align: center;
  padding: 32px 48px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}
.kt-overline {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 8px;
}
.kt-heading {
  font-family: 'Inter', sans-serif;
  font-size: 72px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.04em;
  line-height: 1.0;
  text-shadow: 0 10px 40px rgba(0,0,0,0.9);
}
.kt-tagline {
  font-family: 'Inter', sans-serif;
  font-size: 22px;
  font-weight: 500;
  color: #e4e4e7;
  margin-top: 16px;
  letter-spacing: -0.01em;
}""",
        "gsap_tween": """// Kinetic Title timeline
tl.fromTo("#{element_id} .kt-heading", { y: 40, opacity: 0, filter: "blur(12px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "power4.out" }, {start});
tl.fromTo("#{element_id} .kt-overline", { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, {start} + 0.1);
tl.fromTo("#{element_id} .kt-tagline", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, {start} + 0.25);
tl.to("#{element_id} .kt-card", { y: -30, opacity: 0, filter: "blur(8px)", duration: 0.3, ease: "power3.in" }, {start} + {duration} - 0.3);"""
    },
    {
        "id": "ai-chat-reveal",
        "name": "AI Prompt Terminal",
        "category": "overlays",
        "description": "Agentic terminal window with syntax-highlighted prompt and typing response cursor.",
        "author": "heygen-com/hyperframes",
        "tags": ["agent", "terminal", "code", "ai", "prompt"],
        "default_duration": 3.5,
        "track_kind": "graphics",
        "track_index": 0,
        "html": """<div class="clip block-ai-chat" data-start="{start}" data-duration="{duration}" data-track-index="0" data-track-kind="graphics" id="{element_id}">
  <div class="ac-window">
    <div class="ac-header">
      <div class="ac-dots">
        <span class="ac-dot ac-red"></span>
        <span class="ac-dot ac-yellow"></span>
        <span class="ac-dot ac-green"></span>
      </div>
      <div class="ac-title">hyperframes-agent ~ director.sh</div>
    </div>
    <div class="ac-body">
      <div class="ac-line"><span class="ac-prompt">agent&gt;</span> <span class="ac-cmd">{title_text}</span></div>
      <div class="ac-response">{sub_text} <span class="ac-cursor">_</span></div>
    </div>
  </div>
</div>""",
        "css": """.block-ai-chat {
  position: absolute;
  bottom: 80px;
  right: 80px;
  z-index: 30;
  pointer-events: none;
}
.ac-window {
  width: 580px;
  background: rgba(20, 20, 20, 0.92);
  backdrop-filter: blur(16px);
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  overflow: hidden;
  font-family: 'IBM Plex Mono', monospace;
}
.ac-header {
  height: 36px;
  background: #181818;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-bottom: 1px solid #2a2a2a;
}
.ac-dots {
  display: flex;
  gap: 6px;
}
.ac-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.ac-red { background: #ef4444; }
.ac-yellow { background: #f59e0b; }
.ac-green { background: #22c55e; }
.ac-title {
  margin-left: 14px;
  font-size: 11px;
  color: #71717a;
}
.ac-body {
  padding: 16px 18px;
  font-size: 13px;
  line-height: 1.6;
}
.ac-line { color: #f5f5f5; }
.ac-prompt { color: #a78bfa; font-weight: 600; }
.ac-cmd { color: #3b82f6; }
.ac-response { color: #22c55e; margin-top: 8px; }
.ac-cursor { animation: blink 1s infinite; color: #a78bfa; font-weight: 700; }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }""",
        "gsap_tween": """// AI Chat Reveal timeline
tl.fromTo("#{element_id} .ac-window", { y: 30, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1.0, duration: 0.35, ease: "power3.out" }, {start});
tl.fromTo("#{element_id} .ac-response", { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "steps(1)" }, {start} + 0.6);
tl.to("#{element_id} .ac-window", { y: 20, opacity: 0, duration: 0.25, ease: "power2.in" }, {start} + {duration} - 0.25);"""
    },
    {
        "id": "callout-card",
        "name": "Feature Callout Card",
        "category": "cards",
        "description": "Minimalist glassmorphic callout card for highlighting product features or key metrics.",
        "author": "heygen-com/hyperframes",
        "tags": ["callout", "glassmorphism", "feature", "product", "card"],
        "default_duration": 3.0,
        "track_kind": "graphics",
        "track_index": 0,
        "html": """<div class="clip block-callout-card" data-start="{start}" data-duration="{duration}" data-track-index="0" data-track-kind="graphics" id="{element_id}">
  <div class="cc-box">
    <div class="cc-icon-pill">&#x2728; FEATURE</div>
    <h3 class="cc-headline">{title_text}</h3>
    <p class="cc-desc">{sub_text}</p>
  </div>
</div>""",
        "css": """.block-callout-card {
  position: absolute;
  top: 80px;
  left: 80px;
  z-index: 25;
  pointer-events: none;
}
.cc-box {
  background: rgba(20, 20, 20, 0.88);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 24px 28px;
  max-width: 440px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
}
.cc-icon-pill {
  display: inline-block;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #fbbf24;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.cc-headline {
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #f5f5f5;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.cc-desc {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: #a0a0a0;
  margin-top: 8px;
  line-height: 1.5;
}""",
        "gsap_tween": """// Callout Card timeline
tl.fromTo("#{element_id} .cc-box", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, {start});
tl.to("#{element_id} .cc-box", { x: -30, opacity: 0, duration: 0.25, ease: "power2.in" }, {start} + {duration} - 0.25);"""
    },
    {
        "id": "camcorder-hud",
        "name": "Camcorder HUD Viewfinder",
        "category": "overlays",
        "description": "Retro/tactical camera viewfinder overlay with REC indicator, dynamic battery, crosshairs and SMPTE timecode.",
        "author": "heygen-com/hyperframes",
        "tags": ["hud", "rec", "viewfinder", "vintage", "camera"],
        "default_duration": 4.0,
        "track_kind": "graphics",
        "track_index": 0,
        "html": """<div class="clip block-camcorder-hud" data-start="{start}" data-duration="{duration}" data-track-index="0" data-track-kind="graphics" id="{element_id}">
  <div class="ch-corner ch-tl"></div>
  <div class="ch-corner ch-tr"></div>
  <div class="ch-corner ch-bl"></div>
  <div class="ch-corner ch-br"></div>
  <div class="ch-crosshair">+</div>
  <div class="ch-top-bar">
    <div class="ch-rec"><span class="ch-rec-dot"></span> REC</div>
    <div class="ch-format">4K 60FPS · RAW</div>
  </div>
  <div class="ch-bottom-bar">
    <div class="ch-tc">TC 00:00:12:18</div>
    <div class="ch-bat">&#9646;&#9646;&#9646;&#9647; 88%</div>
  </div>
</div>""",
        "css": """.block-camcorder-hud {
  position: absolute;
  inset: 40px;
  pointer-events: none;
  z-index: 15;
  font-family: 'IBM Plex Mono', monospace;
}
.ch-corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 2px solid rgba(255,255,255,0.4);
}
.ch-tl { top: 0; left: 0; border-right: none; border-bottom: none; }
.ch-tr { top: 0; right: 0; border-left: none; border-bottom: none; }
.ch-bl { bottom: 0; left: 0; border-right: none; border-top: none; }
.ch-br { bottom: 0; right: 0; border-left: none; border-top: none; }
.ch-crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255,255,255,0.3);
  font-size: 24px;
}
.ch-top-bar, .ch-bottom-bar {
  position: absolute;
  left: 40px;
  right: 40px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #e5e5e5;
}
.ch-top-bar { top: 10px; }
.ch-bottom-bar { bottom: 10px; }
.ch-rec {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ef4444;
  font-weight: 700;
}
.ch-rec-dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
}""",
        "gsap_tween": """// Camcorder HUD timeline
tl.fromTo("#{element_id}", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, {start});
tl.to("#{element_id}", { opacity: 0, duration: 0.3, ease: "power2.in" }, {start} + {duration} - 0.3);"""
    },
    {
        "id": "apple-money-count",
        "name": "Dynamic Metric Counter",
        "category": "data",
        "description": "Stepped count-up metric display with percentage delta and glass frame.",
        "author": "heygen-com/hyperframes",
        "tags": ["stats", "counter", "data", "metrics", "finance"],
        "default_duration": 3.0,
        "track_kind": "graphics",
        "track_index": 0,
        "html": """<div class="clip block-metric-counter" data-start="{start}" data-duration="{duration}" data-track-index="0" data-track-kind="graphics" id="{element_id}">
  <div class="mc-container">
    <div class="mc-label">{badge_text}</div>
    <div class="mc-value">{title_text}</div>
    <div class="mc-delta">&#x25B2; {sub_text}</div>
  </div>
</div>""",
        "css": """.block-metric-counter {
  position: absolute;
  top: 120px;
  right: 120px;
  z-index: 25;
  pointer-events: none;
}
.mc-container {
  background: rgba(18, 18, 20, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 22px 30px;
  text-align: right;
  box-shadow: 0 16px 40px rgba(0,0,0,0.6);
}
.mc-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: #a0a0a0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.mc-value {
  font-family: 'Inter', sans-serif;
  font-size: 52px;
  font-weight: 800;
  color: #f5f5f5;
  letter-spacing: -0.03em;
  margin: 4px 0;
}
.mc-delta {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #22c55e;
}""",
        "gsap_tween": """// Metric counter timeline
tl.fromTo("#{element_id} .mc-container", { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.5)" }, {start});
tl.to("#{element_id} .mc-container", { opacity: 0, duration: 0.25, ease: "power2.in" }, {start} + {duration} - 0.25);"""
    }
]

def get_registry_blocks() -> List[Dict[str, Any]]:
    """Returns all available HyperFrames registry blocks."""
    return BLOCKS_CATALOG

def get_block_by_id(block_id: str) -> Dict[str, Any]:
    """Retrieves a block by its identifier."""
    for b in BLOCKS_CATALOG:
        if b["id"] == block_id:
            return b
    return BLOCKS_CATALOG[0]

