# Local preview workflow

When debugging or changing this project, start a local HTTP server from the repository root before presenting the result to the user:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open the Gaia page at:

```text
http://127.0.0.1:4173/gaia.html
```

Keep the server running while the user previews the page. Do not use a `file://` URL for testing: browser canvas security rules taint canvases containing local images, causing the “生成分享图片” export to fail at `canvas.toDataURL()`.

Before handing off UI changes, verify the relevant behavior through the HTTP preview, including “生成分享图片” when the change could affect page rendering or image capture.
