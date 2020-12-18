import markdown
import frontmatter
import requests

from pathlib import Path
from jinja2 import Template

TEMPLATE = Path("image_template.html")
USER_ID = "870c2f3d-8848-4cd7-a2e2-86aab11f2169"
API_KEY = "d1f9d321-124f-4c21-86a3-1d933a87789f"

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



posts = Path('content/q/')

for post in posts.glob("*john-newton*"):
    content = frontmatter.loads(post.read_text())
    if 'image' not in content:
        content['image'] = html_to_image(markdown_to_html(content))
        post.write_text(frontmatter.dumps(content))