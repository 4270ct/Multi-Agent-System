import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

class PersistentMemoryManager:
    def __init__(self, db_path: str = "db/memory_store.json"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._load_store()

    def _load_store(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "r", encoding="utf-8") as f:
                    self.store = json.load(f)
            except Exception:
                self.store = {}
        else:
            self.store = {}

    def _save_store(self):
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(self.store, f, indent=2, ensure_ascii=False)

    def _get_user_store(self, user_id: str) -> Dict[str, Any]:
        if user_id not in self.store:
            self.store[user_id] = {
                "short_term": [],
                "long_term_preferences": {},
                "completed_tasks": [],
                "verified_business_info": {},
                "instructions": []
            }
        return self.store[user_id]

    def add_instruction(self, user_id: str, content: str, priority: int = 1, source: str = "user_chat"):
        user_store = self._get_user_store(user_id)
        instruction_entry = {
            "id": f"inst_{datetime.now().strftime('%Y%m%d%H%M%S_%f')}",
            "content": content,
            "priority": priority,
            "timestamp": datetime.now().isoformat(),
            "source": source,
            "active": True
        }
        user_store["instructions"].append(instruction_entry)
        self._save_store()
        print(f"[MEMORY STORE]  Added new instruction for user [{user_id}]: '{content}' (Priority: {priority})")
        return instruction_entry

    def resolve_instructions(self, user_id: str) -> List[str]:
        user_store = self._get_user_store(user_id)
        instructions = [i for i in user_store["instructions"] if i.get("active", True)]
        source_weight = {"admin": 3, "user_explicit": 2, "inferred": 1}
        sorted_insts = sorted(
            instructions,
            key=lambda x: (
                x.get("priority", 1), 
                source_weight.get(x.get("source", "inferred"), 1), 
                x.get("timestamp", "")
            ),
            reverse=True
        )
        return [i["content"] for i in sorted_insts]

    def store_verified_info(self, user_id: str, key: str, value: Any):
        user_store = self._get_user_store(user_id)
        user_store["verified_business_info"][key] = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        self._save_store()
        print(f"[MEMORY STORE]  Stored verified business info under key '{key}' for user [{user_id}]")

    def store_completed_task(self, user_id: str, task_summary: Dict[str, Any]):
        user_store = self._get_user_store(user_id)
        user_store["completed_tasks"].append({
            **task_summary,
            "timestamp": datetime.now().isoformat()
        })
        self._save_store()
        print(f"[MEMORY STORE] Recorded completed task in history for user [{user_id}]")

    def retrieve_relevant_memory(self, user_id: str, query: str, top_k: int = 3) -> Dict[str, Any]:
        user_store = self._get_user_store(user_id)
        tokens = set(query.lower().split())
        
        scored_info = []
        for k, v in user_store.get("verified_business_info", {}).items():
            val_str = json.dumps(v).lower()
            score = sum(1 for t in tokens if t in val_str or t in k.lower())
            if score > 0:
                scored_info.append({"key": k, "data": v, "score": score})
        
        scored_info.sort(key=lambda x: x["score"], reverse=True)
        print(f"[MEMORY RETRIEVAL] Searched memory store for query '{query}' -> Found {len(scored_info[:top_k])} matching records.")
        
        return {
            "relevant_verified_info": scored_info[:top_k],
            "resolved_instructions": self.resolve_instructions(user_id),
            "preferences": user_store.get("long_term_preferences", {})
        }