from langgraph.graph import StateGraph, END
from agent_state import AgentState
from agents import Agents

def intelligent_task_router(state: AgentState):
    """Router using case-insensitive substring matching; defers state mutation to approval_gate_node."""
    plan = state.get("plan", [])
    idx = state.get("current_step_index", 0)
    completed = state.get("completed_task_ids", [])
    
    if idx >= len(plan):
        return "verifier"
    
    current_task = plan[idx]
    task_id = current_task.get("task_id", f"t_{idx}")
    
    
    if task_id in completed:
        state["current_step_index"] = idx + 1
        return intelligent_task_router(state)
    
    if current_task.get("is_mutation", False) and not state.get("approval_granted", False):
        return "approval_gate"
    
    agent_type = str(current_task.get("agent", "researcher")).lower()
    if "analy" in agent_type:
        return "analyst"
    elif "execut" in agent_type:
        return "executor"
    elif "verif" in agent_type:
        return "verifier"
    else:
        return "researcher"

def approval_gate_node(state: AgentState):
    """Mutates graph state safely in node[cite: 3]."""
    plan = state.get("plan", [])
    idx = state.get("current_step_index", 0)
    task = plan[idx] if idx < len(plan) else {}
    
    return {
        "status": "awaiting_approval",
        "requires_approval": True,
        "approval_granted": False,
        "pending_approval_task": task,
        "messages": state.get("messages", []) + [{"role": "system", "content": f"Paused for approval: {task.get('description', 'Mutation task')}"}]
    }

def should_continue_after_verification(state: AgentState):
    verification = state.get("verification_result", {})
    if verification and not verification.get("is_valid", True) and state["retry_count"] <= state["max_retries"]:
        return "replan"
    return "end"

def build_orchestrator_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("planner", Agents.planning_agent)
    workflow.add_node("researcher", Agents.research_agent)
    workflow.add_node("analyst", Agents.data_analysis_agent)
    workflow.add_node("executor", Agents.execution_agent)
    workflow.add_node("verifier", Agents.verification_agent)
    workflow.add_node("approval_gate", approval_gate_node)

    workflow.set_entry_point("planner")

    workflow.add_conditional_edges(
        "planner",
        intelligent_task_router,
        {"researcher": "researcher", "analyst": "analyst", "executor": "executor", "verifier": "verifier", "approval_gate": "approval_gate"}
    )
    workflow.add_conditional_edges(
        "researcher",
        intelligent_task_router,
        {"researcher": "researcher", "analyst": "analyst", "executor": "executor", "verifier": "verifier", "approval_gate": "approval_gate"}
    )
    workflow.add_conditional_edges(
        "analyst",
        intelligent_task_router,
        {"researcher": "researcher", "analyst": "analyst", "executor": "executor", "verifier": "verifier", "approval_gate": "approval_gate"}
    )
    workflow.add_conditional_edges(
        "executor",
        intelligent_task_router,
        {"researcher": "researcher", "analyst": "analyst", "executor": "executor", "verifier": "verifier", "approval_gate": "approval_gate"}
    )

    workflow.add_edge("approval_gate", END)

    workflow.add_conditional_edges(
        "verifier",
        should_continue_after_verification,
        {"replan": "planner", "end": END}
    )

    return workflow.compile()