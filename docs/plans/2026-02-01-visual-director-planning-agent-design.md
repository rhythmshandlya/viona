# Visual Director Planning Agent Design

## Problem Statement

Current visual generation produces **basic animations** - elements slide in, fade up, and sit statically. The results look like animated PowerPoint slides, not professional explainer videos.

**What we get:**
- Cards that "slide in from left"
- Text that "fades up"
- Static backgrounds
- Elements that appear independently with no relationship
- Overlapping layouts due to no spatial planning

**What we need:**
- Visual systems with metaphors (REST API → client/server icons with traveling requests)
- Animated processes (request TRAVELS from client to server, not just "appears")
- Progressive build-up (start simple, add complexity as explanation progresses)
- Visuals that aid understanding, not just decorate

**Reference quality:** ByteByteGo explainer videos - where abstract technical concepts become visible, animated systems.

---

## Goals

1. **Conceptual visualization** - Transform abstract ideas into visual metaphors that aid understanding
2. **Process animation** - Show things HAPPENING (data traveling, systems processing) not just appearing
3. **Progressive disclosure** - Build complexity step-by-step synchronized with narration
4. **Professional quality** - Output worthy of YouTube explainer channels, not generic AI content
5. **Reliable execution** - Planning is validated before generation, reducing wasted iterations

---

## Architecture

### Current Pipeline (Problematic)

```
Transcript → Generator Agent (should plan + code) → Evaluator → Iterate
                     ↓
              Often skips planning
              Produces basic animations
```

### New Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: VISUAL DIRECTOR (Planning Agent)                      │
├─────────────────────────────────────────────────────────────────┤
│  Input: Transcript + style parameters                           │
│  Role: Creative Director - designs the visual explanation       │
│  Output: Visual Plan (structured JSON)                          │
│                                                                 │
│  Thinks about:                                                  │
│  • What concepts need visualization?                            │
│  • What metaphors represent each concept?                       │
│  • What processes need to be shown as animations?               │
│  • How does complexity build up over time?                      │
│  • What's the spatial layout and visual system?                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Visual Plan (JSON)
                              ↓
                    Plan Validator (programmatic)
                    • Required sections present?
                    • Entities have metaphors?
                    • Processes have animations?
                    • Spatial conflicts?
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: GENERATOR AGENT (Executor)                            │
├─────────────────────────────────────────────────────────────────┤
│  Input: Visual Plan + Remotion skills                           │
│  Role: Implementer - translates plan to code                    │
│  Output: Remotion TSX code                                      │
│                                                                 │
│  Does NOT make creative decisions - follows the plan            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: EVALUATOR (unchanged)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Separate Planning?

| Aspect | Inline Planning (Current) | Separate Planning Agent |
|--------|--------------------------|------------------------|
| Enforcement | Agent can skip planning | Planning MUST complete before code |
| Validation | Can't validate "did they plan?" | Structured output is parseable/validatable |
| Focus | Agent context-switches between planning and coding | Each agent has single responsibility |
| Cost | Bad plans discovered after expensive code generation | Bad plans fail fast before code gen |
| Quality | Planning is afterthought | Planning is the primary creative work |

---

## Visual Director Output Schema

The Planning Agent outputs a structured JSON document that fully specifies the visual explanation.

### Top-Level Structure

```json
{
  "meta": { },
  "concept_analysis": { },
  "visual_system": { },
  "scenes": [ ],
  "global_directives": { },
  "acceptance_criteria": [ ]
}
```

### 1. Meta

Basic project information. All of these are **provided by the frontend/worker**, not decided by the agent.

```json
{
  "meta": {
    "project_id": "{{input.projectId}}",
    "transcript_summary": "Agent-generated summary of transcript content",
    "total_duration_frames": "{{input.durationFrames}}",
    "fps": "{{input.fps}}",
    "canvas": {
      "width": "{{input.width}}",
      "height": "{{input.height}}",
      "orientation": "{{input.width < input.height ? 'vertical' : 'horizontal'}}"
    },
    "style_preset": "{{input.stylePreset}}",
    "layout_mode": "{{input.layoutMode}}"
  }
}
```

**Inputs from Frontend (GenerateVisualsJobData):**

| Input | Type | Example | Description |
|-------|------|---------|-------------|
| `projectId` | string | `"proj_abc123"` | Composition identifier |
| `stylePreset` | enum | `"modern"` | One of: minimal, modern, playful, bold, classic |
| `layoutMode` | enum | `"pip"` | One of: pip, split-horizontal, split-vertical |
| `width` | number | `1080` | Canvas width in pixels |
| `height` | number | `1920` | Canvas height in pixels |
| `durationMs` | number | `60000` | Total duration in milliseconds |
| `fps` | number | `30` | Frames per second |
| `transcript` | array | `[{text, startMs, endMs}]` | Word-level transcript with timing |

**Layout Mode Dimensions:**

| Layout Mode | Width | Height | Use Case |
|-------------|-------|--------|----------|
| `pip` | 1080 | 1920 | Full screen, video as small overlay |
| `split-horizontal` | 1080 | 960 | Top half, video on bottom |
| `split-vertical` | 540 | 1920 | Left half, video on right |

**Style Presets (with colors from STYLE_GUIDELINES):**

