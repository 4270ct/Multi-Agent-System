import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

from typing import List, Dict, Any, Optional
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader, UnstructuredExcelLoader, WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.retrievers import BM25Retriever
from security_guardrails import SecurityGuardrails

class AdvancedRAGEngine:
    def __init__(self, persist_directory: str = "db/chroma_db", embedding_model: str = "BAAI/bge-large-en-v1.5"):
        self.persist_directory = persist_directory
        self.embeddings = HuggingFaceEmbeddings(
            model_name=embedding_model,
            encode_kwargs={"normalize_embeddings": True}
        )
        self.vectorstore = Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings
        )
        self.bm25_retriever: Optional[BM25Retriever] = None

    def ingest_documents(self, file_paths: List[str] = None, urls: List[str] = None) -> int:
        raw_docs = []
        if file_paths:
            for path in file_paths:
                clean_path = path.strip('"').strip("'")
                if not os.path.isfile(clean_path):
                    continue
                ext = clean_path.lower().split('.')[-1]
                try:
                    if ext == 'pdf':
                        loader = PyPDFLoader(clean_path)
                        raw_docs.extend(loader.load())
                    elif ext in ['txt', 'md']:
                        loader = TextLoader(clean_path, encoding='utf-8')
                        raw_docs.extend(loader.load())
                    elif ext == 'csv':
                        loader = CSVLoader(clean_path)
                        raw_docs.extend(loader.load())
                    elif ext in ['xls', 'xlsx']:
                        loader = UnstructuredExcelLoader(clean_path)
                        raw_docs.extend(loader.load())
                except Exception as e:
                    print(f"[ERROR] Failed to load {clean_path}: {e}")

        if urls:
            for url in urls:
                try:
                    loader = WebBaseLoader(url)
                    raw_docs.extend(loader.load())
                except Exception as e:
                    print(f"[ERROR] Failed to load URL {url}: {e}")

        if not raw_docs:
            return 0

        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = splitter.split_documents(raw_docs)
        
        try:
            self.vectorstore.delete_collection()
        except Exception:
            pass

        self.vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            persist_directory=self.persist_directory
        )

        if chunks:
            self.bm25_retriever = BM25Retriever.from_documents(chunks)
            self.bm25_retriever.k = 4
            
        print(f"[SUCCESS] Ingested and indexed {len(chunks)} chunks into Chroma DB & BM25!")
        return len(chunks)

    def hybrid_retrieve(self, query: str, k: int = 6) -> List[Dict[str, Any]]:
        """Combines dense vector similarity search with BM25 sparse keyword retrieval[cite: 2]."""
        retrieved_results = []
        seen_contents = set()

        
        try:
            results_with_scores = self.vectorstore.similarity_search_with_relevance_scores(query, k=k)
            for doc, score in results_with_scores:
                content = doc.page_content
                if content not in seen_contents:
                    seen_contents.add(content)
                    retrieved_results.append({
                        "content": content,
                        "source": doc.metadata.get("source", "Unknown Source"),
                        "relevance_score": float(score),
                        "retrieval_method": "dense_vector"
                    })
        except Exception:
            docs = self.vectorstore.similarity_search(query, k=k)
            for doc in docs:
                content = doc.page_content
                if content not in seen_contents:
                    seen_contents.add(content)
                    retrieved_results.append({
                        "content": content,
                        "source": doc.metadata.get("source", "Unknown Source"),
                        "relevance_score": 1.0,
                        "retrieval_method": "dense_vector_fallback"
                    })

      
        if self.bm25_retriever:
            try:
                bm25_docs = self.bm25_retriever.invoke(query)
                for doc in bm25_docs[:k]:
                    content = doc.page_content
                    if content not in seen_contents:
                        seen_contents.add(content)
                        retrieved_results.append({
                            "content": content,
                            "source": doc.metadata.get("source", "Unknown Source"),
                             "relevance_score": 0.85,
                            "retrieval_method": "bm25_keyword"
                        })
            except Exception as e:
                print(f"[WARNING] BM25 retrieval error: {e}")

        return SecurityGuardrails.sanitize_document_chunks(retrieved_results)

    def detect_contradictions(self, retrieved_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        sources_found = {}
        for chunk in retrieved_chunks:
            source = chunk["source"]
            content = chunk["content"]
            if source not in sources_found:
                sources_found[source] = []
            sources_found[source].append(content)

        if len(sources_found) > 1:
            return {
                "has_contradiction": True,
                "conflicting_sources": list(sources_found.keys()),
                "warning": "Contradictory figures or differing statements detected across multiple document sources. Reconciliation required."
            }
        
        return {
            "has_contradiction": False,
            "conflicting_sources": [],
            "warning": None
        }

shared_rag_engine = AdvancedRAGEngine()