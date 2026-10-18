import os
import time
import logging
from typing import Any, Dict, List, Optional
from falkordb import FalkorDB

logger = logging.getLogger("ai_video_director.graph")

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
        self.host = (os.getenv("FALKORDB_HOST") or "localhost").strip()
        port_raw = (os.getenv("FALKORDB_PORT") or "6379").strip()
        self.port = int(port_raw) if port_raw.isdigit() else 6379
        
        raw_password = os.getenv("FALKORDB_PASSWORD")
        if raw_password:
            raw_password = raw_password.strip().strip("'").strip('"')
        self.password = raw_password if raw_password not in ("", "None", "null") else None
        
        raw_username = os.getenv("FALKORDB_USERNAME")
        if raw_username:
            raw_username = raw_username.strip().strip("'").strip('"')
        self.username = raw_username if raw_username not in ("", "None", "null") else None
        
        self.graph_name = (os.getenv("FALKORDB_GRAPH_NAME") or "ai_video_director").strip()
        
        ssl_env = (os.getenv("FALKORDB_SSL") or "").lower().strip()
        if ssl_env in ("true", "1", "yes"):
            self.ssl = True
        elif ssl_env in ("false", "0", "no"):
            self.ssl = False
        else:
            self.ssl = (self.port == 6380)
            
        self.url = (os.getenv("FALKORDB_URL") or os.getenv("REDIS_URL") or "").strip() or None
        
        self._client: Optional[FalkorDB] = None
        self._graph = None
        self.recent_queries: List[QueryLogEntry] = []

    def get_client(self) -> FalkorDB:
        if self._client is None:
            if self.url:
                self._client = FalkorDB.from_url(self.url)
            else:
                base_kwargs = {
                    "host": self.host,
                    "port": self.port,
                }
                if self.password:
                    base_kwargs["password"] = self.password
                if self.ssl:
                    base_kwargs["ssl"] = True

                candidates = [self.username] if self.username else (["falkordb", "default", None] if self.password else [None])
                last_err = None
                for u in candidates:
                    attempt_kwargs = dict(base_kwargs)
                    if u:
                        attempt_kwargs["username"] = u
                    try:
                        self._client = FalkorDB(**attempt_kwargs)
                        break
                    except Exception as e:
                        last_err = e
                        self._client = None
                        continue
                if self._client is None and last_err:
                    raise last_err
        return self._client

    @property
    def graph(self):
        if self._graph is None:
            client = self.get_client()
            self._graph = client.select_graph(self.graph_name)
        return self._graph

    def query(self, cypher: str, params: Optional[Dict[str, Any]] = None):
        """Execute a write/read Cypher query and log execution metadata."""
        start = time.perf_counter()
        clean_params = params or {}
        try:
            res = self.graph.query(cypher, clean_params)
        except Exception as e:
            # If connection was lost or timed out, reset client to retry once
            logger.warning(f"Query failed, reconnecting FalkorDB: {e}")
            self._client = None
            self._graph = None
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
        try:
            res = self.graph.ro_query(cypher, clean_params)
        except Exception as e:
            logger.warning(f"Read-only query failed, reconnecting FalkorDB: {e}")
            self._client = None
            self._graph = None
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