| Preset | Background | Primary | Accent | Animation Style |
|--------|------------|---------|--------|-----------------|
| `minimal` | #1a1a1a | #ffffff | #3b82f6 | Smooth, no bounce (damping: 20) |
| `modern` | #0f0f23 | #8b5cf6→#3b82f6 | #06b6d4 | Bouncy (damping: 12) |
| `playful` | #1a1a2e | #f97316 | #ec4899 | Very bouncy (damping: 8) |
| `bold` | #000000 | #ffffff | #ef4444 | Snappy (damping: 15) |
| `classic` | #1e3a5f | #d4af37 | #f5f5dc | Dignified (damping: 25) |

### 2. Concept Analysis

The Planning Agent's understanding of WHAT is being explained.

```json
{
  "concept_analysis": {
    "core_topic": "REST API communication",

    "key_entities": [
      {
        "name": "Client",
        "role": "Initiates requests, receives responses",
        "examples": ["browser", "mobile app"],
        "visual_importance": "primary"
      },
      {
        "name": "Server",
        "role": "Processes requests, sends responses",
        "examples": ["web server", "API endpoint"],
        "visual_importance": "primary"
      },
      {
        "name": "Request",
        "role": "Data sent from client to server",
        "properties": ["method", "endpoint", "headers", "body"],
        "visual_importance": "hero"
      },
      {
        "name": "Response",
        "role": "Data returned from server",
        "properties": ["status code", "data"],
        "visual_importance": "hero"
      }
    ],

    "relationships": [
      {
        "from": "Client",
        "to": "Server",
        "type": "sends",
        "what": "Request",
        "visualization": "traveling-object-along-path"
      },
      {
        "from": "Server",
        "to": "Client",
        "type": "returns",
        "what": "Response",
        "visualization": "traveling-object-along-path-reverse"
      }
    ],

    "processes": [
      {
        "name": "API Call Lifecycle",
        "steps": [
          "client prepares request",
          "request travels to server",
          "server receives and processes",
          "server prepares response",
          "response travels to client",
          "client receives and displays data"
        ],
        "is_core_animation": true
      }
    ],

    "abstract_concepts": [
      {
        "concept": "Statelessness",
        "meaning": "Each request is independent",
        "visualization_hint": "show multiple separate request/response cycles, no memory between them"
      },
      {
        "concept": "HTTP Methods",
        "meaning": "Different actions - GET, POST, PUT, DELETE",
        "visualization_hint": "color-code or icon-differentiate each method type"
      }
    ]
  }
}
```

### 3. Visual System

The creative decisions about HOW to visualize the concepts.

**IMPORTANT:**
- All positions use **percentages** (responsive to any canvas size)
- All sizes use **relative units** (percentage of canvas width/height)
- Colors reference **theme tokens** from frontend input (not hardcoded hex values)
- Typography references **theme fonts** from frontend input

```json
{
  "visual_system": {
    "metaphor_mapping": {
      "Client": {
        "visual": "laptop-computer-icon",
        "style": {
          "color": "theme.primary",
          "size_percent": 12,
          "glow": "subtle"
        },
        "personality": "active, initiating, waiting for results"
      },
      "Server": {
        "visual": "server-rack-icon",
        "style": {
          "color": "theme.secondary",
          "size_percent": 12
        },
        "personality": "stable, processing, powerful"
      },
      "Request": {
        "visual": "envelope-with-arrow-icon",
        "style": {
          "color": "theme.accent",
          "size_percent": 8
        },
        "personality": "traveling, carrying intent"
      },
      "Response": {
        "visual": "package-box-icon",
        "style": {
          "color": "theme.success",
          "size_percent": 8
        },
        "personality": "returning, delivering value"
      },
      "Connection": {
        "visual": "curved-dashed-line",
        "style": {
          "color": "theme.text_secondary",
          "opacity": 0.5,
          "animated": true,
          "dash_flow": "toward-server"
        },
        "personality": "the highway, always present"
      },
      "Data": {
        "visual": "small-rectangles-json-like",
        "style": {
          "color": "theme.text_secondary"
        },
        "personality": "the payload, what's being transferred"
      }
    },

    "visual_vocabulary": {
      "sending": {
        "animation": "object travels along curved path",
        "effects": ["motion trail", "slight scale pulse at start"]
      },
      "receiving": {
        "animation": "object absorbs into target",
        "effects": ["ripple on target", "brief glow"]
      },
      "processing": {
        "animation": "target pulses, internal activity",
        "effects": ["gear spin icon", "scanning line", "glow intensifies"]
      },
      "success": {
        "animation": "checkmark appears, celebration",
        "effects": ["theme.success pulse", "small particles burst"]
      },
      "failure": {
        "animation": "X appears, rejection",
        "effects": ["theme.error pulse", "shake"]
      },
      "waiting": {
        "animation": "pulsing indicator",
        "effects": ["breathing scale", "dot animation"]
      },
      "appearing": {
        "animation": "scale from 0 with spring",
        "effects": ["particle burst on arrival", "brief glow"]
      },
      "connecting": {
        "animation": "line draws from A to B",
        "effects": ["stroke-dashoffset reveal", "pulse when complete"]
      }
    },

    "color_system": {
      "note": "Colors come from stylePreset - reference by token name, not hex",
      "tokens": ["bg", "primary", "secondary", "accent", "success", "warning", "danger", "white", "text", "muted", "glass", "glassBorder"],
      "usage": {
        "Client": "style.primary",
        "Server": "style.secondary",
        "Request": "style.accent",
        "Response": "style.success",
        "Error": "style.danger",
        "Labels": "style.text",
        "Background": "style.bg"
      }
    },

    "typography": {
      "note": "Font family comes from stylePreset. Sizes are percentages of height.",
      "title": {
        "font": "style.font",
        "weight": 700,
        "size_percent": 4.5
      },
      "label": {
        "font": "style.font",
        "weight": 600,
        "size_percent": 3.2
      },
      "caption": {
        "font": "style.font",
        "weight": 400,
        "size_percent": 2.5
      },
      "code": {
        "font": "JetBrains Mono",
        "weight": 400,
        "size_percent": 2.2
      }
    },

    "spatial_layout": {
      "type": "horizontal-flow",
      "description": "Client on left, Server on right, connection between them",
      "positions": {
        "client_area": { "x_percent": 15, "y_percent": 40, "anchor": "center" },
        "server_area": { "x_percent": 85, "y_percent": 40, "anchor": "center" },
        "connection_path": { "type": "curved-arc", "bend": "upward", "height_percent": 20 },
        "label_area": { "y_percent": 75, "usage": "explanatory text and code snippets" },
        "title_area": { "y_percent": 10, "usage": "scene titles" }
      },
      "safe_zones": {
        "bottom": { "height_percent": 15, "reserved_for": "subtitles" },
        "edges": { "margin_percent": 5, "reserved_for": "breathing room" }
      }
    },

    "responsive_rules": {
      "description": "How elements adapt to different aspect ratios",
      "vertical_9_16": {
        "layout_bias": "vertical-stack-friendly",
        "max_horizontal_elements": 2,
        "prefer_vertical_connections": true
      },
      "horizontal_16_9": {
        "layout_bias": "horizontal-flow-friendly",
        "max_horizontal_elements": 4,
        "prefer_horizontal_connections": true
      },
      "square_1_1": {
        "layout_bias": "radial-or-grid",
        "max_horizontal_elements": 3,
        "center_focused": true
      }
    },

    "motion_principles": {
      "default_spring": {
        "damping": 22,
        "stiffness": 90,
        "mass": 0.9
      },
      "travel_duration_frames": 45,
      "stagger_delay_frames": 8,
      "hold_after_key_moment": 20,
      "never": [
        "instant teleportation of moving objects",
        "static backgrounds",
        "all elements animating simultaneously",
        "fade-only entrances for important elements"
      ]
    }
  }
}
```

