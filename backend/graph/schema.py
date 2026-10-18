import logging
from backend.graph.client import db

logger = logging.getLogger(__name__)

INDEX_STATEMENTS = [
    "CREATE INDEX FOR (p:Project) ON (p.id)",
    "CREATE INDEX FOR (c:Creator) ON (c.id)",
    "CREATE INDEX FOR (b:StoryBeat) ON (b.id)",
    "CREATE INDEX FOR (vc:VideoClip) ON (vc.id)",
    "CREATE INDEX FOR (v:EditVersion) ON (v.id)",
    "CREATE INDEX FOR (d:CutDecision) ON (d.id)",
    "CREATE INDEX FOR (t:VisualTag) ON (t.name)",
    "CREATE INDEX FOR (m:AudioMood) ON (m.name)",
    "CREATE INDEX FOR (sa:SourceAsset) ON (sa.id)",
]

def init_schema():
    """Initializes schema indices in FalkorDB."""
    for stmt in INDEX_STATEMENTS:
        try:
            db.query(stmt)
        except Exception as e:
            # Index might already exist
            logger.info(f"Schema index statement '{stmt}': {e}")
    logger.info("FalkorDB schema initialized successfully.")

if __name__ == "__main__":
    init_schema()
