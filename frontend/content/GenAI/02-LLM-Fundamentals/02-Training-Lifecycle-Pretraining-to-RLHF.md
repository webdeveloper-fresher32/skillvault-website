# Training Lifecycle: Pretraining to RLHF — Complete Guide

> "Pretraining is like raising a child on an entire library of books so they absorb grammar, world facts, and reasoning; Supervised Fine-Tuning is teaching them how to answer questions politely; and RLHF is mentoring them with feedback on which answers are genuinely helpful rather than merely eloquent."

---

## Table of Contents

1. [The Problem: Why Raw Pretrained Models Make Terrible Assistants](#1-the-problem-why-raw-pretrained-models-make-terrible-assistants)
2. [The Education of a Scholar Analogy](#2-the-education-of-a-scholar-analogy)
3. [The Mechanism: The Three Pillars of Foundation Model Training](#3-the-mechanism-the-three-pillars-of-foundation-model-training)
4. [Diagram: The 3-Stage Training Pipeline (Pretraining ──► SFT ──► RLHF/DPO)](#4-diagram-the-3-stage-training-pipeline-pretraining-sft-rlhfdpo)
5. [Code Walkthrough: Simulating SFT and DPO Loss Functions](#5-code-walkthrough-simulating-sft-and-dpo-loss-functions)
6. [Comparing Pretraining vs SFT vs RLHF vs DPO](#6-comparing-pretraining-vs-sft-vs-rlhf-vs-dpo)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Why Raw Pretrained Models Make Terrible Assistants

Imagine spending \$20 million training an 8-billion-parameter Transformer on 15 trillion tokens of text from the internet, books, code, and academic papers.

You now test your newly trained model with a straightforward user query:
```text
User: "How do I make scrambled eggs?"
```

What does a raw, pretrained **base model** output?
```text
Base Model Output:
"How do I make pancakes? How do I make toast? Question 4: Explain the difference
between boiling and poaching. Chapter 2: Breakfast Recipes for Commercial Kitchens..."
```

### Why Did the Base Model Fail?

The base model did not fail — it did **exactly** what it was trained to do: predict the most statistically probable next tokens following the input string! On the internet, a question is frequently followed by more exam questions, recipe book tables of contents, or forum comments, not a direct, helpful, step-by-step assistant response.

### What's Missing

A base model is a raw text autocompleter. To convert a raw text predictor into an obedient, helpful, harmless AI assistant (like ChatGPT or Claude), models must pass through two additional training stages: **Supervised Fine-Tuning (SFT)** and **Preference Alignment (RLHF / DPO)**.

---

## 2. The Education of a Scholar Analogy

Consider the journey of training an expert technical consultant.

### The Three Stages of Mastery

```text
Stage 1: Self-Study (Pretraining):
  The student reads 100,000 textbooks, encyclopedias, and code repositories.
  - Absorbs grammar, vocabulary, programming syntax, and historical facts.
  - Total Knowledge: 99% of what the model will ever know.
  - Communication Skill: Speaks in disjointed textbook paragraphs.

Stage 2: Apprentice Training (Supervised Fine-Tuning / SFT):
  The student is shown 50,000 example consultations:
  - "When a client asks Question X, format your answer clearly like Example Y."
  - Learns: "I am an AI assistant. I follow instructions and format answers."

Stage 3: Professional Mentorship (RLHF / Preference Alignment):
  The student provides two answers; a senior partner grades them:
  - "Answer A is technically correct but condescending and dangerous."
  - "Answer B is clear, polite, and safe. Answer B is better."
  - The model internalizes human values, safety, and helpfulness.
```

---

## 3. The Mechanism: The Three Pillars of Foundation Model Training

Every modern production model undergoes three sequential training phases.

### 1. Pretraining (Self-Supervised Learning)

- **The Dataset**: Massive web-scale corpora (e.g. 15 trillion tokens for Llama 3) sourced from Common Crawl, curated books, Wikipedia, ArXiv papers, and open-source code (The Stack).
- **The Objective**: Causal language modeling — predicting the next token $x_t$ given preceding context $x_{<t}$:
  $$\mathcal{L}_{\text{pretrain}}(\theta) = -\sum_{t=1}^T \log P_\theta(x_t \mid x_1, \dots, x_{t-1})$$
- **Compute & Scaling Laws**: Pretraining consumes $99\%$ of the total compute budget. The **Chinchilla Scaling Laws** establish that for compute-optimal training, parameter count and training token volume should scale in equal proportion: a 70B model requires $\approx 1.4–2.0$ trillion tokens minimum, while modern models are trained on $10\times$ more tokens to maximize downstream inference efficiency.

### 2. Supervised Fine-Tuning (SFT / Instruction Tuning)

- **The Dataset**: 50,000 to 500,000 exceptionally high-quality `(instruction, target_response)` pairs created by human subject-matter experts or distilled from frontier models.
- **The Objective**: Same cross-entropy loss as pretraining, but computed **strictly on the completion tokens**, masking out the prompt tokens from the loss:
  $$\mathcal{L}_{\text{SFT}}(\theta) = -\sum_{t \in \text{completion}} \log P_\theta(x_t \mid x_{<t})$$
- **The Result**: The model stops autocompleting and begins adopting the persona of an instruction-following assistant.

### 3. Preference Alignment: RLHF and DPO

While SFT teaches structure, it cannot penalize subtle hallucinations, verbosity, or unsafe outputs. Preference alignment optimizes the model using human comparison judgments: `"Response A is better than Response B"`.

#### RLHF (Reinforcement Learning from Human Feedback)
1. **Reward Model**: Train a separate scoring model $r_\psi(x, y)$ on human preferences ($y_w \succ y_l$) using a pairwise ranking loss:
   $$\mathcal{L}_{\text{RM}}(\psi) = -\mathbb{E}\left[\log \sigma\left(r_\psi(x, y_w) - r_\psi(x, y_l)\right)\right]$$
2. **PPO Optimization**: Use Proximal Policy Optimization (PPO) to update the LLM policy $\pi_\theta$ to maximize the reward score, while adding a **KL-Divergence penalty** preventing the model from drifting too far from the base SFT model:
   $$\text{Objective} = \mathbb{E}\left[ r_\psi(x, y) - \beta D_{\text{KL}}(\pi_\theta(y \mid x) \parallel \pi_{\text{SFT}}(y \mid x)) \right]$$

#### DPO (Direct Preference Optimization)
RLHF with PPO is notoriously unstable, computationally expensive, and requires loading 4 separate neural networks in memory (Actor, Critic, Reward Model, Reference Model). **DPO** eliminates the reward model and reinforcement learning entirely. It mathematically proves that preference alignment can be optimized directly using an exact closed-form cross-entropy loss over the model's own log-probabilities:

$$\mathcal{L}_{\text{DPO}}(\theta) = -\mathbb{E}_{(x, y_w, y_l)} \left[ \log \sigma \left( \beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} \right) \right]$$

DPO is now the dominant industry standard for aligning open and enterprise models.

---

## 4. Diagram: The 3-Stage Training Pipeline

```text
STAGE 1: PRETRAINING (Self-Supervised on Trillions of Tokens)
  [ Web Crawl, Books, Code ] ──► [ Train Decoder-Only Transformer ] ──► Base Model
  (Consumes $10M–$100M compute; learns world grammar and facts; raw autocompleter)

STAGE 2: SUPERVISED FINE-TUNING / SFT (Instruction Tuning)
  [ Curated (Prompt, Ideal Answer) Pairs ] ──► [ Masked Cross-Entropy ] ──► SFT Model
  (Teaches conversational format, tool calling, and instruction following)

STAGE 3: PREFERENCE ALIGNMENT (RLHF / DPO)
  Pairs of [ Chosen Answer (y_w) vs Rejected Answer (y_l) ]
                       │
                       ▼
            [ DPO Loss Optimization ] ──► Aligned Assistant Model (ChatGPT, Claude, Llama-Instruct)
  (Enforces helpfulness, safety, truthfulness, and conciseness)
```

---

## 5. Code Walkthrough: Simulating SFT and DPO Loss Functions

Here is a complete Python and PyTorch implementation of the Supervised Fine-Tuning loss with prompt masking and the Direct Preference Optimization (DPO) loss function:

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

# 1. SFT Loss with Prompt Masking
# We calculate loss strictly on completion tokens, ignoring prompt tokens!
def compute_sft_loss(logits: torch.Tensor, labels: torch.Tensor, prompt_mask: torch.Tensor) -> torch.Tensor:
    # logits: (batch_size, seq_len, vocab_size)
    # labels: (batch_size, seq_len)
    # prompt_mask: 1 for completion tokens, 0 for prompt tokens
    
    # Flatten tensors
    batch_size, seq_len, vocab_size = logits.size()
    flat_logits = logits.view(-1, vocab_size)
    flat_labels = labels.view(-1)
    flat_mask   = prompt_mask.view(-1).float()
    
    # Compute per-token cross entropy without reduction
    loss_per_token = F.cross_entropy(flat_logits, flat_labels, reduction="none")
    
    # Apply mask so prompt tokens contribute ZERO loss
    masked_loss = loss_per_token * flat_mask
    
    # Return average loss over completion tokens only
    return masked_loss.sum() / flat_mask.sum()

# 2. DPO (Direct Preference Optimization) Loss Function
class DPOLoss(nn.Module):
    def __init__(self, beta: float = 0.1):
        super().__init__()
        self.beta = beta  # Scaling factor controlling regularization strength

    def forward(
        self,
        policy_chosen_logps: torch.Tensor,
        policy_rejected_logps: torch.Tensor,
        reference_chosen_logps: torch.Tensor,
        reference_rejected_logps: torch.Tensor
    ) -> torch.Tensor:
        # Calculate log-ratio of policy vs reference for winning (chosen) responses
        chosen_log_ratios = policy_chosen_logps - reference_chosen_logps
        
        # Calculate log-ratio of policy vs reference for losing (rejected) responses
        rejected_log_ratios = policy_rejected_logps - reference_rejected_logps
        
        # DPO implicit reward margin
        logits = self.beta * (chosen_log_ratios - rejected_log_ratios)
        
        # Binary cross entropy: -log(sigmoid(logits))
        losses = -F.logsigmoid(logits)
        return losses.mean()

# 3. Test SFT Loss with Masking
batch_size, seq_len, vocab_size = 2, 6, 100
mock_logits = torch.randn(batch_size, seq_len, vocab_size)
mock_labels = torch.randint(0, vocab_size, (batch_size, seq_len))

# Prompt mask: first 3 tokens are prompt (0), last 3 are assistant completion (1)
mask = torch.tensor([
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1, 1]
])

sft_loss = compute_sft_loss(mock_logits, mock_labels, mask)
print(f"SFT Loss (Computed strictly on completion tokens): {sft_loss.item():.4f}")

# 4. Test DPO Loss
dpo = DPOLoss(beta=0.1)

# Scenario: Model assigns higher probability to chosen answer over rejected answer
pol_chosen = torch.tensor([-2.5, -3.1])    # Policy logP of winning responses
pol_reject = torch.tensor([-6.8, -7.2])    # Policy logP of losing responses
ref_chosen = torch.tensor([-3.0, -3.5])    # Frozen reference model logPs
ref_reject = torch.tensor([-5.0, -5.2])

loss = dpo(pol_chosen, pol_reject, ref_chosen, ref_reject)
print(f"DPO Alignment Loss: {loss.item():.4f} (Drives model to prefer chosen responses!)")
```

---

## 6. Comparing Pretraining vs SFT vs RLHF vs DPO

### Training Lifecycle Matrix

| Phase | Dataset Size | Primary Objective | Hardware / Cost | Critical Failure Mode |
|---|---|---|---|---|
| **Pretraining** | $1–15$ Trillion tokens | Next-token prediction | Thousands of GPUs (\$1M–\$50M+) | Mode collapse, toxic web memorization. |
| **SFT (Instruction Tuning)** | $10\text{k}–500\text{k}$ examples | Format & instruction compliance | 8–64 GPUs (\$5k–\$50k) | Superficial compliance without deep reasoning. |
| **RLHF (PPO)** | $20\text{k}–100\text{k}$ human comparisons | Reward maximization with KL penalty | 32–128 GPUs | **Reward Hacking**: model writes long, sycophantic fluff to game the reward model. |
| **DPO** | $20\text{k}–100\text{k}$ pairwise preferences | Direct implicit reward optimization | 8–32 GPUs | Overfitting if dataset lacks diversity; sensitivity to $\beta$. |

---

## 7. Common Mistakes

- **Assuming fine-tuning is used to teach a model new factual knowledge.** Pretraining is where models absorb knowledge. Trying to inject new internal factual databases via SFT frequently triggers hallucinations. Use **RAG** for new knowledge, and fine-tuning for **style, format, and behavior**.
- **Not masking out prompt tokens during SFT.** Calculating loss on user prompt tokens forces the model to memorize and predict the user's questions rather than focusing its capacity on generating the answers. Always mask prompts with `-100` label IDs in PyTorch.
- **Setting $\beta$ too low in DPO.** The $\beta$ parameter acts as the temperature and KL penalty. If $\beta$ is too small (e.g. $0.001$), the policy diverges wildly from the reference model, leading to degraded linguistic coherence and gibberish outputs. Keep $\beta \in [0.05, 0.20]$.
- **Confusing Base models with Instruct/Chat models in production.** Deploying `meta-llama/Llama-3-8B` (base) into a customer chatbot will result in the model repeating customer queries or printing internet boilerplate. You must deploy `meta-llama/Llama-3-8B-Instruct`!

---

## 8. Hands-On Exercises

**Exercise 1:** Inspect the difference between a Base model and an Instruct model using Hugging Face: prompt `gpt2` (base) with `"Explain what an API is:"` versus an instruct-tuned model, documenting the difference in output style.

**Exercise 2:** Format an SFT dataset using the standard ChatML / ShareGPT schema: convert raw customer support transcripts into `{"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}` format.

**Exercise 3:** Implement the Pairwise Reward Model Ranking Loss in PyTorch: given scalar reward scores $r_w$ for winning responses and $r_l$ for losing responses, compute $-\log \sigma(r_w - r_l)$.

**Exercise 4:** Implement Reward Hacking detection: write a script that analyzes model generations for length inflation across iterations, demonstrating that models unconstrained by length penalties exploit reward models simply by writing longer responses.

**Exercise 5:** Verify KL-divergence drift: compute $D_{\text{KL}}(P \parallel Q) = \sum P(x) \log\frac{P(x)}{Q(x)}$ between two categorical token distributions, showing how it bounds policy exploration.

---

## 9. Interview Q&A

**Q: What is the "Superficial Alignment Hypothesis" in modern LLM research?**
Proposed by the LIMA (Less Is More for Alignment) research team at Meta, the hypothesis posits that almost all of a model's foundational knowledge, reasoning capabilities, and linguistic world models are learned entirely during the **pretraining** phase. Supervised Fine-Tuning (SFT) and alignment do not teach new knowledge; they merely act as a superficial "style filter" that teaches the model which sub-distribution of its pretrained capabilities to expose (the persona of a helpful assistant) and what formatting syntax (markdown, turn markers) to use.

**Q: What is Reward Hacking in RLHF, and how does the KL-divergence penalty prevent it?**
Reward hacking occurs when a reinforcement learning agent finds an unintended shortcut that maximizes the mathematical reward function without satisfying the true underlying goal. In LLMs, reward models trained on human preferences often develop biases favoring overly long, bulleted, sycophantic, or overly polite responses. Without constraints, PPO will optimize the LLM to generate 10-paragraph verbose answers to simple questions. The **KL-divergence penalty** $-\beta D_{\text{KL}}(\pi_\theta \parallel \pi_{\text{ref}})$ penalizes the policy model whenever its token probability distribution drifts too far from the original SFT reference model, keeping outputs grounded and preventing reward exploitation.

**Q: How does Direct Preference Optimization (DPO) eliminate the need for a separate Reward Model?**
Under the Bradley-Terry preference model, the probability that response $y_w$ is preferred over $y_l$ is $P(y_w \succ y_l) = \sigma(r(x, y_w) - r(x, y_l))$. In standard RLHF, the optimal policy satisfies $\pi_\theta(y \mid x) \propto \pi_{\text{ref}}(y \mid x) \exp(\frac{1}{\beta} r(x, y))$. DPO analytically solves for the reward function in terms of the optimal policy: $r(x, y) = \beta \log \frac{\pi_\theta(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)$. By substituting this exact expression directly into the Bradley-Terry preference likelihood, the unknown partition function $Z(x)$ cancels out, allowing direct optimization of the policy $\pi_\theta$ via binary cross-entropy on winning and losing responses without ever training or serving a reward model.

**Q: What are the Chinchilla Scaling Laws, and how did they change modern pretraining strategies?**
Hoffmann et al. (DeepMind, 2022) demonstrated that prior models (like GPT-3 175B) were severely **under-trained**: too much compute was invested in model parameters and too little in token volume. Chinchilla proved that for compute-optimal training, parameter count and token volume should scale in equal $1:1$ proportion: doubling model size requires doubling training tokens. Furthermore, Meta (Llama series) demonstrated that for **inference-optimal** deployment, training a smaller model (e.g. 8B parameters) on significantly *more* tokens (15 trillion tokens) costs more during pretraining but yields an exceptionally fast, cheap model for millions of downstream customer inference calls.

**Q: Why do base models hallucinate when asked for real-time or private enterprise facts?**
Base models have no access to external databases, private intranets, or events occurring after their pretraining knowledge cutoff date. When prompted for facts outside their training data, the autoregressive objective does not reward admitting ignorance; it rewards outputting the most statistically fluent, grammatically convincing sequence of words. The model generates tokens that match the stylistic patterns of authoritative answers (hallucination) because it is fundamentally an autocomplete engine predicting plausible text, not a verified database retrieval engine.