### 4. Scenes

The scene-by-scene breakdown with visual storytelling.

```json
{
  "scenes": [
    {
      "scene_id": "S01",
      "frame_range": [0, 180],
      "transcript_segment": "Let's understand how REST APIs work. You have a client - like your browser or mobile app.",

      "narrative_goal": "Introduce the CLIENT as the starting point of the story",
      "viewer_takeaway": "The client is where requests originate - it's 'you'",

      "visual_story": {
        "setup": {
          "description": "Empty stage with subtle animated background grid",
          "mood": "anticipation, beginning of journey"
        },

        "build_sequence": [
          {
            "at_frame": 15,
            "action": "Client icon materializes center-left",
            "element": "Client",
            "technique": "scale-spring-from-zero",
            "effects": ["particle-burst", "subtle-glow-pulse"],
            "rationale": "Dramatic entrance - this is our protagonist"
          },
          {
            "at_frame": 50,
            "action": "Label 'Client' appears below icon",
            "element": "client_label",
            "technique": "typewriter-reveal",
            "effects": ["none"],
            "rationale": "Name what we're seeing"
          },
          {
            "at_frame": 80,
            "action": "Example icons appear (browser, mobile)",
            "element": "client_examples",
            "technique": "staggered-fade-float-up",
            "effects": ["subtle-bounce"],
            "rationale": "Ground the abstraction in familiar things"
          },
          {
            "at_frame": 120,
            "action": "Client settles into left position",
            "element": "Client",
            "technique": "smooth-slide-left",
            "effects": ["none"],
            "rationale": "Make room for what comes next"
          }
        ],

        "hero_moment": {
          "what": "Client icon appearing",
          "frame_range": [15, 45],
          "treatment": "Extra attention - particle effects, slight hold after"
        },

        "elements_on_stage_at_end": ["Client", "client_label", "client_examples"]
      },

      "element_positions": {
        "note": "All positions are percentages - responsive to any canvas size",
        "Client": { "x_percent": 15, "y_percent": 40 },
        "client_label": { "x_percent": 15, "y_percent": 52 },
        "client_examples": { "x_percent": 15, "y_percent": 62 }
      },

      "background": {
        "type": "animated-grid",
        "color": "style.bg",
        "grid_color": "style.muted",
        "grid_style": "subtle-dots",
        "animation": {
          "type": "slow-drift",
          "direction": "right",
          "speed": "barely-perceptible"
        }
      },

      "transition_to_next": {
        "type": "continuation",
        "elements_that_persist": ["Client", "client_label"],
        "elements_that_exit": ["client_examples"],
        "exit_technique": "fade-out"
      }
    },

    {
      "scene_id": "S02",
      "frame_range": [180, 360],
      "transcript_segment": "On the other side, you have a server - the computer that holds the data you want.",

      "narrative_goal": "Introduce SERVER, establish the two-party system",
      "viewer_takeaway": "There are two players: client (you) and server (where data lives)",

      "visual_story": {
        "setup": {
          "description": "Client already present on left side of screen",
          "inherited_elements": ["Client", "client_label"]
        },

        "build_sequence": [
          {
            "at_frame": 195,
            "action": "Server icon materializes on right",
            "element": "Server",
            "technique": "scale-spring-from-zero",
            "effects": ["data-streams-flowing-in", "power-up-glow"],
            "rationale": "Server appears with sense of power/capability"
          },
          {
            "at_frame": 235,
            "action": "Label 'Server' appears below",
            "element": "server_label",
            "technique": "typewriter-reveal",
            "effects": ["none"],
            "rationale": "Name what we're seeing"
          },
          {
            "at_frame": 265,
            "action": "Database icon appears attached to server",
            "element": "database_icon",
            "technique": "draw-connection-then-reveal",
            "effects": ["brief-glow-on-connection"],
            "rationale": "Show server has access to data"
          },
          {
            "at_frame": 300,
            "action": "Connection line draws from Client to Server",
            "element": "Connection",
            "technique": "stroke-dashoffset-draw",
            "effects": ["pulse-when-complete"],
            "rationale": "THE KEY MOMENT - establish relationship"
          }
        ],

        "hero_moment": {
          "what": "Connection line completing",
          "frame_range": [300, 345],
          "treatment": "Connection drawing is satisfying - slight pause after completion"
        },

        "elements_on_stage_at_end": ["Client", "client_label", "Server", "server_label", "database_icon", "Connection"]
      },

      "background": {
        "inherit_from": "S01",
        "modification": "grid drift continues"
      },

      "transition_to_next": {
        "type": "continuation",
        "elements_that_persist": ["Client", "client_label", "Server", "server_label", "Connection"],
        "elements_that_exit": ["database_icon"],
        "exit_technique": "shrink-into-server"
      }
    },

    {
      "scene_id": "S03",
      "frame_range": [360, 660],
      "transcript_segment": "When you need data, your client sends a REQUEST to the server. This request travels across the internet.",

      "narrative_goal": "Show THE CORE PROCESS - request traveling from client to server",
      "viewer_takeaway": "Requests are like messages that physically travel to the server",

      "visual_story": {
        "setup": {
          "description": "Client and Server connected, stage is set for action",
          "inherited_elements": ["Client", "client_label", "Server", "server_label", "Connection"]
        },

        "build_sequence": [
          {
            "at_frame": 375,
            "action": "Client pulses - preparing to send",
            "element": "Client",
            "technique": "pulse-glow",
            "effects": ["anticipation-glow"],
            "rationale": "Build anticipation for the action"
          },
          {
            "at_frame": 400,
            "action": "Request envelope spawns from Client",
            "element": "Request",
            "technique": "pop-out-from-source",
            "effects": ["small-burst", "whoosh"],
            "rationale": "The request is born"
          },
          {
            "at_frame": 420,
            "action": "Request begins traveling along connection path",
            "element": "Request",
            "technique": "path-follow-with-easing",
            "effects": ["motion-trail", "slight-rotation"],
            "rationale": "THE HERO ANIMATION - make this beautiful"
          },
          {
            "at_frame": 480,
            "action": "Request label appears mid-journey: 'GET /users'",
            "element": "request_label",
            "technique": "fade-in-tracking-object",
            "effects": ["code-style-text"],
            "rationale": "Show what the request contains while it's visible"
          },
          {
            "at_frame": 540,
            "action": "Request arrives at Server",
            "element": "Request",
            "technique": "absorb-into-target",
            "effects": ["ripple-on-server", "server-glow-intensifies"],
            "rationale": "Satisfying arrival"
          },
          {
            "at_frame": 570,
            "action": "Server shows processing state",
            "element": "Server",
            "technique": "internal-activity-animation",
            "effects": ["gear-spin", "scanning-line", "busy-glow"],
            "rationale": "Server is working on the request"
          }
        ],

        "hero_moment": {
          "what": "Request traveling from Client to Server",
          "frame_range": [420, 540],
          "treatment": "This is THE animation - smooth, visible trail, not too fast"
        },

        "process_animations": [
          {
            "name": "request_travel",
            "object": "Request",
            "path": "client_to_server_arc",
            "duration_frames": 120,
            "easing": "ease-in-out",
            "effects": {
              "trail": "motion-blur-dots",
              "trail_color": "accent_warm_faded",
              "trail_length": 5
            }
          }
        ],

        "elements_on_stage_at_end": ["Client", "client_label", "Server", "server_label", "Connection"]
      },

      "background": {
        "inherit_from": "S02",
        "modification": {
          "during_travel": "particles speed up slightly, suggesting activity"
        }
      }
    },

    {
      "scene_id": "S04",
      "frame_range": [660, 1020],
      "transcript_segment": "The server processes your request, fetches the data you need, and sends back a RESPONSE.",

      "narrative_goal": "Complete the cycle - show response returning",
      "viewer_takeaway": "Communication is bidirectional - you get back what you asked for",

      "visual_story": {
        "setup": {
          "description": "Server just received request, is in processing state",
          "inherited_elements": ["Client", "client_label", "Server", "server_label", "Connection"]
        },

        "build_sequence": [
          {
            "at_frame": 675,
            "action": "Server internal: data search visualization",
            "element": "server_internal",
            "technique": "internal-mini-animation",
            "effects": ["magnifying-glass-scan", "data-rows-highlighting"],
            "rationale": "Show the work happening inside"
          },
          {
            "at_frame": 720,
            "action": "Data items gather inside server",
            "element": "data_items",
            "technique": "converge-to-center",
            "effects": ["small-cards-flying-in"],
            "rationale": "Data is being collected"
          },
          {
            "at_frame": 780,
            "action": "Response package forms from data",
            "element": "Response",
            "technique": "assemble-from-parts",
            "effects": ["compress-animation", "seal-stamp", "color-shift-to-green"],
            "rationale": "Transformation - raw data becomes packaged response"
          },
          {
            "at_frame": 820,
            "action": "Response begins traveling back to Client",
            "element": "Response",
            "technique": "path-follow-reverse",
            "effects": ["success-colored-trail", "slight-celebration-particles"],
            "rationale": "THE RETURN JOURNEY - use different color to distinguish from request"
          },
          {
            "at_frame": 900,
            "action": "Response label appears: '200 OK + data'",
            "element": "response_label",
            "technique": "fade-in-tracking-object",
            "effects": ["code-style-text", "green-tint"],
            "rationale": "Show what's coming back"
          },
          {
            "at_frame": 940,
            "action": "Response arrives at Client",
            "element": "Response",
            "technique": "absorb-into-target",
            "effects": ["success-ripple", "client-glow-green"],
            "rationale": "Mission accomplished"
          },
          {
            "at_frame": 970,
            "action": "Client shows success state with data preview",
            "element": "Client",
            "technique": "success-transformation",
            "effects": ["checkmark-pop", "data-cards-fan-out", "celebration-burst"],
            "rationale": "Satisfying conclusion - the cycle is complete"
          }
        ],

        "hero_moment": {
          "what": "Response traveling back and Client showing success",
          "frame_range": [820, 1000],
          "treatment": "Mirror the request journey but with success/completion feeling"
        },

        "process_animations": [
          {
            "name": "response_travel",
            "object": "Response",
            "path": "server_to_client_arc",
            "duration_frames": 120,
            "easing": "ease-in-out",
            "effects": {
              "trail": "sparkle-trail",
              "trail_color": "accent_success_faded",
              "trail_length": 5
            }
          }
        ],

        "elements_on_stage_at_end": ["Client", "client_label", "Server", "server_label", "Connection", "success_indicator"]
      }
    }
  ]
}
```

