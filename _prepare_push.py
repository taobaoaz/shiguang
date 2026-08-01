import json, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

files_to_push = []
skip = {'package-lock.json', 'tsconfig.tsbuildinfo', 'final.png', 'final-react.png', 'public/icon.ico', 'public/shiguang.ico'}
skip_dirs = {'.git', 'node_modules', 'dist', 'setup', 'dist-electron', '.npm-cache', 'release'}

for root, dirs, filenames in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for fn in sorted(filenames):
        rel = os.path.relpath(os.path.join(root, fn), '.').replace(os.sep, '/')
        if rel in skip:
            continue
        try:
            with open(rel, 'r', encoding='utf-8') as f:
                content = f.read()
            files_to_push.append({'path': rel, 'content': content})
        except:
            pass

print(f'Total files: {len(files_to_push)}')
total_size = sum(len(f['content']) for f in files_to_push)
print(f'Total size: {total_size} bytes')

for f in files_to_push:
    print(f"  {f['path']} ({len(f['content'])} bytes)")

with open('_files_to_push.json', 'w', encoding='utf-8') as out:
    json.dump(files_to_push, out, ensure_ascii=False)
print('Saved to _files_to_push.json')
