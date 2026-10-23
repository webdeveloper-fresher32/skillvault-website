# LangChain Quick Reference & Syntax Cheatsheet

A concise, high-density reference guide for modern LangChain (v0.2+ / v0.3+) development: package imports, LCEL primitives, prompt templates, tool definitions, retrieval strategies, memory management, streaming, and deployment.

---

## 1. Package Ecosystem & Essential Imports

| Package | Purpose | Common Import Pattern |
|---|---|---|
| `langchain-core` | Core interfaces, Runnables, Prompts, Messages, Base Tools | `from langchain_core.prompts import ChatPromptTemplate` |
| `langchain` | Chains, Agents, Executors, High-level orchestrators | `from langchain.agents import create_tool_calling_agent` |
| `langchain-community` | Third-party integrations (Vector DBs, Loaders, Parsers) | `from langchain_community.vectorstores import FAISS` |
| `langchain-openai` | Dedicated OpenAI chat & embedding models | `from langchain_openai import ChatOpenAI, OpenAIEmbeddings` |
| `langchain-anthropic`| Dedicated Anthropic Claude chat models | `from langchain_anthropic import ChatAnthropic` |

```python
# Standard Modern Imports
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel, RunnableLambda
from langchain_core.tools import tool, BaseTool
```

---

## 2. Core LCEL Pipe Syntax & Composition

```python
# Basic Sequential Pipe: Input Dict -> Prompt -> Model -> String Output
chain = prompt | model | StrOutputParser()

# Branching & Parallel Execution
chain = RunnableParallel(
    context=retriever,
    question=RunnablePassthrough()
) | prompt | model | StrOutputParser()

# Dynamic Dictionary Assignment
chain = RunnablePassthrough.assign(
    context=lambda x: retriever.invoke(x["question"])
) | prompt | model

# Model Fallback Configuration
resilient_model = primary_model.with_fallbacks([fallback_model])
```

---

## 3. Prompts & Messages

```python
# System, Human, and Message History Templates
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert AI software architect."),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{user_input}")
])

# Formatting Prompts Directly
formatted_messages = prompt.invoke({
    "chat_history": [HumanMessage("Hello"), AIMessage("Hi there!")],
    "user_input": "How do I use Redis with LangChain?"
})
```

---

## 4. Custom Tools & Structured Outputs

```python
from pydantic import BaseModel, Field
from langchain_core.tools import tool

# 1. Pydantic Parameter Schema
class UserLookupSchema(BaseModel):
    user_id: str = Field(description="Unique UUID of user")
    include_billing: bool = Field(default=False, description="Whether to include billing info")

# 2. Tool Definition
@tool(args_schema=UserLookupSchema)
def lookup_user(user_id: str, include_billing: bool = False) -> str:
    """Fetch customer profile from database."""
    return f"Profile data for {user_id}"

# 3. Model Tool Binding
model_with_tools = model.bind_tools([lookup_user])

# 4. Guaranteed Structured Output
class TicketResolution(BaseModel):
    category: str = Field(description="Issue category")
    resolved: bool = Field(description="Whether issue is solved")

structured_llm = model.with_structured_output(TicketResolution)
```

---

## 5. RAG Pipelines & Retrievers

```python
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.retrievers import EnsembleRetriever

# Hybrid Search: Dense Vector + Sparse BM25
hybrid_retriever = EnsembleRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    weights=[0.6, 0.4]
)

# History-Aware Rewriter
history_retriever = create_history_aware_retriever(llm, hybrid_retriever, rephrase_prompt)

# Document QA Chain
qa_chain = create_stuff_documents_chain(llm, qa_prompt)

# Master Conversational Retrieval Chain
rag_chain = create_retrieval_chain(history_retriever, qa_chain)
```

---

## 6. Agents & AgentExecutor

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor

agent_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a research agent with tools."),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad")
])

agent = create_tool_calling_agent(llm, tools, agent_prompt)

executor = AgentExecutor(
    agent=agent,
    tools=tools,
    max_iterations=5,
    max_execution_time=20.0,
    early_stopping_method="generate",
    handle_parsing_errors=True,
    return_intermediate_steps=True
)
```

---

## 7. Memory & Session Management

```python
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

def get_redis_history(session_id: str):
    return RedisChatMessageHistory(
        session_id=session_id,
        url="redis://localhost:6379/0",
        ttl=86400,
        key_prefix="chat:"
    )

session_chain = RunnableWithMessageHistory(
    chain,
    get_redis_history,
    input_messages_key="input",
    history_messages_key="chat_history"
)

# Invocation with session config
response = session_chain.invoke(
    {"input": "What is my account balance?"},
    config={"configurable": {"session_id": "user_101"}}
)
```

---

## 8. Streaming & Event Lifecycle

```python
# Direct Token Streaming
async for chunk in chain.astream({"input": "Hello"}):
    print(chunk, end="", flush=True)

# Granular Lifecycle Event Streaming
async for event in executor.astream_events({"input": "Search data"}, version="v2"):
    kind = event["event"]
    if kind == "on_chat_model_stream":
        print(event["data"]["chunk"].content, end="")
    elif kind == "on_tool_start":
        print(f"[Starting Tool: {event['name']}]")
```

---

## 9. Observability & LangSmith Setup

```bash
# Environment Configuration
export LANGCHAIN_TRACING_V2="true"
export LANGCHAIN_API_KEY="lsv2_pt_..."
export LANGCHAIN_PROJECT="production-app"
```

```python
# Enriched Run Tags & Metadata
result = chain.invoke(
    {"input": "query"},
    config={
        "tags": ["prod", "customer-support"],
        "metadata": {"user_id": "usr_123", "region": "us-east-1"}
    }
)
```
