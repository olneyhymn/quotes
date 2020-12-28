#!/bin/bash
FILE=$(shuf -n1 -e content/q/*.md)
python quote_to_image.py html "$FILE" > index.html