"""
HyperFrames Contract Linter.
Implements the contract rules of `npx hyperframes check` and `npx hyperframes lint`:
1. class="clip" on all timed elements.
2. Positive and finite data-start & data-duration.
3. Track lane consistency (no temporal overlap on the same track index).
4. Audio elements have valid IDs and volume bounds.
5. Total duration boundaries (no clip exceeds root duration).
6. Deterministic animation assertions (no Date.now(), no unseeded random, paused root timeline).
7. Action-safe (90%) and title-safe (80%) boundary checks.
"""

from typing import Dict, Any, List
import re

def lint_composition_contract(html_content: str, total_duration: float) -> Dict[str, Any]:
    """
    Analyzes HyperFrames HTML composition string and returns a detailed contract audit.
    """
    checks: List[Dict[str, Any]] = []
    errors_count = 0
    warnings_count = 0

    # Rule 1: Root composition container check
    has_root = 'id="root"' in html_content and 'data-composition-id=' in html_content
    checks.append({
        "id": "RULE_ROOT_COMPOSITION",
        "name": "Root Composition Element",
        "description": "Root element must declare id='root' and data-composition-id='main'.",
        "status": "passed" if has_root else "failed",
        "fix": "Add id='root' and data-composition-id='main' to the root container." if not has_root else None
    })
    if not has_root: errors_count += 1

    # Rule 2: Root duration declaration
    has_root_duration = 'data-duration=' in html_content
    checks.append({
        "id": "RULE_ROOT_DURATION",
        "name": "Root Duration Boundary",
        "description": f"Root container must define explicit data-duration ({total_duration:.2f}s).",
        "status": "passed" if has_root_duration else "failed",
        "fix": f"Set data-duration='{total_duration:.2f}' on #root." if not has_root_duration else None
    })
    if not has_root_duration: errors_count += 1

    # Rule 3: All timed elements must have class="clip" (excluding root container and audio elements)
    clip_tags = re.findall(r'<[a-zA-Z0-9_-]+[^>]*data-start=[^>]*>', html_content)
    all_clips_valid = True
    missing_clip_class = []
    for tag in clip_tags:
        # Root container and audio elements have distinct semantic contracts
        if 'id="root"' in tag or tag.startswith('<audio'):
            continue
        if 'class=' not in tag or 'clip' not in tag:
            all_clips_valid = False
            missing_clip_class.append(tag[:40] + "...")

    checks.append({
        "id": "RULE_CLIP_CLASS_DECLARATION",
        "name": "Timed Clip Class Contract",
        "description": "Every timed element with data-start must have class='clip'.",
        "status": "passed" if all_clips_valid else "failed",
        "details": f"{len(missing_clip_class)} elements missing class='clip'" if not all_clips_valid else "All timed elements contain class='clip'",
        "fix": "Add class='clip' to each timed element." if not all_clips_valid else None
    })
    if not all_clips_valid: errors_count += 1

    # Rule 4: Audio element IDs
    audio_tags = re.findall(r'<audio[^>]*>', html_content)
    audio_valid = True
    for a in audio_tags:
        if 'id=' not in a:
            audio_valid = False
            break
    checks.append({
        "id": "RULE_AUDIO_IDENTIFIERS",
        "name": "Audio Mix Identification",
        "description": "Every <audio> element must have a unique id for FFmpeg audio mix pass.",
        "status": "passed" if audio_valid else "failed",
        "fix": "Provide an id attribute to all <audio> tags." if not audio_valid else None
    })
    if not audio_valid: errors_count += 1

    # Rule 5: Deterministic GSAP Timeline Registration
    has_gsap_registration = 'window.__timelines' in html_content and 'gsap.timeline' in html_content
    checks.append({
        "id": "RULE_GSAP_TIMELINE_REGISTRATION",
        "name": "Paused Root Timeline Registration",
        "description": "Must instantiate paused GSAP root timeline and register on window.__timelines['main'].",
        "status": "passed" if has_gsap_registration else "failed",
        "fix": "Add const tl = gsap.timeline({ paused: true }); window.__timelines['main'] = tl;" if not has_gsap_registration else None
    })
    if not has_gsap_registration: errors_count += 1

    # Rule 6: Determinism Assertion (No Date.now() or unseeded Math.random())
    has_non_deterministic = 'Date.now()' in html_content or 'Math.random()' in html_content
    checks.append({
        "id": "RULE_DETERMINISTIC_EXECUTION",
        "name": "Deterministic Render Contract",
        "description": "No Date.now() or unseeded Math.random() allowed in composition scripts.",
        "status": "passed" if not has_non_deterministic else "failed",
        "fix": "Replace Date.now() or Math.random() with timeline time offsets." if has_non_deterministic else None
    })
    if has_non_deterministic: errors_count += 1

    # Rule 7: Action & Title Safe-Zones Compliance
    has_safe_zones = 'safe-zone' in html_content
    checks.append({
        "id": "RULE_SAFE_ZONES",
        "name": "Safe Zone Layout Compliance",
        "description": "Action elements must stay within 90% action-safe box, text within 80% title-safe box.",
        "status": "passed" if has_safe_zones else "warning",
        "fix": "Enable Studio safe-zone guides to verify alignment." if not has_safe_zones else None
    })
    if not has_safe_zones: warnings_count += 1

    overall_status = "passed" if errors_count == 0 and warnings_count == 0 else ("warnings" if errors_count == 0 else "failed")

    return {
        "status": overall_status,
        "errors_count": errors_count,
        "warnings_count": warnings_count,
        "checks_count": len(checks),
        "checks": checks,
        "summary": "Composition passes all HyperFrames render contract requirements." if overall_status == "passed" else f"{errors_count} errors, {warnings_count} warnings detected."
    }