### 5. Global Directives (Hard Requirements)

These are **enforceable constraints** that the plan validator will check programmatically. Violations cause plan rejection.

```json
{
  "global_directives": {
    "layout_constraints": {
      "no_element_overlap": {
        "rule": "Elements visible at same frame must not share pixel space",
        "enforced": true
      },
      "screen_bounds": {
        "rule": "All elements must be fully within canvas dimensions",
        "canvas_width": "input.width",
        "canvas_height": "input.height",
        "note": "Dimensions come from frontend - could be 1080x1920 (pip), 1080x960 (split-h), or 540x1920 (split-v)",
        "enforced": true
      },
      "safe_zone_bottom": {
        "rule": "Nothing in bottom 15% - reserved for subtitles",
        "reserved_height_percent": 15,
        "enforced": true
      },
      "safe_zone_edges": {
        "rule": "Margin on all sides",
        "margin_percent": 5,
        "enforced": true
      },
      "max_simultaneous_elements": {
        "rule": "No more than N primary elements visible at once",
        "max_primary_elements": 6,
        "note": "Reduce to 4 for split-vertical (540px width)",
        "enforced": true
      },
      "responsive_sizing": {
        "rule": "All sizes must be percentages, not hardcoded pixels",
        "position_unit": "percent of canvas width/height",
        "size_unit": "percent of min(width, height)",
        "font_size_unit": "percent of height",
        "enforced": true
      }
    },

    "animation_constraints": {
      "no_simultaneous_hero_animations": {
        "rule": "Only 1 hero animation active at a time",
        "max_concurrent_hero": 1,
        "enforced": true
      },
      "minimum_animation_duration": {
        "rule": "No animation shorter than minimum frames",
        "min_frames": 15,
        "enforced": true
      },
      "travel_path_clearance": {
        "rule": "Traveling objects must have unobstructed paths",
        "enforced": true
      },
      "entry_stagger": {
        "rule": "Multiple elements entering must stagger",
        "min_stagger_frames": 8,
        "enforced": true
      }
    },

    "timing_constraints": {
      "scene_transcript_sync": {
        "rule": "Scene frame_range must match transcript segment timing",
        "enforced": true
      },
      "build_before_speak": {
        "rule": "Key visual must appear before narrator references it",
        "lead_time_frames": 10,
        "enforced": true
      },
      "hero_hold_time": {
        "rule": "Hero moments hold after completion",
        "min_hold_frames": 20,
        "enforced": true
      }
    },

    "motion_constraints": {
      "spring_damping": {
        "rule": "All spring animations must meet minimum damping",
        "min_damping": 20,
        "enforced": true
      },
      "spring_config": {
        "default_damping": 22,
        "default_stiffness": 90,
        "default_mass": 0.9
      },
      "travel_duration": {
        "rule": "Object travel animations minimum duration",
        "min_frames": 45,
        "enforced": true
      }
    },

    "prohibited_patterns": {
      "enforced": true,
      "never": [
        "instant_teleportation_of_moving_objects",
        "static_backgrounds_with_no_animation",
        "all_elements_animating_simultaneously",
        "fade_only_entrances_for_hero_elements",
        "overlapping_elements_at_same_frame",
        "elements_outside_screen_bounds",
        "elements_in_subtitle_safe_zone"
      ]
    },

    "continuity_rules": {
      "elements_persist_across_scenes": true,
      "no_jarring_position_changes": true,
      "maintain_established_spatial_relationships": true,
      "same_entity_same_visual_throughout": true,
      "color_coding_consistent": true
    }
  }
}
```

