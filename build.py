# -*- coding: utf-8 -*-
"""
阿缘摄影 · 作品集构建脚本
=========================
作用：扫描 photos/ 里的照片，自动生成缩略图、大图与 data/photos.json。

日常用法（加照片三步）：
  1. 把照片放进 photos/ 下的某个文件夹（文件夹名建议用  2026-10-15_活动名称  的格式）
  2. 双击  build.bat
  3. 浏览器刷新 index.html  —— 完成

不需要改任何代码。文件夹名里的日期会自动成为作品日期，
横构图/竖构图会自动判断，拍摄设备会自动从照片里读出来。
"""
import base64
import hashlib
import io
import json
import os
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(ROOT, 'photos')
MEDIA_T = os.path.join(ROOT, 'assets', 'media', 't')
MEDIA_L = os.path.join(ROOT, 'assets', 'media', 'l')
DATA_DIR = os.path.join(ROOT, 'data')

EXTS = ('.jpg', '.jpeg', '.png', '.webp')
EXTS_V = ('.mp4', '.mov', '.m4v', '.webm', '.m4p')
THUMB_MAX = 900          # 网格用图最长边
LARGE_MAX = 2000         # 灯箱大图最长边
Q_THUMB = 74
Q_LARGE = 82
LQIP_W = 24              # 模糊占位图宽度
MEDIA_V = os.path.join(ROOT, 'assets', 'media', 'v')

# 每个作品集分组最多收录多少张（0 = 不限）。单组照片太多会淹掉其他组。
MAX_PER_ALBUM = 0

# 不上网的文件（按文件名匹配）：超过平台 2GiB 上传上限的大体积 MV 在此排除
# （2026-10-18 视频已全部二次压缩，总量 0.62GB，无需再排除）
EXCLUDE_FILES = set()


def album_meta(name):
    """从文件夹名解析出 显示名 与 日期。例：2026-07-12_儿童公园 -> (儿童公园, 2026-07-12)"""
    date = ''
    label = name
    if len(name) >= 10 and name[4] == '-' and name[7] == '-':
        date = name[:10]
        label = name[11:].lstrip('_ ') or name
    return label, date


def read_exif(im):
    """取拍摄时间与机身型号"""
    taken, cam = '', ''
    try:
        ex = im.getexif()
        cam = (ex.get(272) or '').strip()
        # 优先 DateTimeOriginal(36867)，退到 DateTime(306)
        dto = ex.get_ifd(0x8769).get(36867) or ex.get(36867) or ex.get(306) or ''
        if dto:
            try:
                taken = datetime.strptime(dto.strip(), '%Y:%m:%d %H:%M:%S').strftime('%Y-%m-%d %H:%M')
            except ValueError:
                taken = ''
    except Exception:
        pass
    return taken, cam


def make_id(album_key, seq):
    return '%s-%03d' % (hashlib.md5(album_key.encode('utf-8')).hexdigest()[:5], seq)


def process(job):
    """单个文件的处理：读原图 -> 写缩略图/大图/占位图 -> 返回元数据"""
    src, album_key, album_label, album_date, seq = job
    pid = make_id(album_key, seq)
    ext = os.path.splitext(src)[1].lower()
    if ext in EXTS_V:
        return process_video(src, album_key, album_label, album_date, seq, pid)
    return process_photo(src, album_key, album_label, album_date, seq, pid)


