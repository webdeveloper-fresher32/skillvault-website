# Experiment Tracking and Model Registries — Complete Guide

> "Training models without experiment tracking is like maintaining a production database without migration files: you know something changed, you have no idea what caused the regression, and you can never reproduce last week's working build."

---

## Table of Contents

1. [The Problem: The Chaos of Unversioned Experiments](#1-the-problem-the-chaos-of-unversioned-experiments)
2. [The Database Migration and Package Registry Analogy](#2-the-database-migration-and-package-registry-analogy)
3. [The Mechanism: The MLOps Lifecycle and MLflow Architecture](#3-the-mechanism-the-mlops-lifecycle-and-mlflow-architecture)
4. [Diagram: The Complete MLOps Production Lifecycle](#4-diagram-the-complete-mlops-production-lifecycle)
5. [Code Walkthrough: Production MLflow Tracking and Model Promotion in Python](#5-code-walkthrough-production-mlflow-tracking-and-model-promotion-in-python)
6. [Comparing Tracking Tools: MLflow vs Weights & Biases vs Neptune](#6-comparing-tracking-tools-mlflow-vs-weights--biases-vs-neptune)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Chaos of Unversioned Experiments

Software engineers would never accept deploying code by emailing unversioned `.zip` files containing `app_v2_final_FINAL.py`. Yet in data science and machine learning, this chaos occurs routinely:
- An engineer tests 25 hyperparameter variations in a Jupyter Notebook.
- They change the learning rate, add three features, modify the train/test split seed, and retrain.
- Three weeks later, a colleague asks: *"Which exact dataset, commit hash, and hyperparameters generated the model currently serving production traffic?"*
- Nobody knows. The notebook was overwritten, the training data shifted, and the exact model weights cannot be reproduced.

### What's Missing

Machine learning and LLM engineering require the exact same version control and deployment rigor as software engineering:
- **Reproducibility**: Every training run must log its exact Git commit hash, dataset version, hyperparameters, and environment dependencies.
- **Model Registry**: A centralized, immutable artifact repository tracking model versions, metadata, and lifecycle stages (`Staging`, `Production`, `Archived`).

---

## 2. The Database Migration and Package Registry Analogy

Consider how modern DevOps teams manage database schemas and third-party libraries.

### Chaotic Scripts vs Versioned Registries

```text
Ad-Hoc Model Training:
  Saving model files as: `model_best_2026_03_final.pkl` on a shared drive.
  - No record of which hyperparameters produced it.
  - If it crashes in production, there is no rollback target.

Package Registry (npm / Docker Hub / Model Registry):
  A central store with semantic versioning:
  pkg: models/fraud-detector:v2.4.1
  - Immutable binary artifact stored in S3/GCS.
  - Complete manifest: Git SHA `8a92f0c`, Dataset SHA `d91024`, Metrics: ROC-AUC 0.941.
  - Production deployments reference the exact tag: `Stage: Production`.
  - Instant one-click rollback to `v2.4.0` if anomalies occur.
```

---

## 3. The Mechanism: The MLOps Lifecycle and MLflow Architecture

Production model operations follow an end-to-end continuous feedback loop.

### 1. The MLOps Lifecycle

```text
Data Pipeline ──► Training ──► Experiment Tracking ──► Model Registry ──► Deployment ──► Monitoring ──► Retraining
```
- **Experiment Tracking**: Capturing runs, parameters, metrics, and output artifacts during exploratory development.
- **Model Registry**: A governed artifact warehouse managing promotion gates from `None` $\rightarrow$ `Staging` $\rightarrow$ `Production`.
- **Automated Deployment**: CI/CD pipelines pull the active `Production` model tag and deploy it to serving containers.

### 2. The Four Pillars of MLflow

**MLflow** is the open-source industry standard for model lifecycle management:
1. **MLflow Tracking**: An API and UI for logging parameters (`lr=0.001`), metrics (`test_loss=0.24`), and artifacts (`model.joblib`, confusion matrix PNGs).
2. **MLflow Models**: A standard packaging format defining dependencies (`conda.yaml`, `requirements.txt`) so models can be served uniformly via Docker, SageMaker, or Kubernetes.
3. **MLflow Model Registry**: A centralized collaborative hub for versioning, annotating, and managing model promotion stages.
4. **MLflow Recipes**: Predefined project templates for reproducible pipelines.

---

## 4. Diagram: The Complete MLOps Production Lifecycle

```text
Developer / CI Runner:
  [ Code Repo: Commit 8a92f ] + [ DVC Data: Hash 4f12 ]
                 │
                 ▼
      [ Execute Training Run ]
                 │
                 ▼
  [ MLflow Tracking Server (Postgres + S3) ]
    ├── Parameters:  lr=1e-3, batch=64, max_depth=6
    ├── Metrics:     val_loss=0.18, roc_auc=0.942
    └── Artifacts:   model.bin, schema.json
                 │
                 ▼
      [ MLflow Model Registry ]
        ├── v1 (Archived)
        ├── v2 (Production)  ◄── Pulled by FastAPI Serving Pods!
        └── v3 (Staging)     ◄── Undergoing automated canary evaluation
```

---

## 5. Code Walkthrough: Production MLflow Tracking and Model Promotion in Python

Here is an end-to-end Python script tracking a model training run, logging metrics and artifacts to MLflow, and programmatically promoting the candidate model to the Model Registry:

```python
import os
import tempfile
import numpy as np
import mlflow
import mlflow.sklearn
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score

# 1. Configure MLflow Tracking Server
# In production, point this to your remote tracking server: e.g. "http://mlflow.internal:5000"
mlflow.set_tracking_uri("sqlite:///mlflow.db")
mlflow.set_experiment("Production-Cancer-Classification")

# 2. Prepare Data
X, y = load_breast_cancer(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

# 3. Hyperparameter Configuration
params = {
    "n_estimators": 150,
    "max_depth": 6,
    "min_samples_split": 4,
    "random_state": 42
}

# 4. Execute Tracked Experiment Run
with mlflow.start_run(run_name="RandomForest-Baseline") as run:
    run_id = run.info.run_id
    print(f"Active MLflow Run ID: {run_id}")
    
    # Log Hyperparameters
    mlflow.log_params(params)
    
    # Train Model
    clf = RandomForestClassifier(**params)
    clf.fit(X_train, y_train)
    
    # Evaluate Metrics
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]
    
    acc = accuracy_score(y_test, y_pred)
    f1  = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    
    # Log Evaluation Metrics
    mlflow.log_metrics({
        "test_accuracy": acc,
        "test_f1": f1,
        "test_roc_auc": auc
    })
    
    print(f"Metrics: Accuracy={acc:.4f}, F1={f1:.4f}, ROC-AUC={auc:.4f}")
    
    # Log Model Artifact to Registry
    model_info = mlflow.sklearn.log_model(
        sk_model=clf,
        artifact_path="model",
        registered_model_name="CancerClassifierService"
    )
    print(f"Model logged and registered under URI: {model_info.model_uri}")

# 5. Model Registry Management & Staging Promotion
client = mlflow.tracking.MlflowClient()

# Fetch latest model version in the registry
model_name = "CancerClassifierService"
latest_versions = client.get_latest_versions(model_name)
latest_version = latest_versions[-1].version

print(f"\n--- Model Registry Management ---")
print(f"Model '{model_name}' has new version: v{latest_version}")

# Automated quality gate: Promote to 'Staging' only if ROC-AUC > 0.95
if auc >= 0.95:
    client.transition_model_version_stage(
        name=model_name,
        version=latest_version,
        stage="Staging",
        archive_existing_versions=False
    )
    print(f"Quality gate PASSED (AUC {auc:.4f} >= 0.95). Promoted v{latest_version} to STAGING.")
else:
    print(f"Quality gate FAILED (AUC {auc:.4f} < 0.95). Model remains in unapproved stage.")
```

---

## 6. Comparing Tracking Tools: MLflow vs Weights & Biases vs Neptune

### Tool Comparison Matrix

| Feature | MLflow | Weights & Biases (W&B) | Neptune.ai |
|---|---|---|---|
| **Hosting & Licensing** | **100% Open Source** (self-host on Postgres + S3) | Managed Cloud (Proprietary, paid tier) | Managed Cloud (Proprietary) |
| **Model Registry** | **Built-in native registry** with stage transitions | W&B Models / Artifacts | Neptune Model Registry |
| **Visual UI & Dashboards** | Functional, clean | **Best-in-class interactive visualizations** | Strong interactive UI |
| **Enterprise Privacy** | **Total data sovereignty** inside private VPC | Requires on-prem enterprise license | Cloud-hosted metadata |
| **Ecosystem Standard** | Universal enterprise open standard | Deep Learning & LLM research standard | Enterprise tabular & computer vision |

---

## 7. Common Mistakes

- **Logging huge datasets directly as MLflow artifacts.** Storing a 50GB CSV file directly into MLflow on every run fills S3 buckets and slows tracking servers to a crawl. Use **data versioning tools** (like DVC) and log the *hash pointer* in MLflow instead.
- **Relying on floating "latest" model tags in production.** Pulling `latest` directly into production containers means an accidental training run that registers a broken model will immediately be served to live customers. Always deploy specific immutable version numbers (e.g. `v4`) or explicitly promoted stages (`Production`).
- **Forgetting to record system environment dependencies.** If a model is trained on `scikit-learn==1.4.0` but the serving container runs `scikit-learn==1.1.0`, unpickling the model artifact will crash with deserialization errors. Always log `conda.yaml` or `requirements.txt`.
- **Not separating Experiment names by project.** Logging tabular fraud runs and computer vision segmentation runs to the default `Default` experiment turns the MLflow UI into an unusable jumble of mismatched metrics.

---

## 8. Hands-On Exercises

**Exercise 1:** Set up a local MLflow tracking server using SQLite and local artifact storage: run `mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlruns --port 5000` and inspect the UI in your browser.

**Exercise 2:** Implement hyperparameter logging: write a script that runs a grid search over 4 combinations of learning rates and estimators, logging each run to MLflow and plotting the hyperparameter comparison chart in the UI.

**Exercise 3:** Log an evaluation confusion matrix plot: generate a Matplotlib figure of a confusion matrix, save it to a temporary file, and log it using `mlflow.log_artifact("confusion_matrix.png")`.

**Exercise 4:** Write a production promotion script that checks if candidate version $V_{\text{new}}$ outperforms the current `Production` model on validation F1 score; if superior, demote the old version to `Archived` and promote $V_{\text{new}}$ to `Production`.

**Exercise 5:** Load and serve a registered model: write a lightweight script using `mlflow.pyfunc.load_model("models:/CancerClassifierService/Production")` and execute test predictions.

---

## 9. Interview Q&A

**Q: What is the purpose of an MLflow Model Registry, and how does it prevent deployment disasters?**
An MLflow Model Registry is a centralized, versioned, and audited catalog for managing model artifacts. It prevents deployment disasters by:
1. **Decoupling Training from Serving**: Training pipelines do not overwrite production files; they register candidate versions into a staging registry.
2. **Quality Gating & Governance**: New versions cannot be served until passing automated CI validation suites (schema checks, latency benchmarks, accuracy gates) and human approval reviews.
3. **Stage Transitions**: Manages formal lifecycle states (`Staging`, `Production`, `Archived`).
4. **Instant Rollback**: If a newly promoted `v4` model exhibits unexpected drift in production, serving systems can instantly roll back to `v3` in seconds by switching the alias pointer without rebuilding containers.

**Q: Why is tracking the Git commit hash and dataset hash mandatory for every experiment run?**
A machine learning model is an immutable artifact produced by the intersection of three components: **Code + Data + Hyperparameters**. If an engineer has the exact code and hyperparameters but the underlying database was updated with new rows, the training run cannot be reproduced. By logging the Git commit hash (code state), DVC/S3 dataset hash (data state), and exact random seeds, the team guarantees mathematical reproducibility and auditable compliance for regulated industries.

**Q: What is the difference between an Artifact Store and a Backend Store in MLflow?**
- **Backend Store**: A relational database (PostgreSQL, MySQL, SQLite) storing run metadata, experiment names, user IDs, timestamps, logged parameters (e.g. `max_depth=6`), and scalar metrics (e.g. `loss=0.12`).
- **Artifact Store**: A high-capacity object storage repository (AWS S3, Google Cloud Storage, Azure Blob, or shared NFS) storing heavy binary files, serialized model weights (`model.joblib`, `.bin`, `.safetensors`), charts, and environment files.

**Q: What is the MLflow `pyfunc` abstraction, and why is it valuable for production serving?**
`mlflow.pyfunc` (Python Function) is a generic unified model flavor. Regardless of whether the underlying model was trained using scikit-learn, PyTorch, XGBoost, TensorFlow, or custom Python code, MLflow wraps it in a standard interface exposing a uniform `.predict()` method accepting and returning pandas DataFrames or NumPy arrays. This allows serving infrastructure (FastAPI endpoints, Docker containers, batch Spark jobs) to deploy and execute arbitrary models using a single, uniform serving template without writing custom deserialization code for every library.

**Q: How do you handle model versioning when an application uses both an LLM prompt and a vector database embedding model?**
In LLM and RAG applications, the "model" is a compound AI system:
1. The **Prompt Template** is versioned in Git alongside application code.
2. The **Embedding Model** (e.g. `text-embedding-3-small`) is version-locked in the Model Registry. (Changing the embedding model requires re-embedding the entire vector database!).
3. The **Generator Model** (e.g. `gpt-4o-2024-08-06`) is pinned to a specific snapshot date, not an unversioned alias (`gpt-4o`), preventing silent vendor updates from breaking application behavior.
All three version identifiers are logged in the experiment tracking manifest.
