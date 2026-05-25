import litellm
from pydantic import BaseModel

_MODEL = "openrouter/google/gemini-2.5-flash-lite"


class _ChatAnswer(BaseModel):
    answer: str


def answer(document_text: str, question: str) -> str:
    system_prompt = (
        "You are a helpful assistant that answers questions about a specific document.\n"
        "You must answer using only information found in the document provided below.\n"
        "If the answer is not in the document, say: "
        "\"I couldn't find that information in this document.\"\n"
        "Do not speculate or add information from outside the document.\n\n"
        "--- DOCUMENT START ---\n"
        f"{document_text}\n"
        "--- DOCUMENT END ---"
    )

    response = litellm.completion(
        model=_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        response_format=_ChatAnswer,
        max_tokens=1024,
    )

    parsed = getattr(response.choices[0].message, "parsed", None)
    if parsed is not None:
        return parsed.answer

    return _ChatAnswer.model_validate_json(response.choices[0].message.content).answer
