# AI & Machine Learning Foundations

> "Machine learning is not magic; it is numerical optimization over high-dimensional vector spaces. Before training foundation models or orchestrating autonomous agents, an engineer must master the mathematical foundation of vectors, loss functions, gradient descent, and neural anatomy."

---

## The 7 Pillars of AI Engineering

This track covers **Pillars 1 through 3** of the unified 7 AI Engineering Pillars, building the core mathematical and deep learning bedrock needed before advancing to foundation models, RAG, and multi-agent systems:

```
[Covered in this Track]
Pillar 1: Math Foundations    - Linear Algebra, Calculus, Probability & Statistics
Pillar 2: Classical ML        - scikit-learn, Regression/Classification, Clustering
Pillar 3: Deep Learning       - PyTorch, Neural Networks, Backpropagation

[Advancing to GenAI & AI Ops]
Pillar 4: Transformers & LLMs - Attention, Embeddings, BERT/GPT, Fine-Tuning (LoRA)
Pillar 5: LLM Engineering     - LangChain, RAG, Vector DBs (Pinecone, FAISS)
Pillar 6: AI Agents           - LangGraph, Tool-Calling, Multi-Agent Orchestration
Pillar 7: AI Ops              - MLflow, Model Serving (vLLM), Eval & Monitoring
```

---

## 1. Prerequisites

### Required
- **Python Programming**: Functions, classes, list comprehensions, NumPy arrays, and Pandas DataFrames.
- **High-School Mathematics**: Vectors, dot products, basic derivatives, and arithmetic averages.

### Recommended
- **Linear Algebra**: Matrix multiplications, vector spaces, and eigenvalues.
- **Calculus**: Partial derivatives, the multivariable chain rule, and gradient vectors.

---

## 2. Visual Sequence Flow: Pillars 1 to 3

```
+─────────────────────────────────────────────────────────────+
|               PILLAR 1: MATHEMATICAL FOUNDATIONS            |
|   Vectors & Matrices ──> Gradients & Partial Derivs ──> Prob|
+──────────────────────────────┬──────────────────────────────+
                               │
                               ▼
+─────────────────────────────────────────────────────────────+
|               PILLAR 2: CLASSICAL MACHINE LEARNING          |
|   Supervised: Regression, Trees, Random Forests, XGBoost    |
|   Unsupervised: K-Means Clustering, PCA Dimensionality Reduc|
|   Production: Metrics (F1, ROC-AUC), Train/Val Splits, Drift|
+──────────────────────────────┬──────────────────────────────+
                               │
                               ▼
+─────────────────────────────────────────────────────────────+
|               PILLAR 3: DEEP LEARNING & PYTORCH             |
|   Anatomy: Perceptrons, Dense Layers, Activations (ReLU/GELU|
|   Training: Loss Functions, Backpropagation, AdamW Optimizer|
|   Framework: PyTorch Tensors, Autograd, nn.Module, DataLoader|
+──────────────────────────────┬──────────────────────────────+
                               │
                               ▼
     → Bridges into [Pillar 4: Transformers & LLMs](../02-GenAI/01-Transformers/README.md)
```

---

## 3. Curriculum Modules & Lesson References

The core lessons for this domain are authored in full technical depth across the 3 foundational modules:

### 01. Mathematical Foundations (`01-Math-Foundations/`)
- [01. Linear Algebra: Vectors, Matrices, and Embeddings](01-Math-Foundations/01-Linear-Algebra-Vectors-Matrices-and-Embeddings.md)
  - Vector operations, dot products, cosine similarity, matrix transformations, high-dimensional embedding spaces.
- [02. Calculus: Gradients and Backpropagation Mathematics](01-Math-Foundations/02-Calculus-Gradients-and-Backpropagation-Math.md)
  - Derivatives, partial derivatives, the multivariable chain rule, gradient vectors, gradient descent intuition.
- [03. Probability, Statistics, and Regression from Scratch](01-Math-Foundations/03-Probability-Statistics-and-Regression-from-Scratch.md)
  - Probability distributions, expected value, variance, Bayes' theorem, ordinary least squares regression from scratch.

### 02. Classical Machine Learning (`02-Classical-ML/`)
- [01. Supervised Algorithms: Regression and Classification](02-Classical-ML/01-Supervised-Algorithms-Regression-and-Classification.md)
  - Linear regression, logistic regression, decision trees, ensemble methods, gradient boosted trees (XGBoost).
- [02. Unsupervised Learning and Dimensionality Reduction](02-Classical-ML/02-Unsupervised-Learning-and-Dimensionality-Reduction.md)
  - K-Means clustering, hierarchical clustering, Principal Component Analysis (PCA), t-SNE, vector visualization.
- [03. Validation Metrics and Production Pitfalls](02-Classical-ML/03-Validation-Metrics-and-Production-Pitfalls.md)
  - Precision, Recall, F1 score, ROC-AUC, confusion matrices, data leakage, covariate shift, and concept drift.

### 03. Deep Learning & PyTorch Fundamentals (`03-Deep-Learning/`)
- [01. Neural Network Anatomy and Activations](03-Deep-Learning/01-Neural-Network-Anatomy-and-Activations.md)
  - Artificial neurons, forward pass, activation functions (Sigmoid, Tanh, ReLU, Leaky ReLU, GELU), universal approximation.
- [02. Loss Functions, Backpropagation, and Optimization](03-Deep-Learning/02-Loss-Functions-Backpropagation-and-Optimization.md)
  - Mean Squared Error (MSE), Binary & Categorical Cross-Entropy, computational graphs, backpropagation calculus, SGD vs AdamW.
- [03. PyTorch Fundamentals and Sequence Architectures](03-Deep-Learning/03-PyTorch-Fundamentals-and-Sequence-Architectures.md)
  - PyTorch tensors, autograd engine, custom `nn.Module` classes, `Dataset` and `DataLoader`, training loops, recurrent foundations (RNN/LSTM).

---

## 4. Exit Criteria & Competency Checklist

You have mastered AI & ML foundations when you can independently:
- [ ] Implement linear regression and binary logistic regression using pure NumPy without Scikit-Learn.
- [ ] Derive and compute partial derivatives for a 2-layer neural network using the multivariable chain rule.
- [ ] Train, evaluate, and tune a gradient-boosted classifier (XGBoost) with proper cross-validation, avoiding data leakage.
- [ ] Build a custom multi-layer neural network in PyTorch using `nn.Module` and write the complete training/validation loop.
- [ ] Explain why Cross-Entropy loss is paired with Softmax and why AdamW uses decoupled weight decay.

---

## 5. Personal Progress Tracking

- [ ] **01. Math Foundations**
  - [ ] Linear Algebra & Cosine Similarity
  - [ ] Partial Derivatives & Gradients
  - [ ] Probability Distributions & Bayes' Theorem
- [ ] **02. Classical Machine Learning**
  - [ ] Supervised Regression & Classification
  - [ ] Ensemble Trees & XGBoost
  - [ ] K-Means & PCA
  - [ ] Precision / Recall / F1 / ROC-AUC
- [ ] **03. Deep Learning & PyTorch**
  - [ ] Activation Functions (ReLU / GELU)
  - [ ] Cross-Entropy Loss & Computational Graphs
  - [ ] PyTorch Tensors & Custom `nn.Module`
  - [ ] Training Loops & Optimizers (AdamW)
  - [ ] Ready for [04. Transformers & LLMs](../02-GenAI/01-Transformers/README.md)
