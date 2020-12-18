import markdown
import frontmatter
import requests
import typer
import os

from pathlib import Path
from jinja2 import Template

app = typer.Typer()

TEMPLATE = Path("image_template.html")
USER_ID = os.environ.get('USER_ID')
API_KEY = os.environ.get('API_KEY')

def markdown_to_html(content):
    html = markdown.markdown(content.content)
    t = Template(TEMPLATE.read_text())
    return t.render(body=html, author=", ".join(content['authors']))

def html_to_image(html: str):

    HCTI_API_ENDPOINT = "https://hcti.io/v1/image"
    data = { 'html': html, 'selector': 'blockquote', 'ms_delay': 500 }

    image = requests.post(url = HCTI_API_ENDPOINT, data = data, auth=(USER_ID, API_KEY))

    try:
        return image.json()['url']
    except KeyError:
        raise RuntimeError(image.json())

def add_image(path: Path, image_url: str):
    content = frontmatter.loads(path.read_text())
    content['image'] = image_url



@app.command()
def update_images(path: Path, glob="*"):
    for post in posts.glob(glob):
        content = frontmatter.loads(post.read_text())
        if 'image' not in content:
            content['image'] = html_to_image(markdown_to_html(content))
            post.write_text(frontmatter.dumps(content))

@app.command()
def html(path: Path):
    print(markdown_to_html(frontmatter.loads(path.read_text())))

if __name__ == "__main__":
    app()