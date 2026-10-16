import time
from typing import Dict, Any, Optional

class CostOptimizer:
    PRICING_TIERS = {
        "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08},
        "qwen/qwen3.8-27b": {"input": 0.80, "output": 4.00},
        "openai/gpt-oss-120b": {"input": 0.15, "output": 0.60}
    }

    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.total_tokens_consumed = 0
        self.total_cost_usd = 0.0
        self.cache_hits = 0
        self.cache_misses = 0

    def select_model(self, task_type: str) -> str:
        """Selects qwen/qwen3.8-27b for reasoning and planning tasks, with lightweight fallbacks."""
        t = task_type.lower()
        if "plan" in t or "analy" in t or "reconcil" in t:
            return "qwen/qwen3.8-27b"
        elif "execut" in t or "verif" in t:
            return "openai/gpt-oss-120b"
        return "llama-3.1-8b-instant"

    def get_cached_result(self, cache_key: str) -> Optional[Any]:
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if time.time() - entry["timestamp"] < 3600:
                self.cache_hits += 1
                return entry["data"]
        self.cache_misses += 1
        return None

    def set_cached_result(self, cache_key: str, data: Any):
        self.cache[cache_key] = {"data": data, "timestamp": time.time()}

    def compute_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        rates = self.PRICING_TIERS.get(model, self.PRICING_TIERS["llama-3.1-8b-instant"])
        cost = (input_tokens / 1_000_000 * rates["input"]) + (output_tokens / 1_000_000 * rates["output"])
        self.total_tokens_consumed += (input_tokens + output_tokens)
        self.total_cost_usd += cost
        return round(cost, 6)

    def get_metrics(self) -> Dict[str, Any]:
        total_requests = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / total_requests * 100) if total_requests > 0 else 0.0
        return {
            "total_tokens_consumed": self.total_tokens_consumed,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "cache_hit_rate_pct": round(hit_rate, 2),
            "estimated_savings_usd": round(self.cache_hits * 0.0012, 4)
        }

cost_optimizer = CostOptimizer()