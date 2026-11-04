# -*- coding: utf-8 -*-
"""本地预览服务 + 后台管理接口：先起服务，确认监听成功后再打开浏览器。被 start.bat 调用。"""
import base64
import http.server
import json
import os
import shutil
import socket
import socketserver
import threading

PORT = 8787
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
TRASH = os.path.join('photos', '_回收站')          # 删除的作品先进这里，可找回


def open_browser():
    try:
        import webbrowser
        webbrowser.open('http://127.0.0.1:%d/' % PORT)
    except Exception as e:
        print('浏览器没自动打开（不影响服务）：', e)
        print('请手动访问  http://127.0.0.1:%d/  和  http://127.0.0.1:%d/admin.html' % (PORT, PORT))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True          # 旧服务残留时不至于绑定失败


def read_data():
    with open(os.path.join('data', 'photos.json'), encoding='utf-8') as f:
        return json.load(f)


def write_data(d):
    with open(os.path.join('data', 'photos.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join('data', 'photos.js'), 'w', encoding='utf-8') as f:
        f.write('/* 本文件由 build.py 自动生成，不要手改。 */\n')
        f.write('window.AY_PHOTOS = ')
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')


def api_sync():
    """增量同步：扫描 photos/ 下的新文件，只处理新增项（生成缩略图/大图），
    并清理已被移除文件的条目。相册结构变化（新增文件夹）也会一并收录。"""
    import build as B

    d = read_data()
    existing = {p['src'].replace('\\', '/'): p for p in d['photos']}
    hashes = {p.get('hash') for p in d['photos'] if p.get('hash')}

    disk = {}
    for dirpath, dirnames, filenames in os.walk('photos'):
        dirnames[:] = sorted(x for x in dirnames if not x.startswith('_'))
        if os.path.abspath(dirpath) == os.path.abspath('photos'):
            continue                       # photos/ 根目录的散图不收录（与 build.py 一致）
        for f in filenames:
            low = f.lower()
            if f in B.EXCLUDE_FILES or not (low.endswith(B.EXTS) or low.endswith(B.EXTS_V)):
                continue
            rel = os.path.relpath(os.path.join(dirpath, f), '.').replace('\\', '/')
            disk[rel] = (dirpath, f)

    # 磁盘上已不存在的条目 → 移除
    gone = [rel for rel in existing if rel not in disk]
    for rel in gone:
        p = existing.pop(rel)
        for k in ('t', 'l', 'v'):
            mf = p.get(k)
            if mf and os.path.isfile(os.path.join(ROOT, mf.replace('/', os.sep))):
                try:
                    os.remove(os.path.join(ROOT, mf.replace('/', os.sep)))
                except OSError:
                    pass
    if gone:
        d['photos'] = [p for p in d['photos'] if p['src'].replace('\\', '/') in disk]

    # 新文件 → 处理并追加
    feat_names = set(api_overrides().get('featured') or [])
    new = sorted(rel for rel in disk if rel not in existing)
    added, new_albums = 0, set()
    for idx, rel in enumerate(new):
        dp, f = disk[rel]
        sub = os.path.relpath(dp, 'photos').replace('\\', '/')
        label, date = B.album_meta_rel(sub)
        r = B.process((os.path.join(dp, f), sub, label, date, 900000 + idx))
        if 'error' in r:
            continue
        if r.get('hash') and r['hash'] in hashes:      # 内容重复：不留副本
            for k in ('t', 'l', 'v'):
                mf = r.get(k)
                if mf and os.path.isfile(os.path.join(ROOT, mf.replace('/', os.sep))):
                    os.remove(os.path.join(ROOT, mf.replace('/', os.sep)))
            continue
        r['featured'] = f in feat_names
        r['pinned'] = False
        d['photos'].append(r)
        hashes.add(r.get('hash'))
        added += 1
        new_albums.add(label)

    # 重算分组与统计
    albums = {}
    for p in d['photos']:
        key = p['album']
        if key not in albums:
            label, date = B.album_meta_rel(key)
            albums[key] = {'key': key, 'label': label, 'date': date, 'count': 0}
        albums[key]['count'] += 1
    d['albums'] = sorted(albums.values(), key=lambda a: a['key'])
    d['stats']['total'] = len(d['photos'])
    d['stats']['featured'] = sum(1 for p in d['photos'] if p['featured'])
    d['stats']['albums'] = len(d['albums'])
    write_data(d)

    return {'added': added, 'removed': len(gone), 'total': d['stats']['total'],
            'albums': len(d['albums']), 'newAlbums': sorted(new_albums)}


def api_save(body):
    """把后台编辑结果落盘到 data/overrides.json，并同步 photos.js 的精选标记。"""
    feat = body.get('featured') or []
    caps = body.get('captions') or {}
    payload = {'updated': __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M'),
               'featured': feat, 'captions': caps}
    os.makedirs('data', exist_ok=True)
    with open(os.path.join('data', 'overrides.json'), 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    # 同步作品数据的 featured 标记：这样直接双击 index.html（file://）也能看到一致的精选
    d = read_data()
    featset = set(feat)
    for p in d['photos']:
        p['featured'] = p['src'].replace('\\', '/').split('/')[-1] in featset
    d['stats']['featured'] = sum(1 for p in d['photos'] if p['featured'])
    write_data(d)
    return {'ok': True, 'featured': len(feat), 'captions': len(caps),
            'total': d['stats']['total']}


def api_overrides():
    p = os.path.join('data', 'overrides.json')
    if not os.path.isfile(p):
        return {'featured': [], 'captions': {}}
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def api_delete(paths):
    """把作品文件移入回收站，并同步移除其缩略图/大图/视频与数据条目。"""
    d = read_data()
    removed, errors = [], []
    drop = []
    for rel in paths:
        rel = (rel or '').replace('\\', '/')
        full = os.path.join(ROOT, rel.replace('/', os.sep))
        # 安全：只允许删除 photos/ 下的文件
        if not rel.startswith('photos/') or '..' in rel:
            errors.append('%s: 路径不合法' % rel)
            continue
        if not os.path.isfile(full):
            errors.append('%s: 文件不存在' % rel)
            continue
        entry = next((p for p in d['photos'] if p['src'].replace('\\', '/') == rel), None)
        # 1) 原图移入回收站（保留原相册层级，可找回）
        dst = os.path.join(TRASH, rel[len('photos/'):].replace('/', '_'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        try:
            shutil.move(full, dst)
        except Exception as e:
            errors.append('%s: %s' % (rel, e))
            continue
        # 2) 清理派生媒体
        if entry:
            for k in ('t', 'l', 'v'):
                mf = entry.get(k)
                if mf:
                    mf_full = os.path.join(ROOT, mf.replace('/', os.sep))
                    if os.path.isfile(mf_full):
                        try:
                            os.remove(mf_full)
                        except OSError:
                            pass
            drop.append(entry['id'])
            removed.append(rel)
        else:
            removed.append(rel)
    if drop:
        d['photos'] = [p for p in d['photos'] if p['id'] not in set(drop)]
        d['stats']['total'] = len(d['photos'])
        d['stats']['featured'] = sum(1 for p in d['photos'] if p['featured'])
        for a in d['albums']:
            a['count'] = sum(1 for p in d['photos'] if p['album'] == a['key'])
        write_data(d)
    return {'deleted': removed, 'errors': errors, 'total': d['stats']['total']}


class ApiHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        pass                                      # 静默访问日志，控制台只留关键信息

    def do_GET(self):
        if self.path.split('?')[0].rstrip('/') == '/api/overrides':
            try:
                data = api_overrides()
                body = json.dumps(data, ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        route = self.path.split('?')[0].rstrip('/')
        if route not in ('/api/delete', '/api/save', '/api/sync'):
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
            if route == '/api/delete':
                result = api_delete(body.get('paths') or [])
            elif route == '/api/sync':
                result = api_sync()
            else:
                result = api_save(body)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}, ensure_ascii=False).encode('utf-8'))


def main():
    try:
        httpd = Server(('127.0.0.1', PORT), ApiHandler)
    except OSError:
        print('端口 %d 已被占用 —— 很可能服务已经在运行了，直接打开浏览器即可：' % PORT)
        print('  网站首页   http://127.0.0.1:%d/' % PORT)
        print('  后台管理   http://127.0.0.1:%d/admin.html' % PORT)
        open_browser()
        return

    print('服务已启动：')
    print('  网站首页   http://127.0.0.1:%d/' % PORT)
    print('  后台管理   http://127.0.0.1:%d/admin.html' % PORT)
    print('关闭本窗口即停止服务。')
    threading.Timer(1.2, open_browser).start()
    httpd.serve_forever()


if __name__ == '__main__':
    main()

