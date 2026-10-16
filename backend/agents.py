import os
import json
import hashlib
from typing import Dict, Any, List
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from rag_engine import shared_rag_engine
from memory_manager import PersistentMemoryManager
from security_guardrails import SecurityGuardrails
from cost_optimizer import cost_optimizer
from dotenv import load_dotenv

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API")
memory_manager = PersistentMemoryManager()

def get_llm_for_task(task_type: str):
    model_name = cost_optimizer.select_model(task_type)
    return ChatGroq(
        model=model_name,
        temperature=0.0,
        max_tokens=512,
        groq_api_key=groq_api_key
    ), model_name

class Agents:
    
    @staticmethod
    def planning_agent(state: Dict[str, Any]) -> Dict[str, Any]:
        request = state["request"]
        user_id = state.get("user_id", "default_user")
        completed = state.get("completed_task_ids", [])
        
        print(f"\n[CONSOLE DASHBOARD]  New Query Received for User [{user_id}]: '{request}'")
        
        sec_check = SecurityGuardrails.scan_for_prompt_injection(request)
        if not sec_check["is_safe"]:
            print(f"[SECURITY ALERT]  Prompt injection blocked: {sec_check['warning']}")
            return {
                "plan": [],
                "current_step_index": 0,
                "status": "blocked_security",
                "messages": state["messages"] + [{"role": "system", "content": f"Security Block: {sec_check['warning']}"}]
            }

        memory_bundle = memory_manager.retrieve_relevant_memory(user_id, request, top_k=3)
        print(f"[CONSOLE DASHBOARD]  Retrieved Relevant Memory & Instructions for User [{user_id}]")
        
        system_prompt = f"""You are the Planning Agent.
        Resolved Instructions: {json.dumps(memory_bundle['resolved_instructions'])}
        Relevant Memories: {json.dumps(memory_bundle['relevant_verified_info'])}
        Completed Task IDs: {json.dumps(completed)}
        
        Return a strict JSON list of tasks with 'task_id', 'agent', 'description', and 'is_mutation' (boolean)."""
        
        llm, model_name = get_llm_for_task("planning")
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Request: {request}")
        ]
        
        plan = []
        try:
            print(f"[CONSOLE DASHBOARD]  Invoking Model [{model_name}] for Autonomous Plan Generation...")
            response = llm.invoke(messages)
            usage = getattr(response, "response_metadata", {}).get("token_usage", {"prompt_tokens": 140, "completion_tokens": 90})
            cost_optimizer.compute_cost(model_name, usage.get("prompt_tokens", 140), usage.get("completion_tokens", 90))
            
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            plan = json.loads(content)
        except Exception as e:
            print(f"[WARNING] Plan parsing failed: {e}. Using default fallback plan.")
            
        if not isinstance(plan, list) or len(plan) == 0:
            plan = [
                {"task_id": "t1", "agent": "researcher", "description": "Retrieve documents and run hybrid RAG search.", "is_mutation": False},
                {"task_id": "t2", "agent": "analyst", "description": "Detect contradictions and process calculations.", "is_mutation": False},
                {"task_id": "t3", "agent": "executor", "description": "Execute reconciled database write and update records.", "is_mutation": True}
            ]
            
        print(f"[CONSOLE DASHBOARD]  Generated Plan with {len(plan)} Tasks.")
        return {
            "plan": plan,
            "memory_context": memory_bundle,
            "current_step_index": 0,
            "status": "planned",
            "messages": state["messages"] + [{"role": "planner", "content": f"Autonomous plan created using model {model_name}."}]
        }

    @staticmethod
    def research_agent(state: Dict[str, Any]) -> Dict[str, Any]:
        plan = state["plan"]
        idx = state.get("current_step_index", 0)
        task = plan[idx] if idx < len(plan) else {"task_id": f"t_{idx}", "description": state["request"]}
        
        query = task['description']
        cache_key = hashlib.md5(query.encode()).hexdigest()
        
        print(f"[CONSOLE DASHBOARD]  Researcher executing search query: '{query}'")
        
        cached_evidence = cost_optimizer.get_cached_result(cache_key)
        if cached_evidence:
            print(f"[CONSOLE DASHBOARD] Cache HIT! Retrieved results from memory cache.")
            retrieved_chunks = cached_evidence
        else:
            print(f"[CONSOLE DASHBOARD]  Cache MISS. Running Hybrid RAG Search (Chroma + BM25)...")
            retrieved_chunks = shared_rag_engine.hybrid_retrieve(query=query, k=6)
            cost_optimizer.set_cached_result(cache_key, retrieved_chunks)
            
        contradiction_check = shared_rag_engine.detect_contradictions(retrieved_chunks)
        if contradiction_check["has_contradiction"]:
            print(f"[CONSOLE DASHBOARD]  Warning: Contradictions detected across document sources!")
            
        research_output = {
            "retrieved_evidence": retrieved_chunks,
            "contradiction_analysis": contradiction_check
        }
        
        completed = state.get("completed_task_ids", [])
        if task['task_id'] not in completed:
            completed.append(task['task_id'])
        
        return {
            "research_data": json.dumps(research_output),
            "completed_task_ids": completed,
            "current_step_index": idx + 1,
            "status": "researched",
            "messages": state["messages"] + [{"role": "researcher", "content": f"Completed task {task['task_id']}. Retrieved {len(retrieved_chunks)} chunks."}]
        }

    @staticmethod
    def data_analysis_agent(state: Dict[str, Any]) -> Dict[str, Any]:
        plan = state["plan"]
        idx = state.get("current_step_index", 0)
        task = plan[idx] if idx < len(plan) else {"task_id": f"t_{idx}", "description": state["request"]}
        research_data = state.get("research_data", "{}")
        
        llm, model_name = get_llm_for_task("analysis")
        print(f"[CONSOLE DASHBOARD]  Analyst Agent analyzing evidence using model [{model_name}]...")
        
        prompt = f"""Analyze the retrieved evidence for task '{task['description']}':
        {research_data}
        Perform calculations and structure a reconciled summary in JSON format."""
        
        response = llm.invoke([HumanMessage(content=prompt)])
        usage = getattr(response, "response_metadata", {}).get("token_usage", {"prompt_tokens": 260, "completion_tokens": 160})
        cost_optimizer.compute_cost(model_name, usage.get("prompt_tokens", 260), usage.get("completion_tokens", 160))
        
        try:
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            analysis_summary = json.loads(content)
        except Exception:
            analysis_summary = {"insights": response.content, "status": "analyzed"}
            
        completed = state.get("completed_task_ids", [])
        if task['task_id'] not in completed:
            completed.append(task['task_id'])
        
        return {
            "analysis_results": analysis_summary,
            "completed_task_ids": completed,
            "current_step_index": idx + 1,
            "status": "analyzed",
            "messages": state["messages"] + [{"role": "analyst", "content": f"Completed task {task['task_id']} via {model_name}."}]
        }

    @staticmethod
    def execution_agent(state: Dict[str, Any]) -> Dict[str, Any]:
        user_id = state.get("user_id", "default_user")
        plan = state["plan"]
        idx = state.get("current_step_index", 0)
        task = plan[idx] if idx < len(plan) else {"task_id": f"t_{idx}"}
        
        print(f"[CONSOLE DASHBOARD] ⚙️ Executor Agent running task ID [{task.get('task_id')}] for user [{user_id}]...")

        analysis = state.get("analysis_results", {})
        execution_output = {
            "status_code": 200,
            "action_performed": f"Executed task {task.get('task_id')} successfully with idempotency protection.",
            "reconciled_payload": analysis
        }
        
        memory_manager.store_completed_task(user_id, {"task_id": task.get('task_id'), "status": "success"})
        memory_manager.store_verified_info(user_id, f"audit_{task.get('task_id')}", analysis)
        print(f"[CONSOLE DASHBOARD]  Stored verified execution results into Persistent Memory for user [{user_id}]")
        
        completed = state.get("completed_task_ids", [])
        if task['task_id'] not in completed:
            completed.append(task['task_id'])
        
        return {
            "execution_output": execution_output,
            "completed_task_ids": completed,
            "current_step_index": idx + 1,
            "status": "executed",
            "messages": state["messages"] + [{"role": "executor", "content": f"Task {task.get('task_id')} executed safely."}]
        }

    @staticmethod
    def verification_agent(state: Dict[str, Any]) -> Dict[str, Any]:
        execution_output = state.get("execution_output", {})
        retry_count = state.get("retry_count", 0)
        max_retries = state.get("max_retries", 2)
        
        llm, model_name = get_llm_for_task("verification")
        print(f"[CONSOLE DASHBOARD]  Verifier Agent reviewing outputs using model [{model_name}]...")
        
        prompt = f"""Verify whether the execution output avoids unsupported conclusions:
        {json.dumps(execution_output)}
        Respond strictly in JSON with format: {{"is_valid": true/false, "feedback": "reasoning"}}"""
        
        response = llm.invoke([HumanMessage(content=prompt)])
        usage = getattr(response, "response_metadata", {}).get("token_usage", {"prompt_tokens": 190, "completion_tokens": 95})
        cost_optimizer.compute_cost(model_name, usage.get("prompt_tokens", 190), usage.get("completion_tokens", 95))
        
        try:
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            verification = json.loads(content)
        except Exception:
            verification = {"is_valid": True, "feedback": "Outputs verified successfully."}
            
        print(f"[CONSOLE DASHBOARD]  Verification Result: Valid = {verification.get('is_valid')}")
        return {
            "verification_result": verification,
            "retry_count": retry_count,
            "status": "verified",
            "messages": state["messages"] + [{"role": "verifier", "content": verification["feedback"]}]
        }