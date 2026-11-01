"""
Standalone Video & Reference Beat Analyzer.
Uses OpenCV and PySceneDetect to detect scene cuts, durations, FPS,
and resolution from video footage, outputting structured markers
directly to STORYBOARD.md or meta.json.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import cv2

try:
    from scenedetect import detect, ContentDetector, AdaptiveDetector
    SCENEDETECT_AVAILABLE = True
except ImportError:
    SCENEDETECT_AVAILABLE = False

logger = logging.getLogger("kino.analyzer")

class MediaAnalyzer:
    """
    Local media inspection utility:
    Extracts video geometry, frame rate, duration, and cut points.
    """

    def inspect_file(self, filepath: str) -> Dict[str, Any]:
        """Reads basic container metadata (duration, width, height, fps)."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Video file not found: {filepath}")

        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {filepath}")

        try:
            fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
            duration = round(total_frames / fps, 2) if total_frames > 0 else 0.0

            return {
                "filename": os.path.basename(filepath),
                "filepath": os.path.abspath(filepath),
                "width": width,
                "height": height,
                "fps": round(fps, 2),
                "duration": duration,
                "total_frames": total_frames,
                "aspect_ratio": "16:9" if width >= height else "9:16"
            }
        finally:
            cap.release()

    def detect_scene_cuts(self, filepath: str, threshold: float = 27.0) -> List[Dict[str, Any]]:
        """
        Uses PySceneDetect to find cut points in reference video or raw footage.
        Returns a list of scene segments with in_sec, out_sec, and duration.
        """
        if not os.path.exists(filepath):
            return []

        meta = self.inspect_file(filepath)
        total_duration = meta["duration"]

        if not SCENEDETECT_AVAILABLE:
            # Fallback heuristic: uniform 3.0s cut intervals
            interval = 3.0
            cuts = []
            curr = 0.0
            idx = 1
            while curr < total_duration:
                nxt = min(total_duration, round(curr + interval, 2))
                cuts.append({
                    "scene_index": idx,
                    "in_sec": curr,
                    "out_sec": nxt,
                    "duration": round(nxt - curr, 2)
                })
                curr = nxt
                idx += 1
            return cuts

        try:
            scene_list = detect(filepath, ContentDetector(threshold=threshold))
            cuts = []
            for i, (start_tc, end_tc) in enumerate(scene_list):
                in_sec = round(start_tc.get_seconds(), 2)
                out_sec = round(end_tc.get_seconds(), 2)
                cuts.append({
                    "scene_index": i + 1,
                    "in_sec": in_sec,
                    "out_sec": out_sec,
                    "duration": round(out_sec - in_sec, 2)
                })

            if not cuts and total_duration > 0:
                cuts.append({
                    "scene_index": 1,
                    "in_sec": 0.0,
                    "out_sec": total_duration,
                    "duration": total_duration
                })

            return cuts
        except Exception as e:
            logger.warning(f"PySceneDetect error on {filepath}: {e}")
            return [{"scene_index": 1, "in_sec": 0.0, "out_sec": total_duration, "duration": total_duration}]

    def export_storyboard_template(self, video_path: str, output_storyboard_path: str):
        """
        Detects scene rhythm from a reference video and writes standard STORYBOARD.md.
        """
        meta = self.inspect_file(video_path)
        scenes = self.detect_scene_cuts(video_path)

        lines = [
            f"# STORYBOARD — {os.path.basename(video_path)}",
            f"**Total Duration**: {meta['duration']}s | **Resolution**: {meta['width']}x{meta['height']} | **FPS**: {meta['fps']}\n",
            "| Scene | Start | End | Duration | Beat Role | Shot Type | Notes |",
            "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
        ]

        roles = ["HOOK", "PROBLEM", "SOLUTION", "DEMO", "CALL_TO_ACTION"]
        for s in scenes:
            role = roles[(s["scene_index"] - 1) % len(roles)]
            lines.append(
                f"| Scene {s['scene_index']} | {s['in_sec']}s | {s['out_sec']}s | {s['duration']}s | `{role}` | B-Roll / Screen | Extracted from reference footage |"
            )

        os.makedirs(os.path.dirname(os.path.abspath(output_storyboard_path)), exist_ok=True)
        with open(output_storyboard_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        logger.info(f"Wrote storyboard specification to {output_storyboard_path}")

analyzer = MediaAnalyzer()