### Validation Logic

The plan validator checks these constraints before passing to Generator:

```python
def validate_hard_requirements(plan: dict, fps: int = 30) -> list[str]:
    errors = []
    directives = plan['global_directives']
    scenes = plan['scenes']

    # Layout: Check element positions for overlap
    for scene in scenes:
        elements_at_frame = collect_elements_by_frame(scene)
        for frame, elements in elements_at_frame.items():
            if has_overlap(elements):
                errors.append(f"Scene {scene['scene_id']} frame {frame}: overlapping elements")
            for elem in elements:
                if not within_bounds(elem, 1080, 1920):
                    errors.append(f"Element {elem['id']} outside screen bounds")
                if in_safe_zone(elem, bottom_percent=15):
                    errors.append(f"Element {elem['id']} in subtitle safe zone")

    # Animation: Check hero animation concurrency
    for scene in scenes:
        hero = scene['visual_story'].get('hero_moment', {})
        if hero:
            hero_range = hero.get('frame_range', [0, 0])
            # Check no other hero animations overlap this range
            for other_scene in scenes:
                if other_scene['scene_id'] == scene['scene_id']:
                    continue
                other_hero = other_scene['visual_story'].get('hero_moment', {})
                if other_hero and ranges_overlap(hero_range, other_hero.get('frame_range', [0, 0])):
                    errors.append(f"Concurrent hero animations in {scene['scene_id']} and {other_scene['scene_id']}")

    # Animation: Check minimum durations
    for scene in scenes:
        for step in scene['visual_story'].get('build_sequence', []):
            duration = step.get('duration_frames', 30)
            if duration < 15:
                errors.append(f"Animation too short: {step['action']} ({duration} frames < 15 min)")

    # Animation: Check entry stagger
    for scene in scenes:
        build = scene['visual_story'].get('build_sequence', [])
        for i in range(1, len(build)):
            gap = build[i]['at_frame'] - build[i-1]['at_frame']
            if gap < 8 and gap > 0:
                errors.append(f"Stagger too short between entries in {scene['scene_id']}: {gap} frames < 8 min")

    # Timing: Check scene-transcript sync
    # (would compare scene frame_range to transcript timestamps)

    # Motion: Check spring damping
    motion = plan['visual_system'].get('motion_principles', {})
    damping = motion.get('default_spring', {}).get('damping', 0)
    if damping < 20:
        errors.append(f"Spring damping {damping} below minimum 20")

    return errors
```

