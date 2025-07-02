@echo off
setlocal enabledelayedexpansion

:: 创建必要的目录
mkdir vs\editor
mkdir vs\basic-languages\python
mkdir vs\basic-languages\html
mkdir vs\basic-languages\javascript
mkdir vs\language\html
mkdir vs\base\browser\ui\codicons\codicon
mkdir webfonts
mkdir css

:: 下载基础资源
curl -o tailwindcss.js https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4
curl -o css\all.min.css https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css
curl -o webfonts\fa-solid-900.woff2 https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2
curl -o webfonts\fa-solid-900.ttf https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.ttf
curl -o react.development.js https://unpkg.com/react@18.3.1/umd/react.development.js
curl -o react-dom.development.js https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js
curl -o babel.min.js https://unpkg.com/@babel/standalone@7.27.0/babel.min.js
curl -o vconsole.min.js https://cdn.jsdelivr.net/npm/vconsole@3.15.1/dist/vconsole.min.js

:: 下载 Monaco Editor 相关文件
curl -o vs\language\html\htmlWorker.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/language/html/htmlWorker.js
curl -o vs\loader.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js
curl -o vs\editor\editor.main.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/editor/editor.main.js
curl -o vs\editor\editor.main.css https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/editor/editor.main.css
curl -o vs\editor\editor.main.nls.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/editor/editor.main.nls.js
curl -o vs\basic-languages\python\python.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/basic-languages/python/python.js
curl -o vs\basic-languages\html\html.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/basic-languages/html/html.js
curl -o vs\language\html\htmlMode.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/language/html/htmlMode.js
curl -o vs\basic-languages\javascript\javascript.js https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/basic-languages/javascript/javascript.js
curl -o vs\base\browser\ui\codicons\codicon\codicon.ttf https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/base/browser/ui/codicons/codicon/codicon.ttf

echo 所有文件下载完成！
pause