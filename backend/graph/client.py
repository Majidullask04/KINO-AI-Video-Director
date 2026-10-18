import os
import time
from typing import Any, Dict, List, Optional
from falkordb import FalkorDB

class QueryLogEntry:
    def __init__(self, query: str, params: Optional[Dict[str, Any]], execution_time_ms: float, row_count: int):
        self.query = query
        self.params = params or {}
        self.execution_time_ms = execution_time_ms
        self.row_count = row_count
        self.timestamp = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "params": self.params,
            "execution_time_ms": round(self.execution_time_ms, 2),
            "row_count": self.row_count,
            "timestamp": self.timestamp,
        }

class VideoGraphDB:
    def __init__(self):
        self.host = os.getenv("FALKORDB_HOST", "localhost")
        self.port = int(os.getenv("FALKORDB_PORT", 6379))
        self.password = os.getenv("FALKORDB_PASSWORD", None)
        self.graph_name = os.getenv("FALKORDB_GRAPH_NAME", "ai_video_director")
        self.client = FalkorDB(host=self.host, port=self.port, password=self.password)
        self.graph = self.client.select_graph(self.graph_name)
        self.recent_queries: List[QueryLogEntry] = []

    def query(self, cypher: str, params: Optional[Dict[str, Any]] = None):
        """Execute a write/read Cypher query and log execution metadata."""
        start = time.perf_counter()
        clean_params = params or {}
        res = self.graph.query(cypher, clean_params)
        duration = (time.perf_counter() - start) * 1000.0
        
        row_count = len(res.result_set) if res and hasattr(res, "result_set") and res.result_set else 0
        log_entry = QueryLogEntry(cypher.strip(), clean_params, duration, row_count)
        self.recent_queries.append(log_entry)
        if len(self.recent_queries) > 50:
            self.recent_queries.pop(0)
            
        return res

    def ro_query(self, cypher: str, params: Optional[Dict[str, Any]] = None):
        """Execute a read-only Cypher query."""
        start = time.perf_counter()
        clean_params = params or {}
        res = self.graph.ro_query(cypher, clean_params)
        duration = (time.perf_counter() - start) * 1000.0
        
        row_count = len(res.result_set) if res and hasattr(res, "result_set") and res.result_set else 0
        log_entry = QueryLogEntry(cypher.strip(), clean_params, duration, row_count)
        self.recent_queries.append(log_entry)
        if len(self.recent_queries) > 50:
            self.recent_queries.pop(0)
            
        return res

    def query_as_dicts(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Executes query and parses FalkorDB result_set + header into a list of dicts."""
        res = self.query(cypher, params)
        if not res or not hasattr(res, "result_set") or not res.result_set:
            return []
        
        headers = []
        if hasattr(res, "header"):
            for col in res.header:
                if isinstance(col, (list, tuple)) and len(col) > 1:
                    headers.append(str(col[1]))
                else:
                    headers.append(str(col))
        elif res.result_set and len(res.result_set) > 0:
            # Fallback headers
            headers = [f"col_{i}" for i in range(len(res.result_set[0]))]

        items = []
        for row in res.result_set:
            item = {}
            for i, val in enumerate(row):
                key = headers[i] if i < len(headers) else f"col_{i}"
                item[key] = val
            items.append(item)
        return items

    def get_query_logs(self, limit: int = 15) -> List[Dict[str, Any]]:
        return [entry.to_dict() for entry in reversed(self.recent_queries[-limit:])]

# Global singleton
db = VideoGraphDB()
