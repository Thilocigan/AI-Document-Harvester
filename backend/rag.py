import os
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class RAGChunk:
    def __init__(self, doc_id: str, filename: str, page_number: int, text: str):
        self.doc_id = doc_id
        self.filename = filename
        self.page_number = page_number
        self.text = text

class RAGSystem:
    def __init__(self):
        self.indices: Dict[str, Dict[str, Any]] = {}

    def index_job_documents(self, job_id: str, parsed_docs: List[Dict[str, Any]]):
        chunks: List[RAGChunk] = []

        for doc in parsed_docs:
            filename = doc.get("filename", "unknown.pdf")
            doc_id = doc.get("pdf_id", "doc")
            pages = doc.get("pages", [])

            for p in pages:
                page_num = p.get("page_number", 1)
                text = p.get("text", "")
                if not text.strip():
                    continue

                # Split page into 300-500 character chunks with overlap
                paras = [para.strip() for para in text.split("\n\n") if len(para.strip()) > 30]
                if not paras:
                    paras = [text[i:i+400] for i in range(0, len(text), 350)]

                for para in paras:
                    chunks.append(RAGChunk(
                        doc_id=doc_id,
                        filename=filename,
                        page_number=page_num,
                        text=para
                    ))

        if not chunks:
            return

        corpus = [c.text for c in chunks]
        try:
            vectorizer = TfidfVectorizer(stop_words="english", max_features=4000)
            matrix = vectorizer.fit_transform(corpus)
            self.indices[job_id] = {
                "chunks": chunks,
                "vectorizer": vectorizer,
                "matrix": matrix
            }
        except Exception:
            self.indices[job_id] = {
                "chunks": chunks,
                "vectorizer": None,
                "matrix": None
            }

    def search(self, job_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        index = self.indices.get(job_id)
        if not index or not index["chunks"]:
            return []

        chunks: List[RAGChunk] = index["chunks"]
        vectorizer: Optional[TfidfVectorizer] = index.get("vectorizer")
        matrix = index.get("matrix")

        if vectorizer is None or matrix is None:
            # Fallback simple keyword search
            q_lower = query.lower()
            scored = []
            for c in chunks:
                score = sum(1 for word in q_lower.split() if word in c.text.lower())
                if score > 0:
                    scored.append((score, c))
            scored.sort(key=lambda x: x[0], reverse=True)
            results = [x[1] for x in scored[:top_k]]
        else:
            q_vec = vectorizer.transform([query])
            sims = cosine_similarity(q_vec, matrix)[0]
            top_indices = np.argsort(sims)[::-1][:top_k]
            results = [chunks[i] for i in top_indices if sims[i] > 0.02]
            if not results and len(chunks) > 0:
                results = chunks[:min(top_k, len(chunks))]

        return [
            {
                "filename": r.filename,
                "page_number": r.page_number,
                "excerpt": r.text,
                "citation": f"[{r.filename}, Page {r.page_number}]"
            }
            for r in results
        ]

    async def query(
        self,
        job_id: str,
        question: str,
        openai_key: Optional[str] = None,
        gemini_key: Optional[str] = None
    ) -> Dict[str, Any]:
        contexts = self.search(job_id, question, top_k=4)

        if not contexts:
            return {
                "answer": "No relevant passages were found in the scanned PDF documents for this inquiry.",
                "sources": []
            }

        context_str = "\n\n".join([
            f"Source: {c['filename']} (Page {c['page_number']}):\n{c['excerpt']}"
            for c in contexts
        ])

        final_openai_key = openai_key or os.getenv("OPENAI_API_KEY")
        final_gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")

        if final_openai_key:
            try:
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=final_openai_key)
                prompt = (
                    f"Answer the following question based ONLY on the provided PDF context excerpts. "
                    f"Cite sources using [Filename, Page X]. If not found in context, state so.\n\n"
                    f"Question: {question}\n\nContext:\n{context_str}"
                )
                res = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2
                )
                return {
                    "answer": res.choices[0].message.content,
                    "sources": contexts
                }
            except Exception:
                pass

        if final_gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=final_gemini_key)
                prompt = (
                    f"Answer the following question based ONLY on the provided PDF context excerpts. "
                    f"Cite sources using [Filename, Page X].\n\n"
                    f"Question: {question}\n\nContext:\n{context_str}"
                )
                res = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                return {
                    "answer": res.text,
                    "sources": contexts
                }
            except Exception:
                pass

        # Smart Extractive Synthesis
        answer_parts = []
        for c in contexts:
            answer_parts.append(f"• According to **{c['filename']}** (Page {c['page_number']}): \"{c['excerpt'].strip()}\"")

        synthesized_answer = (
            f"Based on the parsed documents across this domain:\n\n"
            + "\n\n".join(answer_parts)
            + f"\n\n*Directly referenced from {len(contexts)} passages.*"
        )

        return {
            "answer": synthesized_answer,
            "sources": contexts
        }

rag_system = RAGSystem()
