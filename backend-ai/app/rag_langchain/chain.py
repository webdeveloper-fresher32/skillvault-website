from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable
from app.core.llm import get_chat_model

DEFAULT_SYSTEM_PROMPT = (
    "You are SkillVault AI, an expert software engineering mentor.\n"
    "Answer the user's question accurately and concisely, strictly based on the provided documentation excerpts.\n"
    "Rules:\n"
    "1. Ground every claim in the documentation.\n"
    "2. When stating facts or explaining mechanisms, reference the relevant citation like [1], [2].\n"
    "3. Provide clean code examples when relevant.\n"
    "4. If the documentation does not contain enough info to answer, state that clearly."
)


def create_rag_chain(
    chat_model = None,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    temperature: float = 0.2
) -> Runnable:
    """
    Construct production LangChain Expression Language (LCEL) Chain:
    ChatPromptTemplate | BaseChatModel | StrOutputParser
    """
    if chat_model is None:
        chat_model = get_chat_model(temperature=temperature)

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "<context>\n{context}\n</context>\n\nQuestion: {question}")
    ])

    return prompt | chat_model | StrOutputParser()
