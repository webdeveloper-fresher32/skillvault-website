# Project 01 — Classical ML Prediction API with FastAPI and Docker

## Goal

Build, serialize, containerize, and serve a supervised machine learning prediction microservice using scikit-learn, FastAPI, and Docker, bridging classical ML modeling with production backend engineering.

## What You'll Build

A containerized REST microservice that loads an offline-trained Gradient Boosting model (or Random Forest) for real estate price estimation or loan default risk prediction. The API exposes endpoints for single and batch predictions, input validation via Pydantic schemas, automated metric logging, and health checks.

## Phases Required

- Phase 01 — Math Foundations (Linear Algebra, Vectors, Matrix Multiplication)
- Phase 02 — Classical Machine Learning (Supervised Learning, Feature Engineering, Train/Test Splits, Metrics)
- Phase 09 — MLOps & LLMOps (Containerization & Production Deployment)

## Requirements

- **Model Training Pipeline**: A standalone Python script `train.py` that loads a tabular dataset (e.g. California Housing or Kaggle Credit Risk), performs train/test splits, handles feature scaling and imputation via a scikit-learn `Pipeline`, evaluates test metrics (RMSE, MAE, R² or Precision, Recall, ROC-AUC), and serializes the trained pipeline with `joblib`.
- **FastAPI Microservice**: An `app.py` service that:
  - Loads the serialized pipeline artifact on application startup using FastAPI lifespan events.
  - Exposes `GET /health` returning server status, model version, and uptime.
  - Exposes `POST /predict` accepting a validated Pydantic input payload, returning predicted values and confidence intervals.
  - Exposes `POST /predict/batch` accepting a list of records for vectorized prediction.
- **Input Validation & Guardrails**: Pydantic models enforcing type safety, value ranges (e.g. `age > 18`, `income >= 0`), and rejecting malformed inputs with 422 HTTP responses.
- **Docker Containerization**: A production-grade `Dockerfile` using multi-stage builds, non-root user execution, dependency caching, and environment variable configuration.
- **Automated Tests**: Unit tests with `pytest` and `httpx.AsyncClient` verifying endpoints, valid predictions, and edge-case invalid inputs.

## Suggested Approach

1. Start by writing `train.py`. Train an `HistGradientBoostingRegressor` or `RandomForestClassifier` using `sklearn.pipeline.Pipeline` with `StandardScaler` and `SimpleImputer` so all preprocessing is baked directly into the saved model artifact.
2. Verify test set performance and serialize the artifact to `models/model_v1.joblib` alongside a `metadata.json` recording training date, hyperparameter settings, and test metrics.
3. Build the FastAPI service in `app/main.py`. Define request and response schemas using `pydantic.BaseModel` with field constraints.
4. Add startup loading in a `@asynccontextmanager` lifespan handler to ensure the model loads once into memory, not per request.
5. Create a `Dockerfile` with a slim Python base image, copy requirements, install dependencies, copy application code, and run `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
6. Write integration tests in `tests/test_api.py` testing the running container with `curl` or `pytest`.

## Stretch Goals

- Add Prometheus metrics tracking request count, inference latency histogram, and prediction value distributions.
- Implement a `/feedback` endpoint where ground-truth labels can be posted later to calculate live production drift.
- Set up a GitHub Actions workflow that builds the Docker image and runs unit tests on push.

## Evaluation Checklist

- [ ] Model training script executes end-to-end, evaluates metrics on a held-out test split, and saves a pipeline artifact.
- [ ] Model artifact includes all preprocessing transformations (no manual external feature scaling required).
- [ ] `POST /predict` returns a valid prediction for valid inputs within < 20ms.
- [ ] Pydantic rejects out-of-bounds or missing fields with informative 422 errors.
- [ ] Docker image builds cleanly, runs without root privileges, and passes container health checks.
- [ ] Automated tests verify single prediction, batch prediction, and schema validation failure cases.
