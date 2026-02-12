"""Episodic memory for agents — lightweight vector store with ONNX embeddings.

Each agent can commit episodes (decisions, outcomes, lessons) and recall
similar past experiences via semantic similarity search.

Uses all-MiniLM-L6-v2 ONNX model (22M params, 384-dim embeddings) for
local sentence embeddings. Stores episodes as a JSON file on disk with
numpy for cosine similarity. No external services needed.

Usage:
    from agents.memory import get_memory

    memory = get_memory()

    # Store an episode
    memory.commit(
        agent="scout",
        task_type="discover_issues",
        episode="archive.org API returned 0 results for 1995. Switched to AD Archive.",
        metadata={"strategy": "fallback_source", "outcome": "success"}
    )

    # Recall similar experiences
    episodes = memory.recall(
        "archive.org API returned 0 results for 1990",
        agent="scout",
        n=3
    )
"""

import json
import logging
import os
import time
import threading

import numpy as np

logger = logging.getLogger(__name__)

# Lazy-loaded singleton
_memory_instance = None
_init_attempted = False
_init_lock = threading.Lock()

MEMORY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "agent_memory")
STORE_FILE = "episodes.json"
MAX_EPISODES = 10000  # Cap to prevent unbounded growth (~5MB at capacity)


class EmbeddingModel:
    """Lightweight sentence embedding using ONNX runtime.

    Loads all-MiniLM-L6-v2 (22M params) from HuggingFace cache.
    Produces 384-dimensional normalized embeddings.
    """

    def __init__(self):
        import onnxruntime as ort
        from tokenizers import Tokenizer
        from huggingface_hub import hf_hub_download

        model_path = hf_hub_download(
            "sentence-transformers/all-MiniLM-L6-v2", "onnx/model.onnx"
        )
        tokenizer_path = hf_hub_download(
            "sentence-transformers/all-MiniLM-L6-v2", "tokenizer.json"
        )

        self._session = ort.InferenceSession(model_path)
        self._tokenizer = Tokenizer.from_file(tokenizer_path)
        self._tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")
        self._tokenizer.enable_truncation(max_length=256)

    def embed(self, texts: list[str]) -> np.ndarray:
        """Compute normalized embeddings for a batch of texts.

        Args:
            texts: List of strings to embed.

        Returns:
            np.ndarray of shape (len(texts), 384), L2-normalized.
        """
        encoded = self._tokenizer.encode_batch(texts)
        input_ids = np.array([e.ids for e in encoded], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)
        token_type_ids = np.zeros_like(input_ids, dtype=np.int64)

        outputs = self._session.run(
            None,
            {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids,
            },
        )

        # Mean pooling over token embeddings
        token_embeddings = outputs[0]  # (batch, seq_len, hidden_dim)
        mask_expanded = np.expand_dims(attention_mask, -1).astype(np.float32)
        embeddings = np.sum(token_embeddings * mask_expanded, axis=1) / np.maximum(
            mask_expanded.sum(axis=1), 1e-9
        )

        # L2 normalize
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        embeddings = embeddings / np.maximum(norms, 1e-9)

        return embeddings

    def embed_one(self, text: str) -> np.ndarray:
        """Embed a single text. Returns 1D array of shape (384,)."""
        return self.embed([text])[0]


