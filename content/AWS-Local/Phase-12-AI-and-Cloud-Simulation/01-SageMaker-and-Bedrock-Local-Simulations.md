# SageMaker and Bedrock Local Simulations — Complete Guide

> "A theater director practices scenes with actors on a rehearsal stage using simple wooden chairs as props, before moving the production to the main theater stage with expensive sets and lights."

---

## Table of Contents

1. [The Problem: High Billing Risks of Cloud AI and Machine Learning](#1-the-problem-high-billing-risks-of-cloud-ai-and-machine-learning)
2. [The Rehearsal Stage Analogy](#2-the-rehearsal-stage-analogy)
3. [The Mechanism: Local LLM Hosting and FastAPI Model Endpoints](#3-the-mechanism-local-llm-hosting-and-fastapi-model-endpoints)
4. [Diagram: Swapping Local Ollama for Amazon Bedrock in Code](#4-diagram-swapping-local-ollama-for-amazon-bedrock-in-code)
5. [Code Walkthrough: LangChain Ollama Runner and SageMaker Mock API](#5-code-walkthrough-langchain-ollama-runner-and-sagemaker-mock-api)
6. [Comparing AWS AI Services to Local Open-Source Alternatives](#6-comparing-aws-ai-services-to-local-open-source-alternatives)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: High Billing Risks of Cloud AI and Machine Learning

Running AI and machine learning models on AWS involves massive computing costs. AWS SageMaker and Amazon Bedrock are designed to handle enterprise-level training and foundation model inference.

### SageMaker Compute and Idle Fees

AWS SageMaker charges for notebook instances, training clusters, and hosted model endpoints. Leaving a SageMaker notebook instance running or keeping a GPU-backed inference endpoint active in your account will trigger hundreds of dollars in charges, even if the model sits completely idle.

### Bedrock Token Usage Costs

Amazon Bedrock charges per token (input and output) processed by foundation models like Claude or Llama. During development, running automated loop scripts, testing chains, or executing prompts in a CI/CD pipeline can consume massive token volumes, running up a substantial bill.

---

## 2. The Rehearsal Stage Analogy

A theater company does not rent out a multi-million dollar opera house with high stage-hand union fees just for initial actor rehearsals.

### Low-Cost Props

Instead, they practice in a small warehouse room. They mark floor dimensions with tape and use cheap folding chairs to simulate tables, stairs, and doors. The actors memorize their lines and blocking rules in this low-cost environment.

### Swapping the Sets

By the time the actors move to the real opera house, the script, blocking, and timing are locked. The transition is seamless because the physical stage dimensions are identical. Similarly, using Ollama and local model APIs allows you to build prompt flows offline, ready to be swapped for Bedrock in production.

---

## 3. The Mechanism: Local LLM Hosting and FastAPI Model Endpoints

You cannot easily run SageMaker APIs or Bedrock models directly inside Floci. Instead, you simulate their operations using open-source, offline-first tools.

### Ollama LLM Inference

To simulate Bedrock, you install Ollama on your host machine. Ollama runs Large Language Models (like Llama 3 or Mistral) locally, exposing a REST API on port `11434`. By configuring SDK frameworks like LangChain, you can run prompts offline. Swapping to Bedrock involves changing the model class configuration.

### SageMaker Mocking via FastAPI

SageMaker inference expects a model server that accepts HTTP POST requests on `/invocations` and returns predictions. You simulate this locally by building a lightweight Python FastAPI server, packaging it inside a Docker container, and running prediction queries on localhost.

---

## 4. Diagram: Swapping Local Ollama for Amazon Bedrock in Code

### The Configuration Interface

```text
Local Development Code (LangChain / SDK):
  [Prompt Logic] ──► [ChatOllama Client] ──► Local HTTP (Port 11434) ──► Local LLM (Llama 3)
  (100% Offline, no api key required, zero usage charges)

Production Deployment Code (LangChain / SDK):
  [Prompt Logic] ──► [ChatBedrock Client] ──► AWS IAM Auth ──► Amazon Bedrock (Llama 3)
  (Same prompt inputs, identical response data structure. Scalable in the cloud.)
```

### Strategic Advantage

The application logic (prompt construction, message history, parser structures) remains identical. Only the client wrapper class is swapped.

---

## 5. Code Walkthrough: LangChain Ollama Runner and SageMaker Mock API

The following Node.js script uses LangChain to connect to a local Ollama model. The Python code defines a simulated SageMaker endpoint using FastAPI.

### Node.js LangChain Ollama Client

```js
// ollama-client.js
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { HumanMessage } from "@langchain/core/messages";

// Initialize local LLM client targeting local port 11434
const model = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "llama3",
  temperature: 0.7
});

async function runPrompt() {
  try {
    const response = await model.invoke([
      new HumanMessage("Explain AWS Lambda in one sentence.")
    ]);
    console.log("LLM Response:\n", response.content);
  } catch (error) {
    console.error("Local LLM invocation failed:", error.message);
    console.log("Make sure Ollama is running ('ollama run llama3').");
  }
}

runPrompt();
```

### Python FastAPI SageMaker Inference Mock

Save this configuration as `sagemaker_mock.py` to simulate a SageMaker model container:

```python
# sagemaker_mock.py
from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()

@app.get("/ping")
def ping():
    # SageMaker ping endpoint for health checks
    return {"status": "healthy"}

@app.post("/invocations")
async def invocations(request: Request):
    # SageMaker prediction endpoint
    data = await request.json()
    features = data.get("instances", [])
    
    # Mock model prediction: multiply input values by 2
    predictions = [x * 2 for x in features]
    
    return {"predictions": predictions}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

---

## 6. Comparing AWS AI Services to Local Open-Source Alternatives

### AI Framework Parity

| AWS Feature | Local Replacement | Port/Tool | Parity level |
|---|---|---|---|
| Bedrock API | Ollama REST API | Port 11434 | High (via LangChain wraps) |
| SageMaker Notebook | VS Code + Jupyter Extension | Local Host | High (identical UI) |
| SageMaker Training | Python Script execution | Local GPU/CPU | Medium (slower hardware) |
| SageMaker Inference | FastAPI + Docker | Port 8080 | High (API schema matches) |
| Bedrock Claude 3 | Local Llama 3 / Mistral | Ollama | Medium (Llama 3 is capable) |
| SageMaker Registry | MLflow Model Registry | Local Host | High (open-source standard) |

---

## 7. Common Mistakes

- **Leaving Ollama running in the background.** Local LLM inference utilizes massive CPU and RAM resources. Keep the service closed when not executing code to preserve host memory.
- **Forgetting the endpoint routes in Python container mocks.** SageMaker expects endpoints specifically at `/ping` and `/invocations`. Custom routing definitions (e.g. `/predict`) will fail container checks.
- **Assuming prompt performance matches exactly.** A prompt optimized for Claude 3 on Bedrock may perform differently or hallucinate when executed against a smaller Llama 3 model locally.

---

## 8. Hands-On Exercises

**Exercise 1:** Download and install Ollama on your host machine, and run a local model: `ollama run llama3`.

**Exercise 2:** Create the Node.js project from Section 5, install `@langchain/community`, and execute `ollama-client.js`.

**Exercise 3:** Write the Python FastAPI script from Section 5, run it on port 8080, and verify health checks using `curl http://localhost:8080/ping`.

**Exercise 4:** Test the simulated SageMaker endpoint by sending a POST prediction request: `curl -d '{"instances": [1, 2, 3]}' http://localhost:8080/invocations`.

**Exercise 5:** Modify the LangChain script to use the `ChatBedrock` client class, preparing the file structure for a live cloud deploy.

---

## 9. Interview Q&A

**Q: How do you mock Amazon Bedrock API calls locally during the development phase?**
You install Ollama to host models locally on port 11434. In your code, you use abstraction frameworks like LangChain, initializing a `ChatOllama` client during development. When deploying to production, you swap this for `ChatBedrock`, keeping prompt templates identical.

**Q: What HTTP endpoints does a custom Docker container need to expose to be compatible with AWS SageMaker Inference?**
It must expose two endpoints on port 8080: GET `/ping` (used by SageMaker for container health checks and model loading status) and POST `/invocations` (which receives input payload data and returns predictions).

**Q: Why is MLflow considered a local replacement for the AWS SageMaker Model Registry?**
MLflow is an open-source platform that enables versioning, packaging, and cataloging machine learning models locally. It provides UI dashboards and APIs to register models, matching SageMaker Model Registry features without cloud deployment costs.

**Q: What is a cold start in the context of SageMaker Serverless Inference?**
A cold start is the latency delay that occurs when a serverless endpoint receives a request after being idle. SageMaker must locate the container image, download it, spin it up, and load the model parameters before responding, taking up to a minute.

**Q: How do parameters like Temperature affect LLM response generation?**
Temperature controls the randomness of responses. A value close to 0 makes responses deterministic and focused (useful for coding or factual Q&A). A value closer to 1 increases creativity and diversity, at the cost of higher hallucination risk.
