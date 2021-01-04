#!/usr/bin/env python

import markdown
import frontmatter
import requests
import typer
import os

from pathlib import Path
from jinja2 import Template

app = typer.Typer()

TEMPLATE = Path("image_template.html")
CSS = Path("themes/ezhil/static/css/main.css")


def markdown_to_html(content):
    html = markdown.markdown(content.content)
    t = Template(TEMPLATE.read_text())
    if "bible_reference" in content:
        authors = content["bible_reference"]
    else:
        authors = ", ".join(content["authors"])
    return t.render(body=html, author=authors)


def html_to_image(html: str):

    USER_ID = os.environ["USER_ID"]
    API_KEY = os.environ["API_KEY"]
    HCTI_API_ENDPOINT = "https://hcti.io/v1/image"
    data = {
        "html": html,
        "selector": "blockquote",
        "ms_delay": 1000,
        "css": CSS.read_text(),
        "google_fonts": "Lora|Bitter",
        "device_scale": 1,
    }

    image = requests.post(url=HCTI_API_ENDPOINT, data=data, auth=(USER_ID, API_KEY))

    try:
        return image.json()["url"]
    except KeyError:
        raise RuntimeError(image.json())


@app.command()
def update_images(path: Path, glob="*", force: bool=False):
    for post in path.glob(glob):
        if post.name in ["_index.md"]:
            continue
        content = frontmatter.loads(post.read_text())
        if force is True or (
            "images" not in content and content.get("draft") is not True
        ):
            content["images"] = [html_to_image(markdown_to_html(content))]
            post.write_text(frontmatter.dumps(content))
            print(f"Updated {post}")


@app.command()
def html(path: Path):
    print(markdown_to_html(frontmatter.loads(path.read_text())))


if __name__ == "__main__":
    app()
