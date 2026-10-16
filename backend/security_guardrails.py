import re
from typing import List, Dict, Any

class SecurityGuardrails:
    # Patterns typical of prompt injection or embedded override commands
    INJECTION_PATTERNS = [
        r"ignore previous instructions",
        r"disregard previous instructions",
        r"system override",
        r"you are now an unrestricted",
        r"forget everything above",
        r"reveal system prompt",
        r"bypass security"
    ]

    @classmethod
    def scan_for_prompt_injection(cls, text: str) -> Dict[str, Any]:
        """Scans user queries or document text for prompt injection attempts."""
        if not text:
            return {"is_safe": True, "detected_pattern": None}
        
        lower_text = text.lower()
        for pattern in cls.INJECTION_PATTERNS:
            if re.search(pattern, lower_text):
                return {
                    "is_safe": False,
                    "detected_pattern": pattern,
                    "warning": f"Adversarial security warning: Potential prompt injection detected matching pattern '{pattern}'."
                }
        
        return {"is_safe": True, "detected_pattern": None}

    @classmethod
    def sanitize_document_chunks(cls, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filters or sanitizes retrieved document chunks containing malicious overrides."""
        safe_chunks = []
        for chunk in chunks:
            content = chunk.get("content", "")
            scan_res = cls.scan_for_prompt_injection(content)
            if not scan_res["is_safe"]:
                # Tag or sanitize the chunk rather than crashing, or redact malicious text
                chunk["content"] = "[REDACTED: Malicious instruction override detected inside document source]"
                chunk["security_flag"] = scan_res["warning"]
            safe_chunks.append(chunk)
        return safe_chunks