def process_video(src, album_key, album_label, album_date, seq, pid):
    """视频：抽一帧做封面 + 读时长 + 原样拷贝进上线目录。点击才加载，平时零流量。"""
    import cv2
    ext = os.path.splitext(src)[1].lower()
    try:
        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            return {'error': '%s: 无法读取视频' % os.path.basename(src)}
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        dur = round(frames / fps) if (fps and frames) else 0
        # 取 1/4 处的帧当封面：第一帧经常是黑场
        if dur:
            cap.set(cv2.CAP_PROP_POS_MSEC, min(dur * 1000 * 0.25, 60000))
        ok, frame = cap.read()
        if not ok:                                   # 尝试第一帧兜底
            cap.set(cv2.CAP_PROP_POS_MSEC, 0)
            ok, frame = cap.read()
        cap.release()
        if not ok:
            return {'error': '%s: 无法抽取封面帧' % os.path.basename(src)}

        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        im = Image.fromarray(frame)
        w, h = im.size

        # 封面（兼缩略图）与模糊占位图
        th = im.copy(); th.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
        th.save(os.path.join(MEDIA_T, pid + '.webp'), 'WEBP', quality=Q_THUMB, method=5)
        lq = im.copy(); lq.thumbnail((LQIP_W, LQIP_W), Image.LANCZOS)
        buf = io.BytesIO(); lq.save(buf, 'WEBP', quality=40)
        lqip = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')

        # 视频本体原样拷贝（用户已压缩过，不再转码）；m4p 统一改 .mp4 以拿对 MIME
        vext = '.mp4' if ext in ('.m4p',) else ext
        shutil.copyfile(src, os.path.join(MEDIA_V, pid + vext))

        ratio = w / h if h else 1
        orient = 'l' if ratio > 1.12 else ('p' if ratio < 0.89 else 's')
        return {
            'id': pid, 'album': album_key, 'albumLabel': album_label,
            'date': album_date, 'taken': '', 'w': w, 'h': h, 'o': orient,
            'cam': '', 'kind': 'video', 'dur': dur,
            't': 'assets/media/t/%s.webp' % pid,
            'v': 'assets/media/v/%s%s' % (pid, vext),
            'lqip': lqip,
            'src': os.path.relpath(src, ROOT).replace('\\', '/'),
            'featured': False, 'pinned': False, 'caption': '',
        }
    except Exception as e:
        return {'error': '%s: %s' % (os.path.basename(src), e)}


def process_photo(src, album_key, album_label, album_date, seq, pid):
    try:
        im = Image.open(src)
        im = ImageOps.exif_transpose(im)          # 按 EXIF 方向摆正
        taken, cam = read_exif(im)
        im = im.convert('RGB')
        w, h = im.size

        # 大图
        big = im.copy()
        big.thumbnail((LARGE_MAX, LARGE_MAX), Image.LANCZOS)
        big.save(os.path.join(MEDIA_L, pid + '.webp'), 'WEBP', quality=Q_LARGE, method=5)

        # 缩略图
        th = im.copy()
        th.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
        th.save(os.path.join(MEDIA_T, pid + '.webp'), 'WEBP', quality=Q_THUMB, method=5)

        # 模糊占位图（先出模糊感，再换成清晰图）
        lq = im.copy()
        lq.thumbnail((LQIP_W, LQIP_W), Image.LANCZOS)
        buf = io.BytesIO()
        lq.save(buf, 'WEBP', quality=40)
        lqip = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')

        ratio = w / h if h else 1
        orient = 'l' if ratio > 1.12 else ('p' if ratio < 0.89 else 's')
        return {
            'id': pid,
            'album': album_key,
            'albumLabel': album_label,
            'date': album_date,
            'taken': taken,
            'w': w, 'h': h, 'o': orient,
            'cam': cam,
            't': 'assets/media/t/%s.webp' % pid,
            'l': 'assets/media/l/%s.webp' % pid,
            'lqip': lqip,
            'src': os.path.relpath(src, ROOT).replace('\\', '/'),
            'featured': False,
            'pinned': False,
            'caption': '',
        }
    except Exception as e:
        return {'error': '%s: %s' % (os.path.basename(src), e)}


def load_list(fname):
    """读一行一条的清单文件（精选 / 置顶）"""
    p = os.path.join(DATA_DIR, fname)
    if not os.path.exists(p):
        return set()
    out = set()
    with open(p, encoding='utf-8') as f:
        for line in f:
            line = line.split('#')[0].strip()
            if line:
                out.add(line.replace('\\', '/').split('/')[-1])
    return out