### 6. Acceptance Criteria

Machine-checkable validation rules. These map directly to the hard requirements in global_directives.

```json
{
  "acceptance_criteria": {
    "layout": {
      "checks": [
        {
          "id": "no_overlap",
          "rule": "No overlapping elements at same frame",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "screen_bounds",
          "rule": "All elements within input canvas (width x height from frontend)",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "responsive_sizing",
          "rule": "All positions/sizes use percentages, not hardcoded pixels",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "style_tokens",
          "rule": "Colors reference style.* tokens, not hardcoded hex",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "subtitle_safe_zone",
          "rule": "Nothing in bottom 15%",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "edge_margins",
          "rule": "5% margin on all edges",
          "severity": "warning",
          "auto_check": true
        },
        {
          "id": "max_elements",
          "rule": "Maximum 6 primary elements visible simultaneously",
          "severity": "warning",
          "auto_check": true
        }
      ]
    },

    "animation": {
      "checks": [
        {
          "id": "single_hero",
          "rule": "Only 1 hero animation active at a time",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "min_duration",
          "rule": "All animations >= 15 frames",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "path_clearance",
          "rule": "Travel paths unobstructed",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "entry_stagger",
          "rule": "Multiple entries staggered by >= 8 frames",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "no_teleport",
          "rule": "Moving objects use path animation, not instant position change",
          "severity": "error",
          "auto_check": false
        },
        {
          "id": "no_fade_only_hero",
          "rule": "Hero elements use spring/path animation, not fade-only",
          "severity": "error",
          "auto_check": false
        }
      ]
    },

    "timing": {
      "checks": [
        {
          "id": "transcript_sync",
          "rule": "Scene frame_range matches transcript segment",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "build_before_speak",
          "rule": "Visual appears >= 10 frames before narration references it",
          "severity": "warning",
          "auto_check": true
        },
        {
          "id": "hero_hold",
          "rule": "Hero moments hold >= 20 frames after completion",
          "severity": "warning",
          "auto_check": true
        }
      ]
    },

    "motion": {
      "checks": [
        {
          "id": "spring_damping",
          "rule": "Spring damping >= 20",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "travel_duration",
          "rule": "Travel animations >= 45 frames",
          "severity": "warning",
          "auto_check": true
        }
      ]
    },

    "concept_coverage": {
      "checks": [
        {
          "id": "entity_metaphors",
          "rule": "All key_entities have metaphor_mapping entry",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "relationship_visuals",
          "rule": "All relationships have visualization specified",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "process_animations",
          "rule": "All is_core_animation processes have scene animations",
          "severity": "error",
          "auto_check": true
        }
      ]
    },

    "completeness": {
      "checks": [
        {
          "id": "scene_narrative",
          "rule": "Every scene has narrative_goal",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "scene_build",
          "rule": "Every scene has build_sequence",
          "severity": "error",
          "auto_check": true
        },
        {
          "id": "scene_hero",
          "rule": "Every scene has hero_moment identified",
          "severity": "warning",
          "auto_check": true
        },
        {
          "id": "scene_transitions",
          "rule": "Transitions between scenes specified",
          "severity": "warning",
          "auto_check": true
        }
      ]
    }
  }
}
```

### Validation Summary

| Category | Error Checks | Warning Checks |
|----------|--------------|----------------|
| Layout | 5 (overlap, bounds, responsive sizing, style tokens, subtitle zone) | 2 (margins, max elements) |
| Animation | 6 (hero, duration, path, stagger, teleport, fade) | 0 |
| Timing | 1 (transcript sync) | 2 (build before speak, hero hold) |
| Motion | 1 (spring damping) | 1 (travel duration) |
| Coverage | 3 (entities, relationships, processes) | 0 |
| Completeness | 2 (narrative, build) | 2 (hero, transitions) |

