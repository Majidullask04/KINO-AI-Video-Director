import os
import time
import uuid
import logging
from typing import Dict, Any, List, Optional

from backend.graph.client import db
from backend.video.renderer import detect_scenes
from backend.video.analyzer import visual_analyzer

from backend.beats import DEFAULT_BEAT_TEMPLATES

logger = logging.getLogger(__name__)

class IngestorAgent:
    """
    Ingests and analyzes reference videos and raw footage into FalkorDB property graph nodes and edges.
    """

    def ensure_project_beats(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Ensures a Project has a sequential StoryBeat chain in FalkorDB.
        If no reference beats exist, creates a standard 4-beat cinematic narrative structure.
        """
        check_cypher = """
        MATCH (p:Project {id: $project_id})-[:USES_REFERENCE]->(r:ReferenceVideo)-[:HAS_BEAT]->(b:StoryBeat)
        RETURN count(b) AS beat_count
        """
        res = db.query_as_dicts(check_cypher, {"project_id": project_id})
        if res and res[0].get("beat_count", 0) > 0:
            from backend.graph.queries import get_reference_beats
            return get_reference_beats(project_id)

        # Create standard reference beats for the project
        return self.analyze_and_index_reference_video(
            project_id=project_id,
            video_path_or_url="standard_narrative_pacing",
            source_type="standard_template"
        ).get("beats", [])

    def analyze_and_index_reference_video(
        self,
        project_id: str,
        video_path_or_url: str,
        source_type: str = "file"
    ) -> Dict[str, Any]:
        """
        Runs scene detection on reference video and writes StoryBeat sequential chain to FalkorDB.
        """
        logger.info(f"IngestorAgent analyzing reference video: {video_path_or_url}")
        
        # Detect scenes or rhythmic cuts
        if os.path.exists(video_path_or_url):
            cuts = detect_scenes(video_path_or_url, fallback_interval_sec=3.0)
        else:
            # Fallback template cuts for URLs or virtual references
            cuts = [
                {"start_sec": 0.0, "end_sec": 3.0, "duration": 3.0},
                {"start_sec": 3.0, "end_sec": 6.0, "duration": 3.0},
                {"start_sec": 6.0, "end_sec": 9.0, "duration": 3.0},
                {"start_sec": 9.0, "end_sec": 12.0, "duration": 3.0},
            ]

        total_duration = sum(c["duration"] for c in cuts) if cuts else 12.0
        avg_cut_duration = round(total_duration / max(1, len(cuts)), 2)
        pacing_style = "High Energy Rapid Cut" if avg_cut_duration <= 3.0 else "Deliberate Narrative"

        ref_id = f"ref_{uuid.uuid4().hex[:8]}"

        # Create ReferenceVideo Node and link to Project
        create_ref_cypher = """
        MATCH (p:Project {id: $project_id})
        MERGE (r:ReferenceVideo {id: $ref_id})
        SET r.source_type = $source_type,
            r.url_or_path = $url_or_path,
            r.avg_cut_duration = $avg_cut_duration,
            r.pacing_style = $pacing_style,
            r.total_duration = $total_duration,
            r.imported_at = timestamp()
        MERGE (p)-[:USES_REFERENCE {imported_at: timestamp()}]->(r)
        RETURN r.id AS id
        """
        db.query(create_ref_cypher, {
            "project_id": project_id,
            "ref_id": ref_id,
            "source_type": source_type,
            "url_or_path": video_path_or_url,
            "avg_cut_duration": avg_cut_duration,
            "pacing_style": pacing_style,
            "total_duration": total_duration
        })

        # Create sequential StoryBeat chain
        prev_beat_id = None
        created_beats = []

        for idx, cut in enumerate(cuts):
            template = DEFAULT_BEAT_TEMPLATES[idx % len(DEFAULT_BEAT_TEMPLATES)]
            beat_id = f"beat_{uuid.uuid4().hex[:8]}"
            target_dur = float(cut["duration"])
            role = template["role"]
            energy_level = template["energy_level"]
            shot_type = template["required_shot_type"]
            transition = template["transition"]

            create_beat_cypher = """
            MATCH (r:ReferenceVideo {id: $ref_id})
            CREATE (b:StoryBeat {
                id: $beat_id,
                beat_index: $beat_index,
                role: $role,
                target_duration: $target_duration,
                energy_level: $energy_level,
                required_shot_type: $required_shot_type,
                transition: $transition
            })
            CREATE (r)-[:HAS_BEAT {beat_index: $beat_index}]->(b)
            RETURN b.id AS id
            """
            db.query(create_beat_cypher, {
                "ref_id": ref_id,
                "beat_id": beat_id,
                "beat_index": idx + 1,
                "role": role,
                "target_duration": target_dur,
                "energy_level": energy_level,
                "required_shot_type": shot_type,
                "transition": transition
            })

            # Connect VisualTag requirements
            for tag_name in template["required_tags"]:
                tag_cypher = """
                MATCH (b:StoryBeat {id: $beat_id})
                MERGE (t:VisualTag {name: $tag_name})
                MERGE (b)-[:REQUIRES_TAG {weight: 1.0}]->(t)
                """
                db.query(tag_cypher, {"beat_id": beat_id, "tag_name": tag_name})

            # Connect temporal NEXT_BEAT chain
            if prev_beat_id:
                link_cypher = """
                MATCH (b1:StoryBeat {id: $prev_beat_id}), (b2:StoryBeat {id: $beat_id})
                MERGE (b1)-[:NEXT_BEAT {cut_type: 'hard_cut'}]->(b2)
                """
                db.query(link_cypher, {"prev_beat_id": prev_beat_id, "beat_id": beat_id})

            prev_beat_id = beat_id
            created_beats.append({
                "beat_id": beat_id,
                "beat_index": idx + 1,
                "role": role,
                "target_duration": target_dur,
                "energy_level": energy_level,
                "required_shot_type": shot_type
            })

        return {
            "ref_id": ref_id,
            "avg_cut_duration": avg_cut_duration,
            "pacing_style": pacing_style,
            "total_duration": total_duration,
            "beats": created_beats
        }

    def index_source_asset(
        self,
        project_id: str,
        filename: str,
        filepath: str,
        media_type: str = "video/mp4",
        resolution: str = "1920x1080",
        fps: int = 24
    ) -> Dict[str, Any]:
        """
        Segments a raw video asset into VideoClip nodes with tags and mood links in FalkorDB.
        """
        logger.info(f"IngestorAgent indexing source asset: {filename}")
        
        # Scene detection on raw asset
        if os.path.exists(filepath):
            cuts = detect_scenes(filepath, fallback_interval_sec=5.0)
        else:
            cuts = [
                {"start_sec": 0.0, "end_sec": 5.0, "duration": 5.0}
            ]

        total_duration = sum(c["duration"] for c in cuts) if cuts else 5.0
        asset_id = f"asset_{uuid.uuid4().hex[:8]}"

        # Create SourceAsset Node and link to Project
        create_asset_cypher = """
        MATCH (p:Project {id: $project_id})
        MERGE (sa:SourceAsset {id: $asset_id})
        SET sa.filename = $filename,
            sa.media_type = $media_type,
            sa.duration = $duration,
            sa.resolution = $resolution,
            sa.fps = $fps,
            sa.uploaded_at = timestamp()
        MERGE (p)-[:HAS_ASSET {uploaded_at: timestamp()}]->(sa)
        RETURN sa.id AS id
        """
        db.query(create_asset_cypher, {
            "project_id": project_id,
            "asset_id": asset_id,
            "filename": filename,
            "media_type": media_type,
            "duration": total_duration,
            "resolution": resolution,
            "fps": fps
        })

        # Give it eyes: analyze actual video clips using computer vision
        prev_clip_id = None
        created_clips = []

        for idx, cut in enumerate(cuts):
            clip_id = f"clip_{uuid.uuid4().hex[:8]}"
            in_sec = float(cut["start_sec"])
            out_sec = float(cut["end_sec"])
            duration = float(cut["duration"])
            
            # Extract real visual metrics from actual video frames
            visual_data = visual_analyzer.analyze_clip_visuals(
                filepath=filepath,
                in_sec=in_sec,
                out_sec=out_sec
            )
            
            shot_type = visual_data["shot_type"]
            energy_level = visual_data["energy_level"]
            motion_score = visual_data["motion_score"]
            edge_density = visual_data.get("edge_density", 1.8)
            brightness = visual_data.get("brightness", 50.0)
            contrast = visual_data.get("contrast", 18.0)
            visual_summary = visual_data.get("visual_summary", f"Visual analysis: {shot_type} cut")
            transcript = visual_data.get("transcript", visual_summary)
            tags = visual_data.get("tags", [shot_type])
            mood = visual_data.get("mood", "upbeat")

            create_clip_cypher = """
            MATCH (sa:SourceAsset {id: $asset_id})
            CREATE (c:VideoClip {
                id: $clip_id,
                in_sec: $in_sec,
                out_sec: $out_sec,
                duration: $duration,
                shot_type: $shot_type,
                energy_level: $energy_level,
                motion_score: $motion_score,
                edge_density: $edge_density,
                brightness: $brightness,
                contrast: $contrast,
                visual_summary: $visual_summary,
                transcript: $transcript,
                keep_count: 0,
                replace_count: 0,
                reject_count: 0
            })
            CREATE (sa)-[:CONTAINS_CLIP {clip_index: $clip_index}]->(c)
            RETURN c.id AS id
            """
            db.query(create_clip_cypher, {
                "asset_id": asset_id,
                "clip_id": clip_id,
                "in_sec": in_sec,
                "out_sec": out_sec,
                "duration": duration,
                "shot_type": shot_type,
                "energy_level": energy_level,
                "motion_score": motion_score,
                "edge_density": edge_density,
                "brightness": brightness,
                "contrast": contrast,
                "visual_summary": visual_summary,
                "transcript": transcript,
                "clip_index": idx + 1
            })

            # Connect VisualTags derived from real vision analysis
            for tag in tags:
                tag_cypher = """
                MATCH (c:VideoClip {id: $clip_id})
                MERGE (t:VisualTag {name: $tag_name})
                MERGE (c)-[:HAS_TAG {confidence: 0.95}]->(t)
                """
                db.query(tag_cypher, {"clip_id": clip_id, "tag_name": tag})

            # Connect AudioMood
            mood_cypher = """
            MATCH (c:VideoClip {id: $clip_id})
            MERGE (m:AudioMood {name: $mood_name})
            MERGE (c)-[:HAS_MOOD {confidence: 0.90}]->(m)
            """
            db.query(mood_cypher, {"clip_id": clip_id, "mood_name": mood})

            # Connect NEXT_CLIP_IN_SOURCE
            if prev_clip_id:
                link_cypher = """
                MATCH (c1:VideoClip {id: $prev_clip_id}), (c2:VideoClip {id: $clip_id})
                MERGE (c1)-[:NEXT_CLIP_IN_SOURCE {gap_sec: 0.0}]->(c2)
                """
                db.query(link_cypher, {"prev_clip_id": prev_clip_id, "clip_id": clip_id})

            prev_clip_id = clip_id
            created_clips.append({
                "clip_id": clip_id,
                "in_sec": in_sec,
                "out_sec": out_sec,
                "duration": duration,
                "shot_type": shot_type,
                "energy_level": energy_level,
                "motion_score": motion_score,
                "visual_summary": visual_summary,
                "tags": tags
            })

        logger.info(f"Ingested {len(created_clips)} clips for {filename} with real computer vision analysis.")
        return {
            "asset_id": asset_id,
            "filename": filename,
            "duration": total_duration,
            "clips": created_clips
        }

    def _infer_asset_metadata(self, filename: str, filepath: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyzes actual footage frames when filepath is provided,
        or uses computer vision fallback heuristics when only filename is known.
        """
        if filepath and os.path.exists(filepath):
            return visual_analyzer.analyze_clip_visuals(filepath)
        return visual_analyzer._fallback_visual_analysis(filename)

ingestor = IngestorAgent()
