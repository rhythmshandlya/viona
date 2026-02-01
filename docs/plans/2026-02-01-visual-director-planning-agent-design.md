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

Basic project information.

```json
{
  "meta": {
    "project_id": "proj_rest_api_explained",
    "transcript_summary": "Explaining how REST APIs work - client-server communication",
    "total_duration_frames": 1800,
    "fps": 30,
    "canvas": {
      "width": 1080,
      "height": 1920,
      "orientation": "vertical"
    }
  }
}
```

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

```json
{
  "visual_system": {
    "metaphor_mapping": {
      "Client": {
        "visual": "laptop-computer-icon",
        "style": {
          "color": "primary",
          "size": "large",
          "glow": "subtle"
        },
        "personality": "active, initiating, waiting for results"
      },
      "Server": {
        "visual": "server-rack-icon",
        "style": {
          "color": "secondary",
          "size": "large"
        },
        "personality": "stable, processing, powerful"
      },
      "Request": {
        "visual": "envelope-with-arrow-icon",
        "style": {
          "color": "accent_warm",
          "size": "medium"
        },
        "personality": "traveling, carrying intent"
      },
      "Response": {
        "visual": "package-box-icon",
        "style": {
          "color": "accent_success",
          "size": "medium"
        },
        "personality": "returning, delivering value"
      },
      "Connection": {
        "visual": "curved-dashed-line",
        "style": {
          "color": "muted",
          "animated": true,
          "dash_flow": "toward-server"
        },
        "personality": "the highway, always present"
      },
      "Data": {
        "visual": "small-rectangles-json-like",
        "style": {
          "color": "text_secondary"
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
        "effects": ["green pulse", "small particles burst"]
      },
      "failure": {
        "animation": "X appears, rejection",
        "effects": ["red pulse", "shake"]
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
      "background": {
        "base": "#0f0f1a",
        "gradient_to": "#1a1025",
        "grid_lines": "#ffffff08"
      },
      "primary": "#6366f1",
      "secondary": "#22d3ee",
      "accent_warm": "#f59e0b",
      "accent_success": "#10b981",
      "accent_error": "#ef4444",
      "text_primary": "#ffffff",
      "text_secondary": "#94a3b8",
      "muted": "#4b556390"
    },

    "typography": {
      "title": {
        "font": "Inter",
        "weight": 700,
        "size": 64
      },
      "label": {
        "font": "Inter",
        "weight": 600,
        "size": 36
      },
      "caption": {
        "font": "Inter",
        "weight": 400,
        "size": 28
      },
      "code": {
        "font": "JetBrains Mono",
        "weight": 400,
        "size": 24
      }
    },

    "spatial_layout": {
      "type": "horizontal-flow",
      "description": "Client on left, Server on right, connection between them",
      "positions": {
        "client_area": { "x": "10%", "y": "40%", "anchor": "center" },
        "server_area": { "x": "90%", "y": "40%", "anchor": "center" },
        "connection_path": { "type": "curved-arc", "bend": "upward", "height": "20%" },
        "label_area": { "y": "75%", "usage": "explanatory text and code snippets" },
        "title_area": { "y": "10%", "usage": "scene titles" }
      },
      "safe_zones": {
        "bottom": { "height": "15%", "reserved_for": "subtitles" },
        "edges": { "margin": "5%", "reserved_for": "breathing room" }
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

      "background": {
        "type": "animated-grid",
        "grid_style": "subtle-dots",
        "animation": {
          "type": "slow-drift",
          "direction": "right",
          "speed": "barely-perceptible"
        },
        "particles": {
          "enabled": true,
          "type": "floating-dust",
          "density": "sparse",
          "drift": "upward-slow"
        }
      },

      "camera": {
        "movement": "static-with-subtle-drift",
        "focus": "client_area"
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

### 5. Global Directives

Rules that apply across all scenes.

```json
{
  "global_directives": {
    "pacing": {
      "philosophy": "Let animations breathe - viewers need time to absorb",
      "minimum_gap_between_major_actions": 20,
      "hold_after_hero_moment": 30,
      "travel_animations_are_not_rushed": true
    },

    "emphasis_hierarchy": {
      "hero": {
        "what": ["process animations - things traveling", "transformation moments"],
        "treatment": "extra duration, effects, visual attention"
      },
      "primary": {
        "what": ["entity appearances", "connections forming"],
        "treatment": "clear spring animations, brief effects"
      },
      "secondary": {
        "what": ["labels appearing", "supporting icons"],
        "treatment": "simple fades or subtle springs"
      },
      "ambient": {
        "what": ["background animation", "particles"],
        "treatment": "always present but never distracting"
      }
    },

    "continuity_rules": {
      "elements_persist_across_scenes": true,
      "no_jarring_position_changes": true,
      "maintain_established_spatial_relationships": true,
      "camera_movements_are_motivated": true
    },

    "visual_consistency": {
      "same_entity_same_visual": true,
      "color_coding_is_consistent": true,
      "animation_style_is_consistent": true
    }
  }
}
```

### 6. Acceptance Criteria

Machine-checkable validation rules.

```json
{
  "acceptance_criteria": {
    "concept_coverage": [
      "all_key_entities_have_metaphor_visuals",
      "all_relationships_have_visual_representation",
      "all_processes_have_animated_sequences"
    ],

    "animation_quality": [
      "traveling_objects_use_path_animation_not_teleport",
      "processing_states_have_visible_activity",
      "no_fade_only_entrances_for_hero_elements",
      "spring_damping_minimum_20",
      "stagger_delay_minimum_8_frames"
    ],

    "timing": [
      "scene_timing_matches_transcript_segments",
      "hero_moments_have_adequate_duration",
      "no_simultaneous_hero_animations"
    ],

    "layout": [
      "no_overlapping_elements_in_same_timeframe",
      "safe_zones_respected",
      "spatial_relationships_make_sense"
    ],

    "completeness": [
      "every_scene_has_narrative_goal",
      "every_scene_has_build_sequence",
      "every_scene_has_hero_moment_identified",
      "transitions_between_scenes_specified"
    ]
  }
}
```

---

## Planning Agent Prompt Structure

The Planning Agent receives:

### Input

```
TRANSCRIPT:
[0:00 - 0:06] "Let's understand how REST APIs work. You have a client - like your browser or mobile app."
[0:06 - 0:12] "On the other side, you have a server - the computer that holds the data you want."
[0:12 - 0:22] "When you need data, your client sends a REQUEST to the server. This request travels across the internet."
[0:22 - 0:34] "The server processes your request, fetches the data you need, and sends back a RESPONSE."

PARAMETERS:
- Style: technical-explainer
- Canvas: 1080x1920 (vertical)
- Duration: Match transcript
- Quality target: ByteByteGo-level explanation visuals

YOUR TASK:
You are a Visual Director. Your job is to design how this explanation will be VISUALIZED - not to write code, but to create the creative vision.

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