def main():
    for d in (MEDIA_T, MEDIA_L, MEDIA_V, DATA_DIR):
        os.makedirs(d, exist_ok=True)

    if not os.path.isdir(PHOTOS_DIR):
        print('找不到 photos/ 目录，请先创建并把照片放进去。')
        return 1

    featured = load_list('featured.txt')
    pinned = load_list('pinned.txt')

    albums, jobs = [], []
    for album_key in sorted(os.listdir(PHOTOS_DIR)):
        adir = os.path.join(PHOTOS_DIR, album_key)
        if not os.path.isdir(adir):
            continue
        files = sorted(f for f in os.listdir(adir)
                       if (f.lower().endswith(EXTS) or f.lower().endswith(EXTS_V))
                       and f not in EXCLUDE_FILES)
        if not files:
            continue
        if MAX_PER_ALBUM and len(files) > MAX_PER_ALBUM:
            step = len(files) / MAX_PER_ALBUM
            files = [files[min(int(i * step), len(files) - 1)] for i in range(MAX_PER_ALBUM)]
        label, date = album_meta(album_key)
        albums.append({'key': album_key, 'label': label, 'date': date, 'count': len(files)})
        for i, f in enumerate(files, 1):
            jobs.append((os.path.join(adir, f), album_key, label, date, i))

    if not jobs:
        print('photos/ 里没有找到照片。')
        return 1

    print('发现 %d 个分组，%d 张照片，开始处理…' % (len(albums), len(jobs)))
    photos, errors = [], []
    workers = max(1, min(6, (os.cpu_count() or 4) - 1))
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for n, r in enumerate(pool.map(process, jobs), 1):
            if 'error' in r:
                errors.append(r['error'])
            else:
                base = os.path.basename(r['src'])
                r['featured'] = base in featured
                r['pinned'] = base in pinned
                photos.append(r)
            if n % 25 == 0 or n == len(jobs):
                print('  %d / %d' % (n, len(jobs)))

    # 分组补上封面与数量
    by_album = {}
    for p in photos:
        by_album.setdefault(p['album'], []).append(p)
    for a in albums:
        lst = by_album.get(a['key'], [])
        a['count'] = len(lst)
        cover = next((p for p in lst if p['featured']), lst[0] if lst else None)
        a['cover'] = cover['t'] if cover else ''
        a['coverId'] = cover['id'] if cover else ''
    albums = [a for a in albums if a['count']]

    # 顺序：精选优先，其次置顶，其次按日期倒序
    photos.sort(key=lambda p: (
        0 if p['featured'] else 1,
        0 if p['pinned'] else 1,
        p['date'] or '0000-00-00',
        p['id'],
    ), reverse=False)
    photos.sort(key=lambda p: (0 if p['featured'] else 1, 0 if p['pinned'] else 1))

    out = {
        'generated': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'stats': {'total': len(photos), 'albums': len(albums),
                  'featured': sum(1 for p in photos if p['featured'])},
        'albums': albums,
        'photos': photos,
    }
    with open(os.path.join(DATA_DIR, 'photos.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    # 页面用 script 标签读它（双击 index.html 也能跑，不依赖本地服务器）
    with open(os.path.join(DATA_DIR, 'photos.js'), 'w', encoding='utf-8') as f:
        f.write('/* 本文件由 build.py 自动生成，不要手改。 */\n')
        f.write('window.AY_PHOTOS = ')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    size = sum(os.path.getsize(os.path.join(dp, f))
               for dp, _, fs in os.walk(os.path.join(ROOT, 'assets', 'media'))
               for f in fs) / 1024 / 1024
    print('\n完成：%d 张照片，%d 个分组，精选 %d 张' % (
        len(photos), len(albums), out['stats']['featured']))
    print('产物体积：%.1f MB' % size)
    if errors:
        print('跳过 %d 个文件：' % len(errors))
        for e in errors[:10]:
            print('  ' + e)
    print('刷新 index.html 即可看到。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
