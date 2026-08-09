from pypdf import PdfReader
import pytesseract
from PIL import Image
from docx import Document
from email import message_from_bytes
from email.policy import default
from pathlib import Path


def extract_pdf(file: str) -> str:
    reader = PdfReader(file)
    pages = reader.pages
    texts = "\n".join(page.extract_text() for page in pages) 

    return texts

def extract_img(file: str) -> str:
    image = Image.open(file)
    text = pytesseract.image_to_string(image)

    return text


def extract_docx(file: str) -> str:
    docs = Document(file)
    text = "\n".join(doc.text for doc in docs.paragraphs)
    table = ""
    for tables in docs.tables:
        for row in tables.rows:
            table += f"{[cell.text for cell in row.cells]}\n"

    return text + f"\n{table}"


def extract_email(file: str) -> str:
    with open(file, "rb") as f:
        message = message_from_bytes(f.read(), policy=default)

    body = message.get_body(preferencelist=("plain"))
    text = body.get_content() if body else ""

    return text

def extract_text(file: str) -> str:
    



