from typing import List, Dict, Any, Optional, TypedDict

class AgentState(TypedDict):
    request: str
    user_id: str
    memory_context: Optional[Dict[str, Any]]
    plan: List[Dict[str, Any]]
    current_step_index: int
    completed_task_ids: List[str]
    requires_approval: bool
    approval_granted: bool
    simulate_api_failure: bool
    api_failure_recovered: bool
    pending_approval_task: Optional[Dict[str, Any]]
    research_data: Optional[str]
    analysis_results: Optional[Dict[str, Any]]
    execution_output: Optional[Dict[str, Any]]
    verification_result: Optional[Dict[str, Any]]
    retry_count: int
    max_retries: int
    messages: List[Dict[str, str]]
    status: str