**Total: 18 error checks, 7 warning checks**

Plans with any error-severity failures are rejected. Warning-severity issues are logged but don't block.

### Responsive Design Requirements

The plan must work for ANY canvas dimensions provided by the frontend:

| Layout Mode | Dimensions | Considerations |
|-------------|------------|----------------|
| `pip` | 1080×1920 | Full vertical space, most flexible |
| `split-horizontal` | 1080×960 | Half height - stack tighter, smaller fonts |
| `split-vertical` | 540×1920 | Half width - avoid wide layouts, max 4 elements |

**All values in the plan must be relative:**
- Positions: `x_percent`, `y_percent` (0-100)
- Sizes: `size_percent` of `min(width, height)`
- Fonts: `size_percent` of `height`
- Colors: `style.primary`, `style.accent`, etc. (from preset)

---

## Planning Agent Prompt Structure

The Planning Agent receives:

### Input (from Frontend)

The Planning Agent receives these inputs from the worker:

```
PROJECT_ID: proj_abc123

TRANSCRIPT:
[0:00 - 0:06] "Let's understand how REST APIs work. You have a client - like your browser or mobile app."
[0:06 - 0:12] "On the other side, you have a server - the computer that holds the data you want."
[0:12 - 0:22] "When you need data, your client sends a REQUEST to the server. This request travels across the internet."
[0:22 - 0:34] "The server processes your request, fetches the data you need, and sends back a RESPONSE."

CANVAS:
- Width: 1080
- Height: 1920
- Layout Mode: pip (full screen, video as small overlay)
- Orientation: vertical

STYLE:
- Preset: modern
- Colors: { bg: #0f0f23, primary: #8b5cf6, secondary: #3b82f6, accent: #06b6d4, success: #22c55e, ... }
- Animation: spring({ damping: 12, stiffness: 80 }) - bouncy, satisfying

TIMING:
- Duration: 34000ms
- FPS: 30
- Total Frames: 1020

QUALITY TARGET: ByteByteGo-level explanation visuals
```

**The agent must use these values - not invent its own.** All positions are percentages of canvas. All colors reference style tokens.

### System Prompt

```
You are a CREATIVE VISUAL DIRECTOR for technical explainer videos.

Your job is to transform dry explanations into VISUALLY STUNNING, MEMORABLE animations that make complex concepts click. Think like a motion graphics artist at a top studio - every frame should be intentional, beautiful, and aid understanding.

## Your Creative Mission

You're not just placing icons on screen. You're telling a VISUAL STORY:

1. **INVENT METAPHORS** - Don't use generic icons. Find the perfect visual analogy.
   - REST API? Maybe it's a postal service with letters flying between buildings
   - Database query? Maybe it's a librarian searching towering bookshelves
   - Load balancer? Maybe it's a traffic controller directing cars to different lanes
   - Be SURPRISING. Be MEMORABLE. Make viewers say "oh, that's clever!"

2. **CHOREOGRAPH MOTION** - Everything should MOVE with purpose and beauty
   - Objects don't just "appear" - they have ENTRANCES worthy of a character
   - Data doesn't teleport - it TRAVELS along beautiful arcing paths with trails
   - Processes have RHYTHM - build tension, release, breathe, repeat
   - Think of it as a DANCE - every element has its moment

3. **CREATE MOMENTS** - Each scene needs a "hero moment" that's extra special
   - The request flying across the screen with a glowing trail
   - The server "processing" with satisfying internal machinery
   - The success state with celebration particles
   - These moments should make viewers want to watch again

4. **BUILD DRAMA** - Progressive revelation creates engagement
   - Start simple, add complexity layer by layer
   - Create anticipation before big reveals
   - Use timing to create rhythm (fast-fast-SLOW for emphasis)
   - End scenes with a beat of satisfaction before moving on

## Hard Constraints (Non-Negotiable)

While being creative, you MUST respect these technical limits:

### Use Frontend-Provided Values
- **Canvas dimensions**: Use the provided width/height (could be 1080x1920, 1080x960, or 540x1920)
- **Colors**: Reference style tokens (style.primary, style.accent) - DO NOT invent colors
- **Animation config**: Use the spring config from the style preset
- **All positions**: Percentages of canvas (x_percent, y_percent) - NO hardcoded pixels
- **All sizes**: Percentages of min(width, height) - NO hardcoded pixels

### Layout Rules
- No overlapping elements (elements visible at same frame cannot share pixel space)
- All elements within canvas bounds (respects any layout mode)
- Bottom 15% reserved for subtitles - nothing there
- 5% margin on all edges
- Maximum 6 primary elements visible at once (4 for narrow layouts)

### Animation Rules
- Only 1 hero animation active at a time
- Minimum 15 frames per animation
- Minimum 8 frame stagger between element entries
- Spring damping minimum 20
- Travel animations minimum 45 frames

These constraints PROTECT quality - they prevent chaos and overlap. Work creatively WITHIN them.

## What Makes This Professional vs Amateur

AMATEUR (avoid):
- Generic icons (server icon, database cylinder)
- Elements just "appearing" and sitting still
- Everything animating at once
- No clear focal point
- Animations that exist for their own sake

PROFESSIONAL (aim for):
- Unique visual metaphors that stick in memory
- Choreographed sequences with clear timing
- One thing happening at a time, with purpose
- Clear visual hierarchy guiding the eye
- Every animation serves understanding

## Your Output

Create a Visual Plan that another person could implement without any creative decisions left to make. Be SPECIFIC about:
- Exact visual metaphors (not "icon" but "laptop with glowing screen, slight floating animation")
- Exact motion (not "appears" but "scales from 0 with spring, particle burst on arrival")
- Exact timing (frame numbers for each action)
- Exact spatial positions (percentages or coordinates)

Think about:
1. What CONCEPTS need to be made visible? What METAPHORS will represent them?
2. What PROCESSES need to be ANIMATED? (not just elements appearing, but things HAPPENING)
3. How does the visual STORY build up? What's revealed when?
4. What are the HERO MOMENTS that need special attention?

Output a complete Visual Plan in the specified JSON schema.
```

### Output Validation

Before passing to Generator, the plan is validated:

```python
def validate_visual_plan(plan: dict) -> ValidationResult:
    errors = []

    # Required sections
    for section in ['concept_analysis', 'visual_system', 'scenes']:
        if section not in plan:
            errors.append(f"Missing required section: {section}")

    # Entity coverage
    entities = plan['concept_analysis']['key_entities']
    metaphors = plan['visual_system']['metaphor_mapping']
    for entity in entities:
        if entity['name'] not in metaphors:
            errors.append(f"Entity '{entity['name']}' has no metaphor mapping")

    # Process animations
    processes = plan['concept_analysis']['processes']
    for process in processes:
        if process.get('is_core_animation'):
            # Check that scenes contain this process animation
            found = False
            for scene in plan['scenes']:
                if 'process_animations' in scene.get('visual_story', {}):
                    found = True
                    break
            if not found:
                errors.append(f"Core process '{process['name']}' has no scene animation")

    # Scene completeness
    for scene in plan['scenes']:
        if 'hero_moment' not in scene.get('visual_story', {}):
            errors.append(f"Scene {scene['scene_id']} missing hero_moment")
        if 'build_sequence' not in scene.get('visual_story', {}):
            errors.append(f"Scene {scene['scene_id']} missing build_sequence")

    return ValidationResult(valid=len(errors) == 0, errors=errors)
```

---

## Generator Agent Integration

The Generator receives the validated Visual Plan and translates it to Remotion code.

### Generator's Role (Changed)

**Before:** Generator makes creative AND implementation decisions
**After:** Generator ONLY implements - creative decisions are in the plan

### Generator Prompt

```
VISUAL PLAN:
[The complete JSON plan from Visual Director]

YOUR TASK:
Implement this Visual Plan as Remotion TSX code.

The plan specifies:
- What elements exist and how they look (visual_system.metaphor_mapping)
- Where elements are positioned (visual_system.spatial_layout)
- When and how elements animate (scenes[].visual_story.build_sequence)
- What process animations occur (scenes[].process_animations)

Your job is TRANSLATION, not creative decisions. The Visual Director has already made all creative choices.

IMPLEMENTATION RULES:
- Use spring() for all entrances with the specified damping/stiffness
- Use interpolate() for path-following animations
- Use <Sequence> to time the build_sequence steps
- Implement process_animations as objects following paths
- Match the frame timings specified in the plan
```

---

## Implementation Plan

### Phase 1: Planning Agent Infrastructure

1. Create planning agent prompt template
2. Implement JSON schema validation
3. Add planning phase to visual_generator.py pipeline
4. Test with sample transcripts

### Phase 2: Generator Adaptation

1. Modify generator prompt to accept Visual Plan
2. Remove creative decision-making from generator
3. Add plan-following validation to evaluator
4. Test end-to-end pipeline

### Phase 3: Iteration & Refinement

1. Tune planning agent prompts based on output quality
2. Add more metaphor examples to planning context
3. Build library of visual vocabulary patterns
4. Refine acceptance criteria based on results

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Process animations (things traveling) | Rare | Every explanation has them |
| Visual metaphors | Generic icons | Concept-appropriate metaphors |
| Build-up sequence | All at once | Progressive reveal |
| Layout conflicts | Common | Zero |
| "Would I post this?" | No | Yes |

---

## Appendix: Visual Vocabulary Reference

Common patterns the Planning Agent should know:

### Entity Metaphors

| Concept | Visual Metaphor |
|---------|-----------------|
| Client/User | Laptop, phone, browser window |
| Server | Server rack, cloud icon, building |
| Database | Cylinder, filing cabinet, grid of records |
| Request | Envelope, arrow, package outbound |
| Response | Package, box with checkmark, data cards |
| API | Gateway, door, bridge |
| Network | Lines connecting nodes, highway, pipes |
| Data | Cards, JSON brackets, rows |
| Error | Red X, broken connection, warning triangle |
| Success | Green check, sparkle, celebration |

### Process Animations

| Process | Animation |
|---------|-----------|
| Sending | Object travels along path with trail |
| Receiving | Object absorbs into target with ripple |
| Processing | Glow, spin, internal activity |
| Transforming | Shape morphs, color shifts, assembly |
| Connecting | Line draws between points |
| Searching | Magnifying glass, highlight scan |
| Loading | Progress bar, spinning indicator |
| Completing | Checkmark pop, celebration burst |

### Spatial Patterns

| Pattern | Use Case |
|---------|----------|
| Left-to-right flow | Client-server, request-response, timeline |
| Center-out | Single concept explanation, hierarchy |
| Top-down | Process flow, dependency chain |
| Circular | Cycles, feedback loops, state machines |
| Grid | Multiple equal items, matrix, comparison |