class AgentMemory:
    """JSON-backed episodic memory with ONNX sentence embeddings.

    Episodes are stored as a list in a JSON file. Each episode has:
    - text: The episode description (embedded for similarity search)
    - embedding: Pre-computed 384-dim vector
    - metadata: Filterable fields (agent, task_type, outcome, timestamp, etc.)

    Queries use cosine similarity on pre-computed embeddings.
    """

    def __init__(self, persist_dir=None):
        self._dir = persist_dir or os.path.abspath(MEMORY_DIR)
        os.makedirs(self._dir, exist_ok=True)
        self._store_path = os.path.join(self._dir, STORE_FILE)
        self._lock = threading.Lock()

        # Load existing episodes
        self._episodes = self._load()

        # Pre-compute embedding matrix for fast batch similarity
        self._embedding_matrix = None
        if self._episodes:
            self._rebuild_matrix()

        # Lazy-load embedding model (expensive — ~1s to load)
        self._model = None

        logger.info(f"AgentMemory initialized: {len(self._episodes)} episodes in store")

    def _get_model(self) -> EmbeddingModel:
        """Lazy-load the ONNX embedding model."""
        if self._model is None:
            self._model = EmbeddingModel()
        return self._model

    def _load(self) -> list[dict]:
        """Load episodes from disk."""
        if not os.path.exists(self._store_path):
            return []
        try:
            with open(self._store_path) as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _save(self):
        """Persist episodes to disk."""
        try:
            with open(self._store_path, "w") as f:
                json.dump(self._episodes, f, separators=(",", ":"))
        except OSError as e:
            logger.warning(f"AgentMemory._save failed: {e}")

    def _rebuild_matrix(self):
        """Rebuild the cached embedding matrix from stored episodes."""
        if not self._episodes:
            self._embedding_matrix = None
            return
        vecs = [ep["embedding"] for ep in self._episodes]
        self._embedding_matrix = np.array(vecs, dtype=np.float32)

    def commit(self, agent: str, task_type: str, episode: str, metadata: dict = None):
        """Store an episode in memory.

        Args:
            agent: Agent name (scout, courier, reader, etc.)
            task_type: Task type (discover_issues, download_pdf, etc.)
            episode: Free-text description — this gets embedded for similarity.
            metadata: Additional filterable fields. Values must be str/int/float/bool.
        """
        model = self._get_model()
        embedding = model.embed_one(episode)

        entry = {
            "text": episode,
            "embedding": embedding.tolist(),
            "agent": agent,
            "task_type": task_type,
            "timestamp": int(time.time()),
        }
        if metadata:
            for k, v in metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    entry[k] = v

        with self._lock:
            self._episodes.append(entry)

            # Cap growth
            if len(self._episodes) > MAX_EPISODES:
                self._episodes = self._episodes[-MAX_EPISODES:]

            self._rebuild_matrix()
            self._save()

    def recall(
        self,
        query: str,
        agent: str = None,
        task_type: str = None,
        outcome: str = None,
        n: int = 5,
    ) -> list[dict]:
        """Recall similar past episodes via cosine similarity.

        Args:
            query: Current situation to find similar episodes for.
            agent: Filter to a specific agent (optional).
            task_type: Filter to a specific task type (optional).
            outcome: Filter by outcome (optional).
            n: Max results to return.

        Returns:
            List of dicts sorted by similarity (most similar first):
            {episode, agent, task_type, distance, metadata}
        """
        if not self._episodes or self._embedding_matrix is None:
            return []

        # Filter candidates by metadata first
        mask = np.ones(len(self._episodes), dtype=bool)
        for i, ep in enumerate(self._episodes):
            if agent and ep.get("agent") != agent:
                mask[i] = False
            elif task_type and ep.get("task_type") != task_type:
                mask[i] = False
            elif outcome and ep.get("outcome") != outcome:
                mask[i] = False

        if not mask.any():
            return []

        # Compute similarity
        model = self._get_model()
        query_vec = model.embed_one(query)

        # Cosine similarity = dot product of normalized vectors
        similarities = self._embedding_matrix @ query_vec  # (num_episodes,)

        # Apply mask (set non-matching to -inf)
        similarities[~mask] = -np.inf

        # Get top-n indices
        top_k = min(n, int(mask.sum()))
        top_indices = np.argsort(similarities)[-top_k:][::-1]

        results = []
        for idx in top_indices:
            if similarities[idx] == -np.inf:
                break
            ep = self._episodes[idx]
            results.append({
                "episode": ep["text"],
                "agent": ep.get("agent", ""),
                "task_type": ep.get("task_type", ""),
                "distance": float(1.0 - similarities[idx]),  # Convert similarity to distance
                "metadata": {
                    k: v for k, v in ep.items()
                    if k not in ("text", "embedding")
                },
            })
        return results

    def count(self) -> int:
        """Total episodes stored."""
        return len(self._episodes)


def get_memory() -> AgentMemory | None:
    """Get the singleton AgentMemory instance. Returns None if init fails."""
    global _memory_instance, _init_attempted
    with _init_lock:
        if _memory_instance is not None:
            return _memory_instance
        if _init_attempted:
            return None
        _init_attempted = True
    try:
        _memory_instance = AgentMemory()
        return _memory_instance
    except Exception as e:
        logger.warning(f"AgentMemory unavailable: {e}")
        return